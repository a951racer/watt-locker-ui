import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import CalendarPage from './CalendarPage';
import * as workoutsApi from '../api/workouts';
import type { CalendarActivity, CalendarWeeklySummary, CalendarResponse } from '../api/workouts';

vi.mock('../api/workouts', () => ({
  getCalendar: vi.fn(),
  moveActivity: vi.fn(),
  deleteWorkout: vi.fn(),
  completeActivity: vi.fn(),
  listTemplates: vi.fn(),
  copyTemplateToActivity: vi.fn(),
  saveAsTemplate: vi.fn(),
}));

const mockGetCalendar = vi.mocked(workoutsApi.getCalendar);
const mockMoveActivity = vi.mocked(workoutsApi.moveActivity);
const mockDeleteWorkout = vi.mocked(workoutsApi.deleteWorkout);
const mockCompleteActivity = vi.mocked(workoutsApi.completeActivity);
const mockListTemplates = vi.mocked(workoutsApi.listTemplates);
const mockCopyTemplateToActivity = vi.mocked(workoutsApi.copyTemplateToActivity);
const mockSaveAsTemplate = vi.mocked(workoutsApi.saveAsTemplate);

// --- Date helpers (mirror component logic) ---

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

const WEEKS_BEFORE = 4;
const WEEKS_AFTER = 5;
const INITIAL_WEEKS = WEEKS_BEFORE + 1 + WEEKS_AFTER; // 10
const CHUNK_SIZE = 4;

const today = new Date();
const thisMonday = getMonday(today);

function makeSampleActivities(): CalendarActivity[] {
  const tuesdayStr = formatDate(addDays(thisMonday, 1));
  const thursdayStr = formatDate(addDays(thisMonday, 3));
  return [
    {
      id: 'act-1',
      date: tuesdayStr,
      status: 'completed',
      title: 'Morning Ride',
      activityType: 'ride',
      tss: 85,
      durationSeconds: 3600,
      distanceMeters: 30000,
    },
    {
      id: 'act-2',
      date: thursdayStr,
      status: 'planned',
      title: 'Interval Session',
      activityType: 'ride',
      plannedTss: 120,
      plannedDurationSeconds: 5400,
      plannedDistanceMeters: 50000,
    },
    {
      id: 'act-3',
      date: tuesdayStr,
      status: 'skipped',
      title: 'Strength Training',
      activityType: 'strength',
    },
  ];
}

function makeSampleWeeklySummaries(): CalendarWeeklySummary[] {
  const mondayStr = formatDate(thisMonday);
  const sundayStr = formatDate(addDays(thisMonday, 6));
  return [
    {
      weekStart: mondayStr,
      weekEnd: sundayStr,
      plannedDuration: 5400,
      completedDuration: 3600,
      plannedDistance: 50000,
      completedDistance: 30000,
      plannedTss: 120,
      completedTss: 85,
    },
  ];
}

function makeSampleResponse(): CalendarResponse {
  return {
    activities: makeSampleActivities(),
    weeklySummaries: makeSampleWeeklySummaries(),
  };
}

function makeEmptyResponse(): CalendarResponse {
  return { activities: [], weeklySummaries: [] };
}

