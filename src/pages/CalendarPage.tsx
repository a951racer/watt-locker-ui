import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { getCalendar, moveActivity, deleteWorkout, completeActivity, listTemplates, copyTemplateToActivity, saveAsTemplate } from '../api/workouts';
import type { CalendarActivity, CalendarWeeklySummary, Template } from '../api/workouts';

// --- Map API response to CalendarActivity ---

/**
 * Converts a WorkoutRecord (returned by moveActivity API) into a CalendarActivity
 * suitable for the calendar's local state. Uses the server response as authoritative
 * for status, date, and other fields. Falls back to the original activity for any
 * calendar-specific fields not present on WorkoutRecord.
 */
function toCalendarActivity(record: Record<string, unknown> | CalendarActivity | object, fallback?: CalendarActivity): CalendarActivity {
  const r = record as Record<string, unknown>;
  return {
    id: (r.id as string) ?? fallback?.id ?? '',
    date: (r.date as string) ?? fallback?.date ?? '',
    status: (r.status as string) ?? fallback?.status ?? 'planned',
    title: (r.title as string | undefined) ?? fallback?.title,
    activityType: (r.activityType as string) ?? fallback?.activityType ?? 'ride',
    plannedTss: (r.plannedTss as number | undefined) ?? fallback?.plannedTss,
    tss: (r.tss as number | undefined) ?? fallback?.tss,
    plannedDurationSeconds: (r.plannedDurationSeconds as number | undefined) ?? fallback?.plannedDurationSeconds,
    durationSeconds: (r.durationSeconds as number | undefined) ?? fallback?.durationSeconds,
    plannedDistanceMeters: (r.plannedDistanceMeters as number | undefined) ?? fallback?.plannedDistanceMeters,
    distanceMeters: (r.distanceMeters as number | undefined) ?? fallback?.distanceMeters,
  };
}

// --- Date helpers ---

function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getMonthFromDateStr(s: string): number {
  return parseInt(s.split('-')[1], 10);
}

// --- Formatting helpers ---

