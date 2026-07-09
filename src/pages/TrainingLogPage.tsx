import { useEffect, useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import type { WorkoutRecord } from '../types/workout';

interface DayData {
  date: Date;
  totalTss: number;
  title: string;
  count: number;
}

interface WeekRow {
  weekStart: Date;
  weekEnd: Date;
  days: (DayData | null)[]; // Mon–Sun (7 slots)
  totalTss: number;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Convert a UTC date to Central US date string (YYYY-MM-DD)
function toCentralDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }); // en-CA gives YYYY-MM-DD
}

// Get the local date parts in Central timezone
function getCentralDate(date: Date): { year: number; month: number; day: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value) - 1;
  const day = parseInt(parts.find((p) => p.type === 'day')!.value);
  const weekdayStr = parts.find((p) => p.type === 'weekday')!.value;
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year, month, day, dayOfWeek: weekdayMap[weekdayStr] ?? 0 };
}

function formatDateRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = sameMonth
    ? end.getDate().toString()
    : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} \u2013 ${endStr}`;
}

function buildWeeks(workouts: WorkoutRecord[]): WeekRow[] {
  // Group workouts by date string in Central US timezone (YYYY-MM-DD)
  const dayMap = new Map<string, { totalTss: number; titles: string[]; count: number; date: Date }>();

  for (const w of workouts) {
    const d = new Date(w.startTime);
    const key = toCentralDateKey(d);
    const central = getCentralDate(d);
    const existing = dayMap.get(key);
    const tss = w.tss ?? 0;
    if (existing) {
      existing.totalTss += tss;
      existing.count += 1;
      if (w.title) existing.titles.push(w.title);
    } else {
      dayMap.set(key, {
        totalTss: tss,
        titles: w.title ? [w.title] : [],
        count: 1,
        date: new Date(central.year, central.month, central.day),
      });
    }
  }

  if (dayMap.size === 0) return [];

  // Find date range
  const allDates = Array.from(dayMap.values()).map((v) => v.date.getTime());
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));

  // Build week rows from the most recent Monday through the oldest Monday
  const firstMonday = getMonday(minDate);
  const lastMonday = getMonday(maxDate);

  const weeks: WeekRow[] = [];
  let currentMonday = new Date(lastMonday);

  while (currentMonday >= firstMonday) {
    const days: (DayData | null)[] = [];
    let weekTss = 0;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(currentMonday);
      dayDate.setDate(dayDate.getDate() + i);
      // Use local date format (YYYY-MM-DD) to match keys
      const key = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      const data = dayMap.get(key);

      if (data && data.totalTss > 0) {
        const title =
          data.count > 1
            ? `${data.count} workouts`
            : data.titles[0] || 'Workout';
        days.push({ date: dayDate, totalTss: data.totalTss, title, count: data.count });
        weekTss += data.totalTss;
      } else {
        days.push(null);
      }
    }

    const weekEnd = new Date(currentMonday);
    weekEnd.setDate(weekEnd.getDate() + 6);

    weeks.push({
      weekStart: new Date(currentMonday),
      weekEnd,
      days,
      totalTss: weekTss,
    });

    currentMonday.setDate(currentMonday.getDate() - 7);
  }

  return weeks;
}

function BubbleCell({ day, maxTss }: { day: DayData | null; maxTss: number }) {
  if (!day) {
    return <div className="flex-1 flex flex-col items-center justify-center min-h-[140px]" />;
  }

  // Scale bubble size: min 18px, max 120px, sqrt scale for more dramatic variation
  const minSize = 18;
  const maxSize = 120;
  const ratio = maxTss > 0 ? Math.sqrt(day.totalTss / maxTss) : 0;
  const size = Math.round(minSize + ratio * (maxSize - minSize));
  const fontSize = size < 30 ? '0.55rem' : size < 45 ? '0.65rem' : size < 70 ? '0.75rem' : '0.85rem';

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[140px] gap-1">
      <div
        className="rounded-full bg-electricBlue flex items-center justify-center text-pureWhite font-bold"
        style={{ width: `${size}px`, height: `${size}px`, fontSize }}
      >
        {Math.round(day.totalTss)}
      </div>
      <span className="text-xs text-softFog text-center max-w-[90px] truncate">
        {day.title}
      </span>
    </div>
  );
}

export default function TrainingLogPage() {
  const { workouts, isLoading, error, fetchWorkouts } = useWorkoutStore();

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const weeks = useMemo(() => buildWeeks(workouts), [workouts]);

  const maxDailyTss = useMemo(() => {
    let max = 0;
    for (const week of weeks) {
      for (const day of week.days) {
        if (day && day.totalTss > max) max = day.totalTss;
      }
    }
    return max;
  }, [weeks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg">Loading training log...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          className="px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
          onClick={() => fetchWorkouts()}
        >
          Retry
        </button>
      </div>
    );
  }

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-pureWhite">Training Log</h1>

      <div className="overflow-y-auto">
        {/* Day-of-week header */}
        <div className="flex items-center sticky top-0 bg-charcoalGray z-10 pb-2">
          <div className="w-[140px] shrink-0" />
          {dayHeaders.map((d) => (
            <div key={d} className="flex-1 text-center text-xs font-semibold text-lightSilver uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, idx) => (
          <div key={idx} className="flex items-center border-b border-steelBlue py-3">
            {/* Left sidebar */}
            <div className="w-[140px] shrink-0 pr-4">
              <div className="text-sm font-semibold text-pureWhite">
                {formatDateRange(week.weekStart, week.weekEnd)}
              </div>
              <div className="text-xs text-softFog">Total TSS</div>
              <div className="text-lg font-bold text-pureWhite">{Math.round(week.totalTss)}</div>
            </div>

            {/* Day bubbles */}
            {week.days.map((day, dayIdx) => (
              <BubbleCell key={dayIdx} day={day} maxTss={maxDailyTss} />
            ))}
          </div>
        ))}

        {weeks.length === 0 && (
          <p className="text-softFog text-center py-8">No workouts found.</p>
        )}
      </div>
    </div>
  );
}