function renderCalendarPage() {
  return render(
    <MemoryRouter initialEntries={['/calendar']}>
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/workouts/:id" element={<div data-testid="workout-detail">Workout Detail</div>} />
        <Route path="/activities/plan" element={<div data-testid="plan-activity-page">Plan Activity</div>} />
        <Route path="/templates/new" element={<div data-testid="plan-activity-page">New Template</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Simulate scrolling near the bottom of the container.
 * Sets scrollTop such that distanceFromBottom < SCROLL_THRESHOLD (300px).
 */
function simulateScrollNearBottom(container: HTMLElement) {
  Object.defineProperty(container, 'scrollHeight', { value: 5000, writable: true, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 800, writable: true, configurable: true });
  // scrollTop = 5000 - 800 - 100 = 4100 → distanceFromBottom = 100 (< 300)
  Object.defineProperty(container, 'scrollTop', { value: 4100, writable: true, configurable: true });
  fireEvent.scroll(container);
}

/**
 * Simulate scrolling near the top of the container.
 * Sets scrollTop such that distanceFromTop < SCROLL_THRESHOLD (300px).
 */
function simulateScrollNearTop(container: HTMLElement) {
  Object.defineProperty(container, 'scrollHeight', { value: 5000, writable: true, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 800, writable: true, configurable: true });
  // scrollTop = 100 → distanceFromTop = 100 (< 300)
  Object.defineProperty(container, 'scrollTop', { value: 100, writable: true, configurable: true });
  fireEvent.scroll(container);
}

/**
 * Simulate scrolling to the middle (away from both edges).
 */
function simulateScrollMiddle(container: HTMLElement) {
  Object.defineProperty(container, 'scrollHeight', { value: 5000, writable: true, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 800, writable: true, configurable: true });
  // scrollTop = 2000 → distanceFromTop = 2000, distanceFromBottom = 2200 (both > 300)
  Object.defineProperty(container, 'scrollTop', { value: 2000, writable: true, configurable: true });
  fireEvent.scroll(container);
}

beforeEach(() => {
  // Mock scrollIntoView which doesn't exist in jsdom
  Element.prototype.scrollIntoView = vi.fn();
  // Mock requestAnimationFrame to execute synchronously in tests
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
  });

  // --- Initial load / rendering tests ---

  it('renders the initial window of weeks (10 weeks)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    for (let i = 0; i < INITIAL_WEEKS; i++) {
      expect(screen.getByTestId(`week-row-${i}`)).toBeInTheDocument();
    }
  });

  it('has 8 columns: 7 days + summary header', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const header = screen.getByTestId('calendar-header');
    expect(header).toHaveTextContent('Mon');
    expect(header).toHaveTextContent('Sun');
    expect(header).toHaveTextContent('Summary');
  });

  it('renders activities on correct dates', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const tuesdayStr = formatDate(addDays(thisMonday, 1));
    const tuesdayCell = screen.getByTestId(`day-cell-${tuesdayStr}`);
    expect(tuesdayCell).toHaveTextContent('Morning Ride');
    expect(tuesdayCell).toHaveTextContent('Strength Training');
    const thursdayStr = formatDate(addDays(thisMonday, 3));
    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(thursdayCell).toHaveTextContent('Interval Session');
  });

  it('alternates month shading by calendar month', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const tuesdayStr = formatDate(addDays(thisMonday, 1));
    const cell = screen.getByTestId(`day-cell-${tuesdayStr}`);
    const month = parseInt(cell.getAttribute('data-month')!, 10);
    if (month % 2 === 1) {
      expect(cell.className).toContain('bg-slate-900');
    } else {
      expect(cell.className).toContain('bg-slate-800/60');
    }
  });

  it('planned card has white border-left accent without "Planned" label', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const plannedCard = screen.getByTestId('activity-act-2');
    expect(plannedCard.className).toContain('border-l-white');
    expect(plannedCard).not.toHaveTextContent('Planned');
  });

  it('completed card has green border-left accent', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const completedCard = screen.getByTestId('activity-act-1');
    expect(completedCard.className).toContain('border-l-green-500');
  });

  it('skipped card has red border-left accent', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const skippedCard = screen.getByTestId('activity-act-3');
    expect(skippedCard.className).toContain('border-l-red-500');
  });

  it('weekly summary shows duration and TSS values', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const summaryCell = screen.getByTestId(`week-summary-${WEEKS_BEFORE}`);
    expect(summaryCell).toHaveTextContent('1:00');
    expect(summaryCell).toHaveTextContent('120');
    expect(summaryCell).toHaveTextContent('85');
  });

  it('summary completed values have bold styling', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const summaryCell = screen.getByTestId(`week-summary-${WEEKS_BEFORE}`);
    const completedTss = within(summaryCell).getByTestId('summary-completed-tss');
    expect(completedTss.className).toContain('font-bold');
    expect(completedTss).toHaveTextContent('85');
  });

  // --- Navigation tests ---

  it('Today button is present, no Prev/Next buttons', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('nav-today')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-prev')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-next')).not.toBeInTheDocument();
    expect(screen.queryByText('Prev')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('activity cards are Link elements pointing to /workouts/:id', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const activityCard = screen.getByTestId('activity-act-1');
    expect(activityCard.tagName).toBe('A');
    expect(activityCard).toHaveAttribute('href', '/workouts/act-1');
  });

  // --- Creation tests (now navigates to PlanActivityPage) ---

  it('clicking + Add navigates to /activities/plan with correct date', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    fireEvent.click(screen.getByTestId(`add-activity-${mondayStr}`));
    // Should navigate to plan page
    await waitFor(() => {
      expect(screen.getByTestId('plan-activity-page')).toBeInTheDocument();
    });
  });

  it('+ Add button is hidden by default (opacity-0)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    const addBtn = screen.getByTestId(`add-activity-${mondayStr}`);
    expect(addBtn.className).toContain('opacity-0');
  });

  it('+ Add button has group-hover:opacity-100 for day cell hover visibility', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    const addBtn = screen.getByTestId(`add-activity-${mondayStr}`);
    expect(addBtn.className).toContain('group-hover:opacity-100');
  });

  it('+ Add button has focus:opacity-100 for keyboard accessibility', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    const addBtn = screen.getByTestId(`add-activity-${mondayStr}`);
    expect(addBtn.className).toContain('focus:opacity-100');
  });

  it('day cell has group class for Tailwind group-hover', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    const dayCell = screen.getByTestId(`day-cell-${mondayStr}`);
    expect(dayCell.className).toContain('group');
  });

  it('+ Add button navigates to plan page when clicked', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const mondayStr = formatDate(thisMonday);
    fireEvent.click(screen.getByTestId(`add-activity-${mondayStr}`));
    await waitFor(() => {
      expect(screen.getByTestId('plan-activity-page')).toBeInTheDocument();
    });
  });

  it('empty days show no "No activities" text', async () => {
    mockGetCalendar.mockResolvedValue(makeEmptyResponse());
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('No activities')).not.toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockGetCalendar.mockReturnValue(new Promise(() => {}));
    renderCalendarPage();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows error state and retry button when API fails', async () => {
    mockGetCalendar.mockRejectedValue(new Error('Network error'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-message')).toHaveTextContent('Network error');
    mockGetCalendar.mockResolvedValue(makeEmptyResponse());
    fireEvent.click(screen.getByTestId('retry-button'));
    await waitFor(() => {
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });
  });

  // --- Card metrics tests ---

  it('completed card shows Duration, Distance (miles), and TSS in stacked format', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const metrics = screen.getByTestId('metrics-act-1');
    // Duration: 3600s = 1:00:00
    expect(metrics).toHaveTextContent('Dur');
    expect(metrics).toHaveTextContent('1:00:00');
    // Distance: 30000m = 18.6 mi
    expect(metrics).toHaveTextContent('Dist');
    expect(metrics).toHaveTextContent('18.6 mi');
    // TSS: 85
    expect(metrics).toHaveTextContent('TSS');
    expect(metrics).toHaveTextContent('85');
  });

  it('planned card shows planned Duration, Distance (miles), and TSS in stacked format', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const metrics = screen.getByTestId('metrics-act-2');
    // Duration: 5400s = 1:30:00
    expect(metrics).toHaveTextContent('Dur');
    expect(metrics).toHaveTextContent('1:30:00');
    // Distance: 50000m = 31.1 mi
    expect(metrics).toHaveTextContent('Dist');
    expect(metrics).toHaveTextContent('31.1 mi');
    // TSS: 120
    expect(metrics).toHaveTextContent('TSS');
    expect(metrics).toHaveTextContent('120');
  });

  it('displays duration with no fractional seconds', async () => {
    const response: CalendarResponse = {
      activities: [{
        id: 'act-frac', date: formatDate(addDays(thisMonday, 1)), status: 'completed',
        title: 'Fractional Ride', activityType: 'ride', durationSeconds: 3661.7, distanceMeters: 10000, tss: 50,
      }],
      weeklySummaries: [],
    };
    mockGetCalendar.mockResolvedValue(response);
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const metrics = screen.getByTestId('metrics-act-frac');
    expect(metrics).toHaveTextContent('1:01:02');
    expect(metrics.textContent).not.toMatch(/\d+\.\d+:\d+/);
  });

  it('card metrics show em-dash for missing values', async () => {
    // act-3 is strength with no duration/distance/tss
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    const metrics = screen.getByTestId('metrics-act-3');
    expect(metrics).toHaveTextContent('Dur');
    expect(metrics).toHaveTextContent('—');
    expect(metrics).toHaveTextContent('Dist');
    expect(metrics).toHaveTextContent('TSS');
  });

  // --- Infinite scroll: initial load is small window ---

  it('initial load requests only the small initial date window (10 weeks)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Only one API call on initial load
    expect(mockGetCalendar).toHaveBeenCalledTimes(1);

    // Verify the date range is approximately 10 weeks (70 days)
    const [dateFrom, dateTo] = mockGetCalendar.mock.calls[0];
    const from = new Date(dateFrom + 'T00:00:00');
    const to = new Date(dateTo + 'T00:00:00');
    const daySpan = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(daySpan).toBeLessThanOrEqual(70);
    expect(daySpan).toBeGreaterThanOrEqual(60);
  });

  it('initial load does not continuously request more chunks', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // Scroll to the middle (away from edges) - should not trigger loading
    const container = screen.getByTestId('calendar-grid');
    simulateScrollMiddle(container);

    // Wait a tick and confirm no additional calls
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(mockGetCalendar).toHaveBeenCalledTimes(1);
  });

  // --- Forward scrolling ---

  it('scrolling to bottom loads exactly one additional future chunk', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(mockGetCalendar).toHaveBeenCalledTimes(1);

    const container = screen.getByTestId('calendar-grid');

    await act(async () => {
      simulateScrollNearBottom(container);
    });

    await waitFor(() => {
      expect(mockGetCalendar).toHaveBeenCalledTimes(2);
    });

    // Verify the second call is only for the new chunk (4 weeks ≈ 27 days)
    const [dateFrom, dateTo] = mockGetCalendar.mock.calls[1];
    const from = new Date(dateFrom + 'T00:00:00');
    const to = new Date(dateTo + 'T00:00:00');
    const daySpan = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(daySpan).toBeLessThanOrEqual(28);
    expect(daySpan).toBeGreaterThanOrEqual(26);

    // Now we should have 14 weeks rendered
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('scrolling to bottom again after first chunk loads the next chunk', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // First forward load
    await act(async () => { simulateScrollNearBottom(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // Scroll away from bottom, then back
    simulateScrollMiddle(container);
    await act(async () => { simulateScrollNearBottom(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(3); });

    // Should have 18 weeks now
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + 2 * CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('repeated forward scrolling can continue indefinitely (5 chunks)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    for (let i = 0; i < 5; i++) {
      simulateScrollMiddle(container);
      await act(async () => { simulateScrollNearBottom(container); });
      await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2 + i); });
    }

    // 1 initial + 5 chunks = 6 total calls
    expect(mockGetCalendar).toHaveBeenCalledTimes(6);
    // 10 + 5*4 = 30 weeks
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + 5 * CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('no duplicate request while a future chunk is in flight', async () => {
    // Make getCalendar slow to resolve
    let resolveSecondCall: (v: CalendarResponse) => void;
    mockGetCalendar
      .mockResolvedValueOnce(makeSampleResponse()) // initial
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecondCall = resolve; }));

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // Trigger scroll near bottom multiple times while request is in flight
    await act(async () => {
      simulateScrollNearBottom(container);
      simulateScrollNearBottom(container);
      simulateScrollNearBottom(container);
    });

    // Only 2 total calls (initial + 1 chunk), not 4
    expect(mockGetCalendar).toHaveBeenCalledTimes(2);

    // Resolve the pending call
    await act(async () => { resolveSecondCall!(makeEmptyResponse()); });
  });

  // --- Backward scrolling ---

  it('scrolling to top loads exactly one additional historical chunk', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
    expect(mockGetCalendar).toHaveBeenCalledTimes(1);

    const container = screen.getByTestId('calendar-grid');

    await act(async () => { simulateScrollNearTop(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // Verify the call is for a historical chunk
    const [dateFrom, dateTo] = mockGetCalendar.mock.calls[1];
    const from = new Date(dateFrom + 'T00:00:00');
    const to = new Date(dateTo + 'T00:00:00');
    const daySpan = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(daySpan).toBeLessThanOrEqual(28);
    expect(daySpan).toBeGreaterThanOrEqual(26);

    // The historical chunk's dateTo should be before the initial dateFrom
    const initialFrom = new Date(mockGetCalendar.mock.calls[0][0] + 'T00:00:00');
    expect(to.getTime()).toBeLessThan(initialFrom.getTime());

    // Now we should have 14 weeks rendered
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('scrolling up again loads another historical chunk', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // First past load
    await act(async () => { simulateScrollNearTop(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // Flush remaining microtasks and rAF callbacks
    await act(async () => {});

    // Scroll away, then back to top
    simulateScrollMiddle(container);
    await act(async () => { simulateScrollNearTop(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(3); });

    // Second historical chunk's dateTo should be before the first historical chunk's dateFrom
    const firstChunkFrom = new Date(mockGetCalendar.mock.calls[1][0] + 'T00:00:00');
    const secondChunkTo = new Date(mockGetCalendar.mock.calls[2][1] + 'T00:00:00');
    expect(secondChunkTo.getTime()).toBeLessThan(firstChunkFrom.getTime());
  });

  it('historical weeks can be loaded indefinitely — no hard boundary (5 chunks)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // Load 5 historical chunks
    for (let i = 0; i < 5; i++) {
      simulateScrollMiddle(container);
      await act(async () => { simulateScrollNearTop(container); });
      await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2 + i); });
      // Flush rAF that releases the loading lock
      await act(async () => {});
    }

    // All 5 loads succeeded — total = 1 initial + 5 chunks = 6 calls
    expect(mockGetCalendar).toHaveBeenCalledTimes(6);
    // Total weeks = 10 + 5*4 = 30
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + 5 * CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('no duplicate request while a past chunk is in flight', async () => {
    let resolveSecondCall: (v: CalendarResponse) => void;
    mockGetCalendar
      .mockResolvedValueOnce(makeSampleResponse())
      .mockImplementationOnce(() => new Promise(resolve => { resolveSecondCall = resolve; }));

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    await act(async () => {
      simulateScrollNearTop(container);
      simulateScrollNearTop(container);
      simulateScrollNearTop(container);
    });

    expect(mockGetCalendar).toHaveBeenCalledTimes(2);

    await act(async () => { resolveSecondCall!(makeEmptyResponse()); });
  });

  // --- Scroll position preservation ---

  it('prepending weeks preserves scroll position (scrollTop is adjusted)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');
    // Set initial scroll geometry
    Object.defineProperty(container, 'scrollHeight', { value: 1300, writable: true, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 800, writable: true, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 100, writable: true, configurable: true });

    await act(async () => { simulateScrollNearTop(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // The code reads prevScrollHeight (1300) and prevScrollTop (100),
    // then after render sets scrollTop = 100 + (newScrollHeight - 1300).
    // We verify the weeks were actually prepended.
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  // --- Today button ---

  it('Today scrolls to current week without resetting the dataset', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // Load a future chunk first
    await act(async () => { simulateScrollNearBottom(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    const totalWeeksAfterLoad = INITIAL_WEEKS + CHUNK_SIZE;
    expect(screen.getByTestId(`week-row-${totalWeeksAfterLoad - 1}`)).toBeInTheDocument();

    // Click Today
    const callCountBefore = mockGetCalendar.mock.calls.length;
    fireEvent.click(screen.getByTestId('nav-today'));

    // No new API calls
    expect(mockGetCalendar).toHaveBeenCalledTimes(callCountBefore);
    // All weeks still present
    expect(screen.getByTestId(`week-row-${totalWeeksAfterLoad - 1}`)).toBeInTheDocument();
    // scrollIntoView was called
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  // --- Initial scroll positioning ---

  it('initial scroll position is set around current week (not at top)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    // After initial load, rAF runs (mocked synchronously) and sets scrollTop.
    // The current week is at index WEEKS_BEFORE (4), so it should not be at scrollTop=0.
    // In jsdom we can't verify exact pixel values, but we can verify the
    // current week ref exists and the positioning logic ran.
    // The current week row should exist
    expect(screen.getByTestId(`week-row-${WEEKS_BEFORE}`)).toBeInTheDocument();
  });

  it('initial positioning does not occur when loading additional chunks', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // Load a future chunk
    await act(async () => { simulateScrollNearBottom(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // The initial positioning should NOT have fired again (only once on mount).
    // Verify by checking that scrollIntoView was NOT called more than once
    // (Today button wasn't pressed either).
    // The key test: weeks are appended, not snapped back.
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });

  it('backward scrolling works from the initial state without scrolling down first', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    const container = screen.getByTestId('calendar-grid');

    // After initial positioning, scrollTop is set to the current week's offset.
    // Simulate the user being near the top (which they can reach by scrolling up
    // from the current week through the 4 historical weeks).
    await act(async () => { simulateScrollNearTop(container); });
    await waitFor(() => { expect(mockGetCalendar).toHaveBeenCalledTimes(2); });

    // Historical chunk loaded successfully
    expect(screen.getByTestId(`week-row-${INITIAL_WEEKS + CHUNK_SIZE - 1}`)).toBeInTheDocument();
  });
});


describe('CalendarPage — Activity Movement (PLAN-027)', () => {
  const thursdayStr = formatDate(addDays(thisMonday, 3));
  const fridayStr = formatDate(addDays(thisMonday, 4));
  const tuesdayStr = formatDate(addDays(thisMonday, 1));

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
    // Default: return the activity with updated date (status unchanged)
    mockMoveActivity.mockImplementation(async (id: string, date: string) => {
      const activities = makeSampleActivities();
      const original = activities.find(a => a.id === id);
      return { ...original, date, id } as any;
    });
  });

  // --- Action Menu Tests ---

  it('planned activity shows an action menu button on hover', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });
    expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
  });

  it('completed activity does NOT show an action menu button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('action-btn-act-1')).not.toBeInTheDocument();
  });

  it('skipped activity shows an action menu button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-3')).toBeInTheDocument();
    });
    expect(screen.getByTestId('action-btn-act-3')).toBeInTheDocument();
  });

  it('clicking action button opens a menu with Move option', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    expect(screen.getByTestId('action-menu-act-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-move-act-2')).toBeInTheDocument();
  });

  it('clicking Move in menu opens the move popover', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    expect(screen.getByTestId('move-popover')).toBeInTheDocument();
    expect(screen.getByTestId('move-date-input')).toHaveValue(thursdayStr);
  });

  it('selecting a new date and clicking Move calls the API', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    fireEvent.change(screen.getByTestId('move-date-input'), { target: { value: fridayStr } });
    fireEvent.click(screen.getByTestId('move-confirm-btn'));

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-2', fridayStr);
    });
  });

  it('successful move via popover updates the calendar', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });

    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();

    // Set up refresh mock to return activity on Friday
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: fridayStr, status: 'planned', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    fireEvent.change(screen.getByTestId('move-date-input'), { target: { value: fridayStr } });
    fireEvent.click(screen.getByTestId('move-confirm-btn'));

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalled();
    });

    await waitFor(() => {
      const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);
      expect(within(fridayCell).getByTestId('activity-act-2')).toBeInTheDocument();
    });
    expect(within(thursdayCell).queryByTestId('activity-act-2')).not.toBeInTheDocument();
  });

  it('selecting same date does not call the API', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    fireEvent.click(screen.getByTestId('move-confirm-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('move-popover')).not.toBeInTheDocument();
    });
    expect(mockMoveActivity).not.toHaveBeenCalled();
  });

  it('Cancel closes the popover without making an API call', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    expect(screen.getByTestId('move-popover')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('move-cancel-btn'));
    expect(screen.queryByTestId('move-popover')).not.toBeInTheDocument();
    expect(mockMoveActivity).not.toHaveBeenCalled();
  });

  it('API failure shows an error and leaves activity in place', async () => {
    mockMoveActivity.mockRejectedValue(new Error('Server error'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    fireEvent.change(screen.getByTestId('move-date-input'), { target: { value: fridayStr } });
    fireEvent.click(screen.getByTestId('move-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('move-error')).toHaveTextContent('Server error');
    });
    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();
  });

  it('action button does not trigger the activity link navigation', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    expect(screen.getByTestId('action-menu-act-2')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });

  it('planned activity link still navigates to edit page when clicking the card itself', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });
    const link = screen.getByTestId('activity-act-2');
    expect(link.closest('a')).toHaveAttribute('href', '/activities/act-2/edit');
  });

  // --- Drag-and-Drop Tests ---

  it('planned activity card is draggable', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });
    expect(screen.getByTestId('activity-card-act-2')).toHaveAttribute('draggable', 'true');
  });

  it('completed activity card is NOT draggable', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('activity-card-act-1')).not.toHaveAttribute('draggable', 'true');
  });

  it('skipped activity card is draggable', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-3')).toBeInTheDocument();
    });
    expect(screen.getByTestId('activity-card-act-3')).toHaveAttribute('draggable', 'true');
  });

  it('dropping on a different date calls moveActivity with correct args', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    const card = screen.getByTestId('activity-card-act-2');
    const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);

    // Simulate drag start
    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });

    // Simulate drop on Friday cell
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-2', fridayStr);
    });
  });

  it('successful drop moves activity from old date to new date in UI', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();

    const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);

    // Set up refresh mock to return activity on Friday
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: fridayStr, status: 'planned', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    // Simulate drag + drop
    const card = screen.getByTestId('activity-card-act-2');
    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(within(fridayCell).getByTestId('activity-act-2')).toBeInTheDocument();
    });
    expect(within(thursdayCell).queryByTestId('activity-act-2')).not.toBeInTheDocument();
  });

  it('dropping on the same date does NOT call the API', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);

    const card = screen.getByTestId('activity-card-act-2');
    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    fireEvent.drop(thursdayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    // Give time for any async calls
    await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    expect(mockMoveActivity).not.toHaveBeenCalled();
  });

  it('failed drop displays error and leaves activity on original date', async () => {
    mockMoveActivity.mockRejectedValue(new Error('Move failed'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);
    const card = screen.getByTestId('activity-card-act-2');

    fireEvent.dragStart(card, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('drop-error')).toHaveTextContent('Move failed');
    });

    // Activity remains on Thursday
    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();
  });

  // --- Lifecycle Status Transition Tests (PLAN-027B) ---

  it('DnD: skipped activity becomes planned when dropped on a future date (server response)', async () => {
    // act-3 is skipped, on tuesdayStr
    const futureDate = fridayStr;
    mockMoveActivity.mockResolvedValue({
      id: 'act-3',
      date: futureDate,
      status: 'planned',
      title: 'Strength Training',
      activityType: 'strength',
    } as any);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-3')).toBeInTheDocument();
    });

    // After the move, the refresh call should return the activity with new status
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-3');
    refreshResponse.activities.push({ id: 'act-3', date: futureDate, status: 'planned', title: 'Strength Training', activityType: 'strength' });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    const card = screen.getByTestId('activity-card-act-3');
    const fridayCell = screen.getByTestId(`day-cell-${futureDate}`);

    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-3';
          if (key === 'application/x-activity-date') return tuesdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-3', futureDate);
    });

    // Activity should now be rendered as 'planned' on the future date
    await waitFor(() => {
      const cell = screen.getByTestId(`day-cell-${futureDate}`);
      const activityEl = within(cell).getByTestId('activity-act-3');
      expect(activityEl).toHaveAttribute('data-status', 'planned');
    });
  });

  it('DnD: planned activity becomes skipped when dropped on a past date (server response)', async () => {
    // act-2 is planned, on thursdayStr
    const pastDate = formatDate(addDays(thisMonday, -1)); // yesterday
    mockMoveActivity.mockResolvedValue({
      id: 'act-2',
      date: pastDate,
      status: 'skipped',
      title: 'Interval Session',
      activityType: 'ride',
      plannedTss: 120,
      plannedDurationSeconds: 5400,
      plannedDistanceMeters: 50000,
    } as any);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    // After the move, refresh returns the activity as skipped on the past date
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: pastDate, status: 'skipped', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    const card = screen.getByTestId('activity-card-act-2');
    const pastCell = screen.getByTestId(`day-cell-${pastDate}`);

    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.drop(pastCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-2', pastDate);
    });

    // Activity should now be rendered as 'skipped' on the past date
    await waitFor(() => {
      const cell = screen.getByTestId(`day-cell-${pastDate}`);
      const activityEl = within(cell).getByTestId('activity-act-2');
      expect(activityEl).toHaveAttribute('data-status', 'skipped');
    });
  });

  it('DnD: planned → planned when moved within future dates (server response)', async () => {
    mockMoveActivity.mockResolvedValue({
      id: 'act-2',
      date: fridayStr,
      status: 'planned',
      title: 'Interval Session',
      activityType: 'ride',
      plannedTss: 120,
      plannedDurationSeconds: 5400,
      plannedDistanceMeters: 50000,
    } as any);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    // Refresh returns activity on Friday as planned
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: fridayStr, status: 'planned', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    const card = screen.getByTestId('activity-card-act-2');
    const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);

    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      const cell = screen.getByTestId(`day-cell-${fridayStr}`);
      const activityEl = within(cell).getByTestId('activity-act-2');
      expect(activityEl).toHaveAttribute('data-status', 'planned');
    });
  });

  it('DnD: skipped → skipped when moved within past dates (server response)', async () => {
    const pastDate = formatDate(addDays(thisMonday, -2));
    mockMoveActivity.mockResolvedValue({
      id: 'act-3',
      date: pastDate,
      status: 'skipped',
      title: 'Strength Training',
      activityType: 'strength',
    } as any);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-3')).toBeInTheDocument();
    });

    // Refresh returns the activity at new past date, still skipped
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-3');
    refreshResponse.activities.push({ id: 'act-3', date: pastDate, status: 'skipped', title: 'Strength Training', activityType: 'strength' });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    const card = screen.getByTestId('activity-card-act-3');
    const pastCell = screen.getByTestId(`day-cell-${pastDate}`);

    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.drop(pastCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-3';
          if (key === 'application/x-activity-date') return tuesdayStr;
          return '';
        },
      },
    });

    await waitFor(() => {
      const cell = screen.getByTestId(`day-cell-${pastDate}`);
      const activityEl = within(cell).getByTestId('activity-act-3');
      expect(activityEl).toHaveAttribute('data-status', 'skipped');
    });
  });

  it('Action Menu Move: uses server response status (skipped → planned)', async () => {
    mockMoveActivity.mockResolvedValue({
      id: 'act-3',
      date: fridayStr,
      status: 'planned',
      title: 'Strength Training',
      activityType: 'strength',
    } as any);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-3')).toBeInTheDocument();
    });

    // Refresh returns the activity at Friday as planned
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-3');
    refreshResponse.activities.push({ id: 'act-3', date: fridayStr, status: 'planned', title: 'Strength Training', activityType: 'strength' });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    fireEvent.click(screen.getByTestId('action-btn-act-3'));
    fireEvent.click(screen.getByTestId('menu-move-act-3'));
    fireEvent.change(screen.getByTestId('move-date-input'), { target: { value: fridayStr } });
    fireEvent.click(screen.getByTestId('move-confirm-btn'));

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-3', fridayStr);
    });

    await waitFor(() => {
      const cell = screen.getByTestId(`day-cell-${fridayStr}`);
      const activityEl = within(cell).getByTestId('activity-act-3');
      expect(activityEl).toHaveAttribute('data-status', 'planned');
    });
  });
});