function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '';
  const totalSec = Math.round(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationCompact(seconds: number): string {
  if (!seconds) return '0:00';
  const totalSec = Math.round(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatMiles(meters: number | undefined): string {
  if (!meters) return '';
  const miles = meters / 1609.344;
  if (miles >= 100) return `${Math.round(miles)} mi`;
  return `${miles.toFixed(1)} mi`;
}

// --- Month shading (stronger contrast) ---

function getMonthScheme(month: number): string {
  return month % 2 === 1 ? 'bg-slate-900' : 'bg-slate-800/60';
}

const MONTH_ABBREVS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function getMonthYearLabel(d: Date): string {
  return `${MONTH_ABBREVS[d.getMonth()]} ${d.getFullYear()}`;
}

// --- Constants ---
const WEEKS_BEFORE = 4;
const WEEKS_AFTER = 5;
const CHUNK_SIZE = 4;
// Distance from edge (in px) that triggers loading
const SCROLL_THRESHOLD = 300;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface WeekData {
  monday: Date;
  mondayStr: string;
  days: string[];
}

function buildWeeks(startMonday: Date, count: number): WeekData[] {
  const result: WeekData[] = [];
  for (let w = 0; w < count; w++) {
    const monday = addDays(startMonday, w * 7);
    const mondayStr = formatDate(monday);
    const days: string[] = [];
    for (let d = 0; d < 7; d++) days.push(formatDate(addDays(monday, d)));
    result.push({ monday, mondayStr, days });
  }
  return result;
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), []);
  const thisMonday = useMemo(() => getMonday(today), [today]);
  const navigate = useNavigate();

  const [weeks, setWeeks] = useState<WeekData[]>(() => {
    const startMonday = addDays(thisMonday, -WEEKS_BEFORE * 7);
    return buildWeeks(startMonday, WEEKS_BEFORE + 1 + WEEKS_AFTER);
  });

  const [activities, setActivities] = useState<CalendarActivity[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<CalendarWeeklySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentWeekRef = useRef<HTMLDivElement>(null);

  // Refs for infinite scroll — prevent duplicate in-flight requests
  const isLoadingPastRef = useRef(false);
  const isLoadingFutureRef = useRef(false);
  const weeksRef = useRef(weeks);
  weeksRef.current = weeks;
  // Ensures initial scroll positioning runs exactly once
  const hasInitializedScrollRef = useRef(false);

  const todayStr = useMemo(() => formatDate(today), [today]);

  // Fetch data for ONLY a specific date range
  const fetchChunk = useCallback(async (dateFrom: string, dateTo: string) => {
    return await getCalendar(dateFrom, dateTo);
  }, []);

  // Fetch data for the full current weeks range (initial load + refresh after creation)
  const fetchFullRange = useCallback(async (weeksList: WeekData[]) => {
    const dateFrom = weeksList[0].days[0];
    const dateTo = weeksList[weeksList.length - 1].days[6];
    const result = await getCalendar(dateFrom, dateTo);
    setActivities(result.activities);
    setWeeklySummaries(result.weeklySummaries);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchFullRange(weeks)
      .then(() => { if (!cancelled) setIsLoading(false); })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load calendar data');
          setIsLoading(false);
        }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After initial load renders the calendar, position scroll so current week is visible.
  useEffect(() => {
    if (isLoading || error || hasInitializedScrollRef.current) return;
    hasInitializedScrollRef.current = true;

    const container = scrollContainerRef.current;
    const currentWeekEl = currentWeekRef.current;
    if (!container || !currentWeekEl) return;

    requestAnimationFrame(() => {
      const offset = currentWeekEl.offsetTop;
      if (offset > 0) {
        container.scrollTop = Math.max(0, offset - 40);
      }
    });
  }, [isLoading, error]);

  const retry = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchFullRange(weeksRef.current);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
      setIsLoading(false);
    }
  }, [fetchFullRange]);

  // Load more past weeks
  const loadPast = useCallback(async () => {
    if (isLoadingPastRef.current) return;
    isLoadingPastRef.current = true;

    try {
      const currentWeeks = weeksRef.current;
      const firstMonday = currentWeeks[0].monday;
      const newStartMonday = addDays(firstMonday, -CHUNK_SIZE * 7);
      const newWeeks = buildWeeks(newStartMonday, CHUNK_SIZE);

      const dateFrom = newWeeks[0].days[0];
      const dateTo = newWeeks[newWeeks.length - 1].days[6];
      const result = await fetchChunk(dateFrom, dateTo);

      const container = scrollContainerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      const prevScrollTop = container?.scrollTop ?? 0;

      flushSync(() => {
        setWeeks(prev => [...newWeeks, ...prev]);
        setActivities(prev => [...result.activities, ...prev]);
        setWeeklySummaries(prev => [...result.weeklySummaries, ...prev]);
      });

      if (container) {
        const newScrollHeight = container.scrollHeight;
        const newScrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        container.scrollTop = newScrollTop;
      }
    } catch {
      // Silently ignore
    } finally {
      isLoadingPastRef.current = false;
    }
  }, [fetchChunk]);

  // Load more future weeks
  const loadFuture = useCallback(async () => {
    if (isLoadingFutureRef.current) return;
    isLoadingFutureRef.current = true;

    try {
      const currentWeeks = weeksRef.current;
      const lastMonday = currentWeeks[currentWeeks.length - 1].monday;
      const newStartMonday = addDays(lastMonday, 7);
      const newWeeks = buildWeeks(newStartMonday, CHUNK_SIZE);

      const dateFrom = newWeeks[0].days[0];
      const dateTo = newWeeks[newWeeks.length - 1].days[6];
      const result = await fetchChunk(dateFrom, dateTo);

      setWeeks(prev => [...prev, ...newWeeks]);
      setActivities(prev => [...prev, ...result.activities]);
      setWeeklySummaries(prev => [...prev, ...result.weeklySummaries]);
    } catch {
      // Silently ignore
    } finally {
      isLoadingFutureRef.current = false;
    }
  }, [fetchChunk]);

  // Scroll-based pagination
  useEffect(() => {
    if (isLoading || error) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const checkEdges = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const distanceFromTop = scrollTop;

      if (distanceFromBottom < SCROLL_THRESHOLD && !isLoadingFutureRef.current) {
        loadFuture();
      }
      if (distanceFromTop < SCROLL_THRESHOLD && !isLoadingPastRef.current) {
        loadPast();
      }
    };

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        checkEdges();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isLoading, error, loadPast, loadFuture]);

  // Scroll to today
  const goToToday = useCallback(() => {
    currentWeekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Derive grouped activities
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, CalendarActivity[]>();
    for (const activity of activities) {
      const existing = map.get(activity.date) || [];
      existing.push(activity);
      map.set(activity.date, existing);
    }
    return map;
  }, [activities]);

  // Map weekly summaries by weekStart
  const summaryByWeekStart = useMemo(() => {
    const map = new Map<string, CalendarWeeklySummary>();
    for (const s of weeklySummaries) {
      map.set(s.weekStart, s);
    }
    return map;
  }, [weeklySummaries]);

  // --- Move activity state (date picker fallback via action menu) ---
  const [moveTarget, setMoveTarget] = useState<{ activity: CalendarActivity; currentDate: string } | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Refresh calendar data after a successful move to get authoritative server state
  // (triggers backend skip evaluation and returns correct lifecycle status)
  const refreshAfterMove = useCallback(async () => {
    try {
      await fetchFullRange(weeksRef.current);
    } catch {
      // Silently ignore refresh failures — the optimistic update is already in place
    }
  }, [fetchFullRange]);

  // Action menu state
  const [menuTarget, setMenuTarget] = useState<{ activity: CalendarActivity } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((activity: CalendarActivity) => {
    setMenuTarget({ activity });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuTarget(null);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuTarget) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuTarget, closeMenu]);

  const openMovePopover = useCallback((activity: CalendarActivity) => {
    setMenuTarget(null);
    setMoveTarget({ activity, currentDate: activity.date });
    setMoveDate(activity.date);
    setMoveError(null);
  }, []);

  const closeMovePopover = useCallback(() => {
    setMoveTarget(null);
    setMoveDate('');
    setMoveError(null);
  }, []);

  const handleMove = useCallback(async () => {
    if (!moveTarget) return;
    if (moveDate === moveTarget.currentDate) {
      closeMovePopover();
      return;
    }
    if (!moveDate || !/^\d{4}-\d{2}-\d{2}$/.test(moveDate)) {
      setMoveError('Please select a valid date');
      return;
    }

    setIsMoving(true);
    setMoveError(null);
    try {
      const returned = await moveActivity(moveTarget.activity.id, moveDate);
      setActivities(prev => {
        const updated = prev.filter(a => a.id !== moveTarget.activity.id);
        updated.push(toCalendarActivity(returned, moveTarget.activity));
        return updated;
      });
      closeMovePopover();
      // Refresh to get authoritative state (triggers backend skip evaluation)
      refreshAfterMove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move activity';
      setMoveError(msg);
    } finally {
      setIsMoving(false);
    }
  }, [moveTarget, moveDate, closeMovePopover, refreshAfterMove]);

  // --- Delete activity state ---
  const [deleteTarget, setDeleteTarget] = useState<CalendarActivity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openDeleteConfirm = useCallback((activity: CalendarActivity) => {
    setMenuTarget(null);
    setDeleteTarget(activity);
    setDeleteError(null);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteWorkout(deleteTarget.id);
      setActivities(prev => prev.filter(a => a.id !== deleteTarget.id));
      closeDeleteConfirm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete activity';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, closeDeleteConfirm]);

  // --- Complete activity state ---
  const [completeTarget, setCompleteTarget] = useState<CalendarActivity | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const openCompleteConfirm = useCallback((activity: CalendarActivity) => {
    setMenuTarget(null);
    setCompleteTarget(activity);
    setCompleteError(null);
  }, []);

  const closeCompleteConfirm = useCallback(() => {
    setCompleteTarget(null);
    setCompleteError(null);
  }, []);

  const handleComplete = useCallback(async () => {
    if (!completeTarget) return;
    setIsCompleting(true);
    setCompleteError(null);
    try {
      const returned = await completeActivity(completeTarget.id);
      setActivities(prev => {
        const updated = prev.filter(a => a.id !== completeTarget.id);
        updated.push(toCalendarActivity(returned, completeTarget));
        return updated;
      });
      closeCompleteConfirm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark activity as completed';
      setCompleteError(msg);
    } finally {
      setIsCompleting(false);
    }
  }, [completeTarget, closeCompleteConfirm]);

  // --- Save as Template state ---
  const [saveTemplateSuccess, setSaveTemplateSuccess] = useState<string | null>(null);
  const [saveTemplateError, setSaveTemplateError] = useState<string | null>(null);
  const [isSavingAsTemplate, setIsSavingAsTemplate] = useState(false);

  const handleSaveAsTemplate = useCallback(async (activity: CalendarActivity) => {
    setMenuTarget(null);
    if (isSavingAsTemplate) return;
    setIsSavingAsTemplate(true);
    setSaveTemplateError(null);
    try {
      await saveAsTemplate(activity.id);
      setSaveTemplateSuccess(`"${activity.title || activity.activityType}" saved as template`);
      setTimeout(() => setSaveTemplateSuccess(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save as template';
      setSaveTemplateError(msg);
      setTimeout(() => setSaveTemplateError(null), 5000);
    } finally {
      setIsSavingAsTemplate(false);
    }
  }, [isSavingAsTemplate]);

  // --- Drag-and-Drop state ---
  const [draggedActivity, setDraggedActivity] = useState<CalendarActivity | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, activity: CalendarActivity) => {
    e.dataTransfer.setData('application/x-activity-id', activity.id);
    e.dataTransfer.setData('application/x-activity-date', activity.date);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedActivity(activity);
    setDropError(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedActivity(null);
    setDragOverDate(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverDate(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, destDate: string) => {
    e.preventDefault();
    setDragOverDate(null);

    // Check if this is a template drop (from the template drawer)
    const templateId = e.dataTransfer.getData('application/x-template-id');
    if (templateId) {
      setTemplateDropError(null);
      try {
        const created = await copyTemplateToActivity(templateId, destDate);
        setActivities(prev => [...prev, toCalendarActivity(created, undefined)]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create activity from template';
        setTemplateDropError(msg);
      }
      return;
    }

    // Otherwise, handle as activity move
    const activityId = e.dataTransfer.getData('application/x-activity-id');
    const sourceDate = e.dataTransfer.getData('application/x-activity-date');

    if (!activityId || !destDate) return;

    const activity = draggedActivity;
    setDraggedActivity(null);

    // Same date — no-op
    if (sourceDate === destDate) return;

    // Call API
    try {
      const returned = await moveActivity(activityId, destDate);
      setActivities(prev => {
        const updated = prev.filter(a => a.id !== activityId);
        const originalActivity = activity || prev.find(a => a.id === activityId);
        updated.push(toCalendarActivity(returned, originalActivity || undefined));
        return updated;
      });
      setDropError(null);
      // Refresh to get authoritative state (triggers backend skip evaluation)
      refreshAfterMove();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to move activity';
      setDropError(msg);
    }
  }, [draggedActivity, refreshAfterMove]);

  // Dismiss drop error
  useEffect(() => {
    if (!dropError) return;
    const timer = setTimeout(() => setDropError(null), 5000);
    return () => clearTimeout(timer);
  }, [dropError]);

  // --- Template Drawer State ---
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTemplates, setDrawerTemplates] = useState<Template[]>([]);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [templateDropError, setTemplateDropError] = useState<string | null>(null);

  const fetchDrawerTemplates = useCallback(async (searchTerm: string) => {
    setDrawerLoading(true);
    try {
      const result = await listTemplates({ page: 1, pageSize: 50, search: searchTerm || undefined });
      setDrawerTemplates(result.items);
    } catch {
      setDrawerTemplates([]);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // Load templates when drawer opens or search changes
  useEffect(() => {
    if (!drawerOpen) return;
    const timer = setTimeout(() => fetchDrawerTemplates(drawerSearch), 200);
    return () => clearTimeout(timer);
  }, [drawerOpen, drawerSearch, fetchDrawerTemplates]);

  const handleTemplateDragStart = useCallback((e: React.DragEvent, template: Template) => {
    e.dataTransfer.setData('application/x-template-id', template.id);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Dismiss template drop error
  useEffect(() => {
    if (!templateDropError) return;
    const timer = setTimeout(() => setTemplateDropError(null), 5000);
    return () => clearTimeout(timer);
  }, [templateDropError]);

  const currentWeekMondayStr = useMemo(() => formatDate(thisMonday), [thisMonday]);

  const headerContext = useMemo(() => {
    return thisMonday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [thisMonday]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg" data-testid="loading-indicator">Loading calendar...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400 text-lg" data-testid="error-message">{error}</p>
        <button className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors" onClick={retry} data-testid="retry-button">Retry</button>
      </div>
    );
  }

  const isMovable = (status: string) => status === 'planned' || status === 'skipped';
  const hasPlannedStructure = (activity: CalendarActivity) => activity.plannedDurationSeconds != null;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 104px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-pureWhite">{headerContext}</h1>
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`mt-1 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${drawerOpen ? 'text-electricBlue bg-electricBlue/10' : 'text-softFog hover:text-brightCyan'}`}
            aria-label="Templates"
            data-testid="templates-drawer-btn"
          >
            <span className="text-sm">📋</span>
            <span>Templates</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToToday} className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm" data-testid="nav-today">Today</button>
        </div>
      </div>

      {/* Drop error toast */}
      {dropError && (
        <div className="mb-2 px-3 py-2 bg-red-900/80 text-red-200 text-sm rounded" data-testid="drop-error">
          {dropError}
        </div>
      )}
      {templateDropError && (
        <div className="mb-2 px-3 py-2 bg-red-900/80 text-red-200 text-sm rounded" data-testid="template-drop-error">
          {templateDropError}
        </div>
      )}
      {saveTemplateSuccess && (
        <div className="mb-2 px-3 py-2 bg-green-900/80 text-green-200 text-sm rounded" data-testid="save-template-success">
          {saveTemplateSuccess}
        </div>
      )}
      {saveTemplateError && (
        <div className="mb-2 px-3 py-2 bg-red-900/80 text-red-200 text-sm rounded" data-testid="save-template-error">
          {saveTemplateError}
        </div>
      )}

      {/* Calendar + Template Drawer flex container */}
      <div className="flex-1 min-h-0 flex gap-0">
        {/* Template Drawer — LEFT side */}
        {drawerOpen && (
          <div className="w-64 min-h-0 overflow-y-auto border-r border-steelBlue bg-deepNavy p-3 shrink-0" data-testid="template-drawer">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-lightSilver uppercase tracking-wide">Templates</span>
              <button
                type="button"
                onClick={() => navigate('/templates/new', { state: { returnTo: '/calendar' } })}
                className="w-5 h-5 flex items-center justify-center rounded text-lightSilver hover:text-brightCyan hover:bg-steelBlue/50 transition-colors text-sm"
                aria-label="Create template"
                title="Create template"
                data-testid="drawer-create-template-btn"
              >
                +
              </button>
            </div>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search templates..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                className="w-full px-3 py-2 rounded bg-charcoalGray text-pureWhite border border-steelBlue placeholder-lightSilver text-sm focus:outline-none focus:border-electricBlue"
                data-testid="drawer-search-input"
              />
            </div>
            {drawerLoading && (
              <div className="text-center py-4 text-lightSilver text-sm" data-testid="drawer-loading">Loading...</div>
            )}
            {!drawerLoading && drawerTemplates.length === 0 && (
              <div className="text-center py-4 text-softFog text-sm" data-testid="drawer-empty">No templates found.</div>
            )}
            {!drawerLoading && drawerTemplates.length > 0 && (
              <div className="space-y-2" data-testid="drawer-template-list">
                {drawerTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-charcoalGray rounded p-2.5 border border-steelBlue hover:border-electricBlue cursor-grab active:cursor-grabbing transition-colors"
                    draggable
                    onDragStart={(e) => handleTemplateDragStart(e, template)}
                    data-testid={`drawer-template-${template.id}`}
                  >
                    <div className="text-pureWhite text-xs font-semibold truncate">{template.title || 'Untitled'}</div>
                    <div className="text-softFog text-[10px] mt-0.5">
                      {template.activityType}
                      {template.plannedDurationSeconds ? ` · ${Math.round(template.plannedDurationSeconds / 60)}min` : ''}
                      {template.segments && template.segments.length > 0 ? ` · ${template.segments.length} steps` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Calendar — scrollable container */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto" ref={scrollContainerRef} data-testid="calendar-grid">
          {/* Sticky column headers */}
          <div className="grid grid-cols-[repeat(7,1fr)_140px] gap-px sticky top-0 z-10 bg-deepNavy border-b border-gray-600" data-testid="calendar-header">
            {DAY_LABELS.map((label) => (
              <div key={label} className="text-center text-sm font-bold text-lightSilver py-2 uppercase tracking-wide">{label}</div>
            ))}
            <div className="text-center text-sm font-bold text-lightSilver py-2 uppercase tracking-wide">Summary</div>
          </div>

        {/* Week rows */}
        {weeks.map((week, weekIdx) => {
          const isCurrentWeek = week.mondayStr === currentWeekMondayStr;
          const summary = summaryByWeekStart.get(week.mondayStr);

          return (
            <div
              key={week.mondayStr}
              ref={isCurrentWeek ? currentWeekRef : undefined}
              className="grid grid-cols-[repeat(7,1fr)_140px] gap-px border-b border-gray-700"
              data-testid={`week-row-${weekIdx}`}
            >
              {week.days.map((dateStr) => {
                const month = getMonthFromDateStr(dateStr);
                const scheme = getMonthScheme(month);
                const isToday = dateStr === todayStr;
                const dayActivities = activitiesByDate.get(dateStr) || [];
                const dateObj = parseDateStr(dateStr);
                const dayNum = dateObj.getDate();
                const isDragOver = dragOverDate === dateStr && draggedActivity?.date !== dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`group min-h-[130px] p-2 border-r border-gray-700/40 ${scheme} ${isToday ? 'ring-2 ring-brightCyan ring-inset' : ''} ${isDragOver ? 'ring-2 ring-electricBlue ring-inset bg-electricBlue/10' : ''}`}
                    data-testid={`day-cell-${dateStr}`}
                    data-date={dateStr}
                    data-month={month}
                    onDragOver={(e) => handleDragOver(e, dateStr)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dateStr)}
                  >
                    <div className={`text-sm mb-2 flex items-baseline gap-1.5 ${isToday ? 'text-brightCyan font-bold' : 'text-lightSilver font-medium'}`}>
                      <span>{dayNum}</span>
                      {dayNum === 1 && <span className="text-[10px] text-softFog font-semibold uppercase tracking-wide">{getMonthYearLabel(dateObj)}</span>}
                    </div>

                    <div className="space-y-1.5">
                      {dayActivities.map((activity) => (
                        <div
                          key={activity.id}
                          className={`relative group/card ${draggedActivity?.id === activity.id ? 'opacity-40' : ''}`}
                          draggable={isMovable(activity.status)}
                          onDragStart={isMovable(activity.status) ? (e) => handleDragStart(e, activity) : undefined}
                          onDragEnd={handleDragEnd}
                          data-testid={`activity-card-${activity.id}`}
                        >
                          <Link
                            to={activity.status === 'planned' ? `/activities/${activity.id}/edit` : `/workouts/${activity.id}`}
                            className={`block rounded-sm px-2 py-1.5 hover:opacity-80 transition-opacity border-l-4 bg-slate-700/80 ${getStatusBorder(activity.status)} ${isMovable(activity.status) ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            data-testid={`activity-${activity.id}`}
                            data-status={activity.status}
                            draggable={false}
                          >
                            <div className="text-pureWhite truncate text-xs font-semibold">
                              {activity.title || activity.activityType}
                            </div>
                            <div className="text-gray-300 text-xs mt-0.5">
                              <ActivityMetrics activity={activity} />
                            </div>
                          </Link>
                          {isMovable(activity.status) && (
                            <div className="absolute top-1 right-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMenu(activity); }}
                                className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-softFog hover:text-brightCyan hover:bg-deepNavy/80 opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label={`Actions for ${activity.title || activity.activityType}`}
                                data-testid={`action-btn-${activity.id}`}
                                draggable={false}
                              >
                                ⋮
                              </button>
                              {menuTarget?.activity.id === activity.id && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-full mt-1 bg-deepNavy border border-steelBlue rounded shadow-lg z-20 py-1 min-w-[100px]"
                                  data-testid={`action-menu-${activity.id}`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMovePopover(activity); }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-lightSilver hover:bg-steelBlue/50"
                                    data-testid={`menu-move-${activity.id}`}
                                  >
                                    Move
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openCompleteConfirm(activity); }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-green-400 hover:bg-steelBlue/50"
                                    data-testid={`menu-complete-${activity.id}`}
                                  >
                                    Mark Complete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSaveAsTemplate(activity); }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-lightSilver hover:bg-steelBlue/50"
                                    data-testid={`menu-save-template-${activity.id}`}
                                  >
                                    Save as Template
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openDeleteConfirm(activity); }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-steelBlue/50"
                                    data-testid={`menu-delete-${activity.id}`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {activity.status === 'completed' && hasPlannedStructure(activity) && (
                            <div className="absolute top-1 right-1">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); e.preventDefault(); openMenu(activity); }}
                                className="w-5 h-5 flex items-center justify-center rounded text-[10px] text-softFog hover:text-brightCyan hover:bg-deepNavy/80 opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity"
                                aria-label={`Actions for ${activity.title || activity.activityType}`}
                                data-testid={`action-btn-${activity.id}`}
                                draggable={false}
                              >
                                ⋮
                              </button>
                              {menuTarget?.activity.id === activity.id && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-full mt-1 bg-deepNavy border border-steelBlue rounded shadow-lg z-20 py-1 min-w-[100px]"
                                  data-testid={`action-menu-${activity.id}`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleSaveAsTemplate(activity); }}
                                    className="w-full text-left px-3 py-1.5 text-sm text-lightSilver hover:bg-steelBlue/50"
                                    data-testid={`menu-save-template-${activity.id}`}
                                  >
                                    Save as Template
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate(`/activities/plan?date=${dateStr}`)}
                      className="w-full text-center text-xs text-softFog hover:text-brightCyan mt-2 py-1 rounded border border-dashed border-gray-600 hover:border-brightCyan transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      aria-label={`Add activity on ${dateStr}`}
                      data-testid={`add-activity-${dateStr}`}
                    >
                      + Add
                    </button>
                  </div>
                );
              })}

              {/* Summary column */}
              <div className="min-h-[130px] p-2 bg-gray-900/80 border-l border-gray-600" data-testid={`week-summary-${weekIdx}`}>
                <SummaryCell summary={summary} />
              </div>
            </div>
          );
        })}
      </div>
      </div>

      {/* Move Activity Popover (secondary/fallback interaction via action menu) */}
      {moveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="move-popover-backdrop">
          <div className="absolute inset-0 bg-black/50" onClick={closeMovePopover} />
          <div
            className="relative bg-charcoalGray rounded-lg p-5 shadow-xl border border-steelBlue w-80"
            role="dialog"
            aria-label="Move activity"
            data-testid="move-popover"
          >
            <h3 className="text-pureWhite font-semibold text-sm mb-3">
              Move: {moveTarget.activity.title || moveTarget.activity.activityType}
            </h3>
            <div className="mb-3">
              <label className="block text-xs text-softFog mb-1">New date</label>
              <input
                type="date"
                value={moveDate}
                onChange={(e) => setMoveDate(e.target.value)}
                className="w-full px-3 py-2 rounded bg-deepNavy text-lightSilver border border-steelBlue text-sm"
                data-testid="move-date-input"
                autoFocus
              />
            </div>
            {moveError && (
              <p className="text-red-400 text-xs mb-3" data-testid="move-error">{moveError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeMovePopover}
                className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors text-sm"
                data-testid="move-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMove}
                disabled={isMoving}
                className="px-3 py-1.5 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors text-sm disabled:opacity-50"
                data-testid="move-confirm-btn"
              >
                {isMoving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="delete-dialog-backdrop">
          <div className="absolute inset-0 bg-black/50" onClick={closeDeleteConfirm} />
          <div
            className="relative bg-charcoalGray rounded-lg p-5 shadow-xl border border-steelBlue w-80"
            role="dialog"
            aria-label="Delete activity"
            data-testid="delete-dialog"
          >
            <h3 className="text-pureWhite font-semibold text-sm mb-2">Delete Activity?</h3>
            <p className="text-lightSilver text-sm mb-4" data-testid="delete-activity-name">
              {deleteTarget.title || deleteTarget.activityType}
            </p>
            <p className="text-softFog text-xs mb-4">
              This will permanently delete this {deleteTarget.status} activity.
            </p>
            {deleteError && (
              <p className="text-red-400 text-xs mb-3" data-testid="delete-error">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors text-sm"
                data-testid="delete-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded bg-red-600 text-pureWhite hover:bg-red-500 transition-colors text-sm disabled:opacity-50"
                data-testid="delete-confirm-btn"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Complete Confirmation Dialog */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="complete-dialog-backdrop">
          <div className="absolute inset-0 bg-black/50" onClick={closeCompleteConfirm} />
          <div
            className="relative bg-charcoalGray rounded-lg p-5 shadow-xl border border-steelBlue w-80"
            role="dialog"
            aria-label="Mark activity complete"
            data-testid="complete-dialog"
          >
            <h3 className="text-pureWhite font-semibold text-sm mb-2">Mark Activity Complete?</h3>
            <p className="text-lightSilver text-sm mb-4" data-testid="complete-activity-name">
              {completeTarget.title || completeTarget.activityType}
            </p>
            <p className="text-softFog text-xs mb-4">
              This will mark this activity as completed.
            </p>
            {completeError && (
              <p className="text-red-400 text-xs mb-3" data-testid="complete-error">{completeError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCompleteConfirm}
                className="px-3 py-1.5 rounded bg-steelBlue text-pureWhite hover:bg-gray-600 transition-colors text-sm"
                data-testid="complete-cancel-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={isCompleting}
                className="px-3 py-1.5 rounded bg-green-600 text-pureWhite hover:bg-green-500 transition-colors text-sm disabled:opacity-50"
                data-testid="complete-confirm-btn"
              >
                {isCompleting ? 'Completing...' : 'Mark Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function getStatusBorder(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed': return 'border-l-green-500';
    case 'planned': return 'border-l-white';
    case 'skipped': return 'border-l-red-500';
    default: return 'border-l-gray-400';
  }
}

function ActivityMetrics({ activity }: { activity: CalendarActivity }) {
  const isCompleted = activity.status === 'completed';
  const duration = isCompleted ? activity.durationSeconds : activity.plannedDurationSeconds;
  const distance = isCompleted ? activity.distanceMeters : activity.plannedDistanceMeters;
  const tss = isCompleted ? activity.tss : activity.plannedTss;

  const durationStr = formatDuration(duration);
  const distanceStr = formatMiles(distance);
  const tssStr = tss != null ? `${tss}` : '';

  return (
    <span className="flex flex-col gap-0" data-testid={`metrics-${activity.id}`}>
      <span className="flex gap-1"><span className="text-softFog w-6">Dur</span><span>{durationStr || '—'}</span></span>
      <span className="flex gap-1"><span className="text-softFog w-6">Dist</span><span>{distanceStr || '—'}</span></span>
      <span className="flex gap-1"><span className="text-softFog w-6">TSS</span><span>{tssStr || '—'}</span></span>
    </span>
  );
}

function SummaryCell({ summary }: { summary?: CalendarWeeklySummary }) {
  if (!summary) {
    return (
      <div className="space-y-2 text-xs" data-testid="summary-content">
        <div className="flex items-baseline gap-2 text-gray-300">
          <span className="text-softFog w-8">Dur</span>
          <span>0:00</span>
          <span className="font-bold text-pureWhite" data-testid="summary-completed-duration">0:00</span>
        </div>
        <div className="flex items-baseline gap-2 text-gray-300">
          <span className="text-softFog w-8">Dist</span>
          <span>0</span>
          <span className="font-bold text-pureWhite" data-testid="summary-completed-distance">0 mi</span>
        </div>
        <div className="flex items-baseline gap-2 text-gray-300">
          <span className="text-softFog w-8">TSS</span>
          <span data-testid="summary-planned-tss">0</span>
          <span className="font-bold text-pureWhite" data-testid="summary-completed-tss">0</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs" data-testid="summary-content">
      <div className="flex items-baseline gap-2 text-gray-300">
        <span className="text-softFog w-8">Dur</span>
        <span>{formatDurationCompact(summary.plannedDuration)}</span>
        <span className="font-bold text-pureWhite" data-testid="summary-completed-duration">{formatDurationCompact(summary.completedDuration)}</span>
      </div>
      <div className="flex items-baseline gap-2 text-gray-300">
        <span className="text-softFog w-8">Dist</span>
        <span>{formatMiles(summary.plannedDistance) || '0'}</span>
        <span className="font-bold text-pureWhite" data-testid="summary-completed-distance">{formatMiles(summary.completedDistance) || '0'} mi</span>
      </div>
      <div className="flex items-baseline gap-2 text-gray-300">
        <span className="text-softFog w-8">TSS</span>
        <span data-testid="summary-planned-tss">{summary.plannedTss}</span>
        <span className="font-bold text-pureWhite" data-testid="summary-completed-tss">{summary.completedTss}</span>
      </div>
    </div>
  );
}