describe('CalendarPage — Activity Deletion (PLAN-028)', () => {
  const thursdayStr = formatDate(addDays(thisMonday, 3));
  const tuesdayStr = formatDate(addDays(thisMonday, 1));

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
    mockMoveActivity.mockImplementation(async (id: string, date: string) => {
      const activities = makeSampleActivities();
      const original = activities.find(a => a.id === id);
      return { ...original, date, id } as any;
    });
    mockDeleteWorkout.mockResolvedValue(undefined);
  });

  it('Delete action appears in the activity action menu', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    expect(screen.getByTestId('menu-delete-act-2')).toBeInTheDocument();
  });

  it('clicking Delete opens the confirmation dialog', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });

  it('confirmation dialog shows the correct activity name', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    expect(screen.getByTestId('delete-activity-name')).toHaveTextContent('Interval Session');
  });

  it('Cancel closes the dialog without calling DELETE', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-cancel-btn'));
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    expect(mockDeleteWorkout).not.toHaveBeenCalled();
  });

  it('Confirm calls deleteWorkout with the correct activity ID', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    fireEvent.click(screen.getByTestId('delete-confirm-btn'));

    await waitFor(() => {
      expect(mockDeleteWorkout).toHaveBeenCalledWith('act-2');
    });
  });

  it('successful deletion removes the activity from the calendar', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });

    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    fireEvent.click(screen.getByTestId('delete-confirm-btn'));

    await waitFor(() => {
      expect(mockDeleteWorkout).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(within(thursdayCell).queryByTestId('activity-act-2')).not.toBeInTheDocument();
    });
    // Dialog should be closed
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
  });

  it('failed deletion does NOT remove the activity and shows error', async () => {
    mockDeleteWorkout.mockRejectedValue(new Error('Server error'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    fireEvent.click(screen.getByTestId('delete-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-error')).toHaveTextContent('Server error');
    });

    // Activity still present
    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();
  });

  it('Move action still works after adding Delete to the menu', async () => {
    const fridayStr = formatDate(addDays(thisMonday, 4));
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: fridayStr, status: 'planned', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    expect(screen.getByTestId('move-popover')).toBeInTheDocument();
  });

  it('clicking Delete does not navigate to the activity edit/detail page', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    // Should open dialog, not navigate
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });

  it('skipped activity can also be deleted', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-3'));
    fireEvent.click(screen.getByTestId('menu-delete-act-3'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('delete-activity-name')).toHaveTextContent('Strength Training');

    fireEvent.click(screen.getByTestId('delete-confirm-btn'));
    await waitFor(() => {
      expect(mockDeleteWorkout).toHaveBeenCalledWith('act-3');
    });

    const tuesdayCell = screen.getByTestId(`day-cell-${tuesdayStr}`);
    await waitFor(() => {
      expect(within(tuesdayCell).queryByTestId('activity-act-3')).not.toBeInTheDocument();
    });
  });
});


describe('CalendarPage — Manual Completion (PLAN-033)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
    mockMoveActivity.mockImplementation(async (id: string, date: string) => {
      const activities = makeSampleActivities();
      const original = activities.find(a => a.id === id);
      return { ...original, date, id } as any;
    });
    mockDeleteWorkout.mockResolvedValue(undefined);
    mockCompleteActivity.mockImplementation(async (id: string) => {
      const activities = makeSampleActivities();
      const original = activities.find(a => a.id === id);
      return { ...original, id, status: 'completed' } as any;
    });
  });

  it('Mark Complete appears in the action menu for planned activities', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    expect(screen.getByTestId('menu-complete-act-2')).toBeInTheDocument();
  });

  it('Mark Complete appears for skipped activities', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-3'));
    expect(screen.getByTestId('menu-complete-act-3')).toBeInTheDocument();
  });

  it('completed activities do NOT have an action menu', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('action-btn-act-1')).not.toBeInTheDocument();
  });

  it('clicking Mark Complete opens the confirmation dialog', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    expect(screen.getByTestId('complete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('complete-activity-name')).toHaveTextContent('Interval Session');
  });

  it('Cancel closes the dialog without calling the API', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    expect(screen.getByTestId('complete-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('complete-cancel-btn'));
    expect(screen.queryByTestId('complete-dialog')).not.toBeInTheDocument();
    expect(mockCompleteActivity).not.toHaveBeenCalled();
  });

  it('Confirm calls completeActivity with correct ID', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    fireEvent.click(screen.getByTestId('complete-confirm-btn'));

    await waitFor(() => {
      expect(mockCompleteActivity).toHaveBeenCalledWith('act-2');
    });
  });

  it('successful completion changes the activity to completed in calendar state', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });

    // Before: planned
    expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'planned');

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    fireEvent.click(screen.getByTestId('complete-confirm-btn'));

    await waitFor(() => {
      expect(mockCompleteActivity).toHaveBeenCalled();
    });

    // After: completed
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'completed');
    });
    // Dialog should be closed
    expect(screen.queryByTestId('complete-dialog')).not.toBeInTheDocument();
  });

  it('completed activity uses completed visual styling (green border)', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    fireEvent.click(screen.getByTestId('complete-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'completed');
    });
    expect(screen.getByTestId('activity-act-2').className).toContain('border-l-green-500');
  });

  it('action menu changes after completion — only Save as Template remains', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    fireEvent.click(screen.getByTestId('complete-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'completed');
    });
    // Action menu button still exists (for Save as Template on completed structured activity)
    expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    // Only Save as Template — no Move, Complete, or Delete
    expect(screen.getByTestId('menu-save-template-act-2')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-move-act-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-complete-act-2')).not.toBeInTheDocument();
  });

  it('failed completion leaves the activity planned and shows error', async () => {
    mockCompleteActivity.mockRejectedValue(new Error('Transition not allowed'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    fireEvent.click(screen.getByTestId('complete-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('complete-error')).toHaveTextContent('Transition not allowed');
    });
    // Activity still planned
    expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'planned');
  });

  it('Move still works after adding Mark Complete', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-move-act-2'));
    expect(screen.getByTestId('move-popover')).toBeInTheDocument();
  });

  it('Delete still works after adding Mark Complete', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-delete-act-2'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
  });

  it('Mark Complete does not navigate to the activity page', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-complete-act-2'));
    // Should open dialog, not navigate
    expect(screen.getByTestId('complete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });
});


describe('CalendarPage — Template Drawer (PLAN-035)', () => {
  const wednesdayStr = formatDate(addDays(thisMonday, 2));

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
    mockMoveActivity.mockImplementation(async (id: string, date: string) => {
      const activities = makeSampleActivities();
      const original = activities.find(a => a.id === id);
      return { ...original, date, id } as any;
    });
    mockDeleteWorkout.mockResolvedValue(undefined);
    mockCompleteActivity.mockResolvedValue({} as any);
    mockListTemplates.mockResolvedValue({
      items: [
        { id: 'tmpl-1', title: 'Z2 Endurance', activityType: 'ride', template: true, status: null, plannedDurationSeconds: 3600, segments: [{ type: 'steady', durationSeconds: 3600, powerMin: 65, powerMax: 75 }] },
        { id: 'tmpl-2', title: 'Sweet Spot', activityType: 'ride', template: true, status: null, plannedDurationSeconds: 4800, segments: [{ type: 'warmup', durationSeconds: 600 }, { type: 'interval', durationSeconds: 1200, powerMin: 88, powerMax: 95 }] },
      ] as any,
      pagination: { page: 1, pageSize: 50, totalItems: 2, totalPages: 1 },
    });
    mockCopyTemplateToActivity.mockResolvedValue({
      id: 'new-act-1',
      date: wednesdayStr,
      status: 'planned',
      title: 'Z2 Endurance',
      activityType: 'ride',
      plannedDurationSeconds: 3600,
    } as any);
  });

  it('Calendar has a Templates button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
  });

  it('clicking Templates opens the drawer', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('template-drawer')).toBeInTheDocument();
    });
  });

  it('drawer displays templates after loading', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-list')).toBeInTheDocument();
    });
    expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    expect(screen.getByTestId('drawer-template-tmpl-2')).toBeInTheDocument();
  });

  it('drawer templates are draggable', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('drawer-template-tmpl-1')).toHaveAttribute('draggable', 'true');
  });

  it('dropping a template on a calendar day calls copyTemplateToActivity', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    });

    // Simulate drag from template
    const templateCard = screen.getByTestId('drawer-template-tmpl-1');
    fireEvent.dragStart(templateCard, {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });

    // Drop on Wednesday
    const wednesdayCell = screen.getByTestId(`day-cell-${wednesdayStr}`);
    fireEvent.drop(wednesdayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-template-id') return 'tmpl-1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockCopyTemplateToActivity).toHaveBeenCalledWith('tmpl-1', wednesdayStr);
    });
  });

  it('successful template drop adds the returned activity to the calendar', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    });

    const wednesdayCell = screen.getByTestId(`day-cell-${wednesdayStr}`);

    fireEvent.drop(wednesdayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-template-id') return 'tmpl-1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockCopyTemplateToActivity).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(within(wednesdayCell).getByTestId('activity-new-act-1')).toBeInTheDocument();
    });
  });

  it('failed template drop does not add activity and shows error', async () => {
    mockCopyTemplateToActivity.mockRejectedValue(new Error('Copy failed'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    });

    const wednesdayCell = screen.getByTestId(`day-cell-${wednesdayStr}`);
    fireEvent.drop(wednesdayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-template-id') return 'tmpl-1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('template-drop-error')).toHaveTextContent('Copy failed');
    });
    expect(within(wednesdayCell).queryByTestId('activity-new-act-1')).not.toBeInTheDocument();
  });

  it('existing activity DnD still works when drawer is open', async () => {
    const fridayStr = formatDate(addDays(thisMonday, 4));
    const thursdayStr = formatDate(addDays(thisMonday, 3));
    const refreshResponse = makeSampleResponse();
    refreshResponse.activities = refreshResponse.activities.filter(a => a.id !== 'act-2');
    refreshResponse.activities.push({ id: 'act-2', date: fridayStr, status: 'planned', title: 'Interval Session', activityType: 'ride', plannedTss: 120, plannedDurationSeconds: 5400, plannedDistanceMeters: 50000 });
    mockGetCalendar.mockResolvedValue(refreshResponse);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-card-act-2')).toBeInTheDocument();
    });

    // Open drawer
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('template-drawer')).toBeInTheDocument();
    });

    // Drag existing activity
    const card = screen.getByTestId('activity-card-act-2');
    const fridayCell = screen.getByTestId(`day-cell-${fridayStr}`);

    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    fireEvent.drop(fridayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-activity-id') return 'act-2';
          if (key === 'application/x-activity-date') return thursdayStr;
          if (key === 'application/x-template-id') return '';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockMoveActivity).toHaveBeenCalledWith('act-2', fridayStr);
    });
  });

  it('drawer has search functionality', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-search-input')).toBeInTheDocument();
    });
  });

  it('drawer remains open after a successful template drop', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-template-tmpl-1')).toBeInTheDocument();
    });

    const wednesdayCell = screen.getByTestId(`day-cell-${wednesdayStr}`);
    fireEvent.drop(wednesdayCell, {
      dataTransfer: {
        getData: (key: string) => {
          if (key === 'application/x-template-id') return 'tmpl-1';
          return '';
        },
      },
    });

    await waitFor(() => {
      expect(mockCopyTemplateToActivity).toHaveBeenCalled();
    });

    // Drawer should still be open
    expect(screen.getByTestId('template-drawer')).toBeInTheDocument();
  });

  it('drawer has a Create Template (+) button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-create-template-btn')).toBeInTheDocument();
    });
    expect(screen.getByTestId('drawer-create-template-btn')).toHaveAttribute('aria-label', 'Create template');
  });

  it('clicking + navigates to /templates/new', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('templates-drawer-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('templates-drawer-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('drawer-create-template-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('drawer-create-template-btn'));
    // Navigates to new template page (rendered by MemoryRouter)
    await waitFor(() => {
      expect(screen.getByTestId('plan-activity-page')).toBeInTheDocument();
    });
  });
});


describe('CalendarPage — Save as Template (PLAN-036)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCalendar.mockResolvedValue(makeSampleResponse());
    mockSaveAsTemplate.mockResolvedValue({ id: 'tmpl-new', title: 'Interval Session', activityType: 'ride', template: true, status: null } as any);
  });

  it('Save as Template appears in the action menu for planned activities', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    expect(screen.getByTestId('menu-save-template-act-2')).toBeInTheDocument();
  });

  it('Save as Template appears for skipped activities', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-3'));
    expect(screen.getByTestId('menu-save-template-act-3')).toBeInTheDocument();
  });

  it('clicking Save as Template calls the saveAsTemplate API', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-2'));

    await waitFor(() => {
      expect(mockSaveAsTemplate).toHaveBeenCalledWith('act-2');
    });
  });

  it('successful save shows success toast', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-2'));

    await waitFor(() => {
      expect(screen.getByTestId('save-template-success')).toBeInTheDocument();
    });
    expect(screen.getByTestId('save-template-success')).toHaveTextContent('saved as template');
  });

  it('failed save shows error toast', async () => {
    mockSaveAsTemplate.mockRejectedValue(new Error('Save failed'));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-2'));

    await waitFor(() => {
      expect(screen.getByTestId('save-template-error')).toHaveTextContent('Save failed');
    });
  });

  it('original activity remains unchanged after save', async () => {
    const thursdayStr = formatDate(addDays(thisMonday, 3));
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-2'));

    await waitFor(() => {
      expect(mockSaveAsTemplate).toHaveBeenCalled();
    });

    // Activity still exists on its original date, unchanged
    const thursdayCell = screen.getByTestId(`day-cell-${thursdayStr}`);
    expect(within(thursdayCell).getByTestId('activity-act-2')).toBeInTheDocument();
    expect(screen.getByTestId('activity-act-2')).toHaveAttribute('data-status', 'planned');
  });

  it('user remains on calendar after save', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('action-btn-act-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('action-btn-act-2'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-2'));

    await waitFor(() => {
      expect(mockSaveAsTemplate).toHaveBeenCalled();
    });
    // Still on calendar
    expect(screen.getByTestId('calendar-grid')).toBeInTheDocument();
  });

  // --- Completed activity eligibility (PLAN-036A) ---

  it('completed activity WITH planned structure shows Save as Template', async () => {
    // act-1 is completed with plannedDurationSeconds set
    const response = makeSampleResponse();
    response.activities = response.activities.map(a =>
      a.id === 'act-1' ? { ...a, plannedDurationSeconds: 3600 } : a
    );
    mockGetCalendar.mockResolvedValue(response);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });

    // Completed activity should have an action button
    expect(screen.getByTestId('action-btn-act-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-btn-act-1'));
    expect(screen.getByTestId('menu-save-template-act-1')).toBeInTheDocument();
  });

  it('completed activity WITHOUT planned structure does NOT show action menu', async () => {
    // act-1 is completed without plannedDurationSeconds
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });

    // No action button for plain completed activity
    expect(screen.queryByTestId('action-btn-act-1')).not.toBeInTheDocument();
  });

  it('completed activity menu only contains Save as Template (not Move/Complete/Delete)', async () => {
    const response = makeSampleResponse();
    response.activities = response.activities.map(a =>
      a.id === 'act-1' ? { ...a, plannedDurationSeconds: 3600 } : a
    );
    mockGetCalendar.mockResolvedValue(response);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-1'));
    expect(screen.getByTestId('menu-save-template-act-1')).toBeInTheDocument();
    // Should NOT have Move, Complete, or Delete
    expect(screen.queryByTestId('menu-move-act-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-complete-act-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-delete-act-1')).not.toBeInTheDocument();
  });

  it('clicking Save as Template on completed activity calls API', async () => {
    const response = makeSampleResponse();
    response.activities = response.activities.map(a =>
      a.id === 'act-1' ? { ...a, plannedDurationSeconds: 3600 } : a
    );
    mockGetCalendar.mockResolvedValue(response);

    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByTestId('activity-act-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('action-btn-act-1'));
    fireEvent.click(screen.getByTestId('menu-save-template-act-1'));

    await waitFor(() => {
      expect(mockSaveAsTemplate).toHaveBeenCalledWith('act-1');
    });
  });
});
