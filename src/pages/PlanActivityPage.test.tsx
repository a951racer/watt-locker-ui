import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PlanActivityPage from './PlanActivityPage';
import * as workoutsApi from '../api/workouts';
import * as settingsApi from '../api/settings';

vi.mock('../api/workouts', () => ({
  createActivity: vi.fn(),
  getWorkout: vi.fn(),
  updateWorkout: vi.fn(),
  createTemplate: vi.fn(),
}));

vi.mock('../api/settings', () => ({
  getSettings: vi.fn(),
}));

const mockCreateActivity = vi.mocked(workoutsApi.createActivity);
const mockGetWorkout = vi.mocked(workoutsApi.getWorkout);
const mockUpdateWorkout = vi.mocked(workoutsApi.updateWorkout);
const mockCreateTemplate = vi.mocked(workoutsApi.createTemplate);
const mockGetSettings = vi.mocked(settingsApi.getSettings);

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPlanPage(route = '/activities/plan?date=2024-06-15') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/activities/plan" element={<PlanActivityPage />} />
        <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        <Route path="/calendar" element={<div>Calendar</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlanActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue({
      id: 'new-1',
      date: '2024-06-15',
      status: 'planned',
      activityType: 'ride',
    });
    // Default: user has FTP of 250W configured
    mockGetSettings.mockResolvedValue({
      userId: 'user-1',
      driveStoragePath: '/uploads',
      driveInboxPath: '/inbox',
      connectedSources: [],
      ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }],
      timezone: 'America/Chicago',
      updatedAt: '2024-06-01T00:00:00Z',
    });
  });

  // --- Basic Rendering ---

  it('renders the plan activity page with title', () => {
    renderPlanPage();
    expect(screen.getByTestId('plan-activity-page')).toBeInTheDocument();
    expect(screen.getByTestId('page-title')).toHaveTextContent('Plan Activity');
  });

  it('pre-populates date from query param', () => {
    renderPlanPage('/activities/plan?date=2024-06-15');
    const dateInput = screen.getByTestId('activity-date-input') as HTMLInputElement;
    expect(dateInput.value).toBe('2024-06-15');
  });

  it('has all required form sections', () => {
    renderPlanPage();
    // Header fields always visible
    expect(screen.getByTestId('activity-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('activity-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('activity-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('activity-description-input')).toBeInTheDocument();

    // Activity Details always visible (no expand needed)
    expect(screen.getByTestId('intensity-metric-select')).toBeInTheDocument();
    expect(screen.getByTestId('duration-input')).toBeInTheDocument();
    expect(screen.getByTestId('distance-input')).toBeInTheDocument();
    expect(screen.getByTestId('target-speed-input')).toBeInTheDocument();
    expect(screen.getByTestId('planned-tss-input')).toBeInTheDocument();
    expect(screen.getByTestId('planned-if-input')).toBeInTheDocument();
    expect(screen.getByTestId('tags-input')).toBeInTheDocument();
    expect(screen.getByTestId('equipment-input')).toBeInTheDocument();
    expect(screen.getByTestId('event-id-input')).toBeInTheDocument();
  });

  it('has all activity type options', () => {
    renderPlanPage();
    const select = screen.getByTestId('activity-type-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('ride');
    expect(options).toContain('virtual_ride');
    expect(options).toContain('mountain_ride');
    expect(options).toContain('gravel_ride');
    expect(options).toContain('run');
    expect(options).toContain('swim');
    expect(options).toContain('walk');
    expect(options).toContain('strength');
    expect(options).toContain('other');
  });

  it('has all intensity metric options including power_watts', () => {
    renderPlanPage();
    const select = screen.getByTestId('intensity-metric-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('power_ftp');
    expect(options).toContain('hr_threshold');
    expect(options).toContain('hr_max');
    expect(options).toContain('power_watts');
  });

  // --- Form Submission ---

  it('submits create with basic fields and navigates to /calendar', async () => {
    renderPlanPage();

    fireEvent.change(screen.getByTestId('activity-type-select'), { target: { value: 'ride' } });
    fireEvent.change(screen.getByTestId('activity-title-input'), { target: { value: 'Morning Ride' } });
    fireEvent.change(screen.getByTestId('duration-input'), { target: { value: '1:30:00' } });
    fireEvent.change(screen.getByTestId('distance-input'), { target: { value: '25' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
        date: '2024-06-15',
        activityType: 'ride',
        title: 'Morning Ride',
        plannedDurationSeconds: 5400,
        plannedDistanceMeters: 40234,
      }));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  it('converts miles to meters (1 mile = 1609.344 meters)', async () => {
    renderPlanPage();

    fireEvent.change(screen.getByTestId('distance-input'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
        plannedDistanceMeters: 16093,
      }));
    });
  });

  it('converts duration H:MM:SS text to seconds', async () => {
    renderPlanPage();

    fireEvent.change(screen.getByTestId('duration-input'), { target: { value: '2:15:30' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
        plannedDurationSeconds: 8130,
      }));
    });
  });

  it('shows error on submission failure and preserves form', async () => {
    mockCreateActivity.mockRejectedValue(new Error('Server error'));
    renderPlanPage();

    fireEvent.change(screen.getByTestId('activity-title-input'), { target: { value: 'My Ride' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('submit-error')).toHaveTextContent('Server error');
    });
    // Form still present
    expect((screen.getByTestId('activity-title-input') as HTMLInputElement).value).toBe('My Ride');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('prevents double-submit', async () => {
    let resolveCreate: (v: any) => void;
    mockCreateActivity.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    renderPlanPage();

    fireEvent.click(screen.getByTestId('submit-btn'));
    fireEvent.click(screen.getByTestId('submit-btn'));
    fireEvent.click(screen.getByTestId('submit-btn'));

    expect(mockCreateActivity).toHaveBeenCalledTimes(1);

    await act(async () => { resolveCreate!({ id: '1', date: '2024-06-15', status: 'planned', activityType: 'ride' }); });
  });

  it('cancel button navigates to /calendar', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('includes TSS and tags in submission', async () => {
    renderPlanPage();

    fireEvent.change(screen.getByTestId('planned-tss-input'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('planned-if-input'), { target: { value: '0.85' } });
    fireEvent.change(screen.getByTestId('tags-input'), { target: { value: 'intervals, threshold' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
        plannedTss: 100,
        plannedIf: 0.85,
        tags: ['intervals', 'threshold'],
      }));
    });
  });

  // --- Duration derived from steps ---

  it('shows duration as read-only when steps exist', () => {
    renderPlanPage();
    // Before adding steps, duration is editable
    const input = screen.getByTestId('duration-input');
    expect(input.tagName).toBe('INPUT');

    // Add a step
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Now duration should be read-only (div, not input)
    const durationEl = screen.getByTestId('duration-input');
    expect(durationEl.tagName).toBe('DIV');
  });

  // --- Segment Builder ---

  it('shows segment builder section', () => {
    renderPlanPage();
    expect(screen.getByTestId('segment-builder-section')).toBeInTheDocument();
    expect(screen.getByTestId('add-segment-btn')).toBeInTheDocument();
  });

  it('adds a segment when clicking add segment button', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    // Click a step type from the dropdown menu
    fireEvent.click(screen.getByTestId('add-step-interval'));
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();
  });

  it('removes a segment', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    expect(screen.getByTestId('segment-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('segment-0-remove'));
    expect(screen.queryByTestId('segment-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();
  });

  it('moves segment up', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand second segment and change type to warmup
    fireEvent.click(screen.getByTestId('segment-1'));
    fireEvent.change(screen.getByTestId('segment-1-type'), { target: { value: 'warmup' } });
    fireEvent.click(screen.getByTestId('segment-1-move-up'));

    // Now the first segment should be warmup — expand it to check
    fireEvent.click(screen.getByTestId('segment-0'));
    expect((screen.getByTestId('segment-0-type') as HTMLSelectElement).value).toBe('warmup');
  });

  it('moves segment down', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand first segment and change type to cooldown
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-type'), { target: { value: 'cooldown' } });
    fireEvent.click(screen.getByTestId('segment-0-move-down'));

    // Now the second segment should be cooldown — expand it to check
    fireEvent.click(screen.getByTestId('segment-1'));
    expect((screen.getByTestId('segment-1-type') as HTMLSelectElement).value).toBe('cooldown');
  });

  it('segment types include warmup, interval, recovery, cooldown, steady', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    // Expand the segment to see the type dropdown
    fireEvent.click(screen.getByTestId('segment-0'));
    const select = screen.getByTestId('segment-0-type') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['warmup', 'interval', 'recovery', 'cooldown', 'steady']);
  });

  it('includes segments in submission', async () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand and edit the segment
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-type'), { target: { value: 'warmup' } });
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '0:10:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '150' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '180' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalledWith(expect.objectContaining({
        segments: [expect.objectContaining({
          type: 'warmup',
          durationSeconds: 600,
          powerMin: 150,
          powerMax: 180,
        })],
      }));
    });
  });

  it('step metric override includes Watts option', () => {
    renderPlanPage();
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('segment-0'));
    const select = screen.getByTestId('segment-0-metric') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('');
    expect(options).toContain('power_ftp');
    expect(options).toContain('hr_threshold');
    expect(options).toContain('hr_max');
    expect(options).toContain('power_watts');
  });

  // --- Repeat Functionality ---

  it('repeat expands segments into flat array', () => {
    renderPlanPage();
    // Add 2 segments
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand and change types
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-type'), { target: { value: 'interval' } });
    fireEvent.click(screen.getByTestId('segment-1'));
    fireEvent.change(screen.getByTestId('segment-1-type'), { target: { value: 'recovery' } });

    // Set repeat: from 0 to 1, count 3
    fireEvent.change(screen.getByTestId('repeat-start-input'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('repeat-end-input'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('repeat-count-input'), { target: { value: '3' } });
    fireEvent.click(screen.getByTestId('repeat-btn'));

    // Should now have 6 segments (2 * 3)
    expect(screen.getByTestId('segment-5')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-6')).not.toBeInTheDocument();
  });

  // --- TSS/IF Preview ---

  it('shows segment preview using user FTP from settings', async () => {
    renderPlanPage();
    // Wait for settings to load (FTP = 250W)
    await waitFor(() => {
      expect(mockGetSettings).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand and set values (80% FTP with FTP=250 → 200W)
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // 80% of FTP 250 = 200W. TSS = (3600 * (200/250)^2) / 3600 * 100 = 64
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 64');
    // IF = 200/250 = 0.80
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: 0.80');
    expect(screen.getByTestId('preview-duration')).toHaveTextContent('Duration: 1:00:00');
  });

  it('shows FTP unavailable warning when no FTP is configured', async () => {
    mockGetSettings.mockResolvedValue({
      userId: 'user-1',
      driveStoragePath: '/uploads',
      driveInboxPath: '/inbox',
      connectedSources: [],
      ftpHistory: [],
      timezone: 'America/Chicago',
      updatedAt: '2024-06-01T00:00:00Z',
    });
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '200' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '200' } });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // TSS/IF should show em-dash (not available)
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: —');
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: —');
    expect(screen.getByTestId('ftp-unavailable-warning')).toBeInTheDocument();
  });

  it('manual plannedTss overrides segment calculation', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    // Manually enter TSS override
    fireEvent.change(screen.getByTestId('planned-tss-input'), { target: { value: '85' } });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // Manual override takes precedence
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 85');
    // IF is derived from manual TSS: sqrt(85 / (3600/3600)) = sqrt(85) / 1 ≈ 0.92
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: 0.92');
  });

  it('segment changes recalculate TSS when no manual override', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '100' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // 3600s at 100% FTP with FTP=250: TSS = 100, IF = 1.00
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 100');
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: 1.00');

    // Change power — should recalculate
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    await waitFor(() => {
      expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 64');
    });
  });

  it('does not show preview when no segments', () => {
    renderPlanPage();
    expect(screen.queryByTestId('segment-preview')).not.toBeInTheDocument();
  });

  // --- PLAN-029F: Create payload includes auto-computed plannedTss/IF ---

  it('submit payload includes auto-computed plannedTss and plannedIf from segments', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Add a segment with power targets (FTP = 250W from mock settings)
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Expand and set: 1 hour at 80% FTP (80% of 250W = 200W)
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    // Submit without manually entering TSS/IF
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    // plannedTss should be auto-computed: (3600 * (200/250)^2) / 3600 * 100 = 64
    expect(payload.plannedTss).toBe(64);
    // plannedIf = 200/250 = 0.80
    expect(payload.plannedIf).toBe(0.8);
    // plannedDurationSeconds = 3600 (from segment)
    expect(payload.plannedDurationSeconds).toBe(3600);
    // segments must be included
    expect(payload.segments).toBeDefined();
    expect(payload.segments).toHaveLength(1);
  });

  it('submit payload includes targetSpeed when provided', async () => {
    renderPlanPage();

    // Set target speed
    fireEvent.change(screen.getByTestId('target-speed-input'), { target: { value: '18' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    expect(payload.targetSpeed).toBe(18);
  });

  // --- Edit Mode ---

  it('shows Edit Activity title in edit mode', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-1',
      activityType: 'ride',
      title: 'Existing Ride',
      date: '2024-06-10',
      plannedDurationSeconds: 3600,
      plannedDistanceMeters: 32000,
      segments: [{ type: 'interval', durationSeconds: 300, powerMin: 250, powerMax: 280 }],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-1/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    expect((screen.getByTestId('activity-title-input') as HTMLInputElement).value).toBe('Existing Ride');
    expect((screen.getByTestId('activity-date-input') as HTMLInputElement).value).toBe('2024-06-10');
  });

  it('uses PUT for edit mode submission', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-1',
      activityType: 'ride',
      title: 'Existing Ride',
      date: '2024-06-10',
    } as any);
    mockUpdateWorkout.mockResolvedValue({} as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-1/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    fireEvent.change(screen.getByTestId('activity-title-input'), { target: { value: 'Updated Ride' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockUpdateWorkout).toHaveBeenCalledWith('edit-1', expect.objectContaining({
        title: 'Updated Ride',
      }));
    });
    expect(mockCreateActivity).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('shows loading indicator while fetching edit data', () => {
    mockGetWorkout.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/activities/edit-1/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  // --- PLAN-029E: Edit-mode data loading regression ---

  it('edit mode loads and renders all segments from API response', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-full',
      activityType: 'ride',
      title: 'Full Workout',
      description: 'Complete persistence test',
      date: '2024-08-20',
      plannedDurationSeconds: 1200,
      plannedDistanceMeters: 9656,
      targetSpeed: 18,
      plannedTss: 25,
      plannedIf: 0.65,
      referenceMetric: { type: 'power_ftp', value: 250 },
      tags: ['test'],
      segments: [
        { type: 'warmup', durationSeconds: 300, powerMin: 35, powerMax: 55, notes: 'Easy spin' },
        { type: 'interval', durationSeconds: 600, powerMin: 75, powerMax: 85, intensityMetric: 'power_ftp' },
        { type: 'recovery', durationSeconds: 300, powerMin: 45, powerMax: 55 },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-full/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    // Verify all three segments are rendered
    expect(screen.getByTestId('segment-0')).toBeInTheDocument();
    expect(screen.getByTestId('segment-1')).toBeInTheDocument();
    expect(screen.getByTestId('segment-2')).toBeInTheDocument();
    expect(screen.queryByTestId('segment-3')).not.toBeInTheDocument();
  });

  it('edit mode loads target speed', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-speed',
      activityType: 'ride',
      date: '2024-08-20',
      targetSpeed: 18,
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-speed/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    expect((screen.getByTestId('target-speed-input') as HTMLInputElement).value).toBe('18');
  });

  it('edit mode loads intensity metric from referenceMetric', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-metric',
      activityType: 'ride',
      date: '2024-08-20',
      referenceMetric: { type: 'hr_threshold', value: 0 },
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-metric/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    expect((screen.getByTestId('intensity-metric-select') as HTMLSelectElement).value).toBe('hr_threshold');
  });

  it('edit mode shows workout summary when segments are loaded', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-summary',
      activityType: 'ride',
      date: '2024-08-20',
      segments: [
        { type: 'interval', durationSeconds: 3600, powerMin: 200, powerMax: 200 },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-summary/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    // Segment loaded → summary should appear
    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-duration')).toHaveTextContent('1:00:00');
  });

  it('edit mode loads description', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-desc',
      activityType: 'ride',
      date: '2024-08-20',
      description: 'Test description content',
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-desc/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    expect((screen.getByTestId('activity-description-input') as HTMLTextAreaElement).value).toBe('Test description content');
  });
});


describe('PlanActivityPage — TSS/IF Override Provenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue({
      id: 'new-1',
      date: '2024-06-15',
      status: 'planned',
      activityType: 'ride',
    });
    mockGetSettings.mockResolvedValue({
      userId: 'user-1',
      driveStoragePath: '/uploads',
      driveInboxPath: '/inbox',
      connectedSources: [],
      ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }],
      timezone: 'America/Chicago',
      updatedAt: '2024-06-01T00:00:00Z',
    });
  });

  function renderPlanPage(route = '/activities/plan?date=2024-06-15') {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/activities/plan" element={<PlanActivityPage />} />
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div>Calendar</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('step-driven activity saves both override flags as false', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Add a segment (FTP=250, 80% for 1hr → TSS 64, IF 0.80)
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    expect(payload.plannedTssOverride).toBe(false);
    expect(payload.plannedIfOverride).toBe(false);
  });

  it('IF override saves effective TSS, IF, and correct flags', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Add a segment
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    // Override IF
    fireEvent.change(screen.getByTestId('planned-if-input'), { target: { value: '0.86' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    expect(payload.plannedIfOverride).toBe(true);
    expect(payload.plannedTssOverride).toBe(false);
    // IF should be 0.86
    expect(payload.plannedIf).toBe(0.86);
    // TSS derived from IF=0.86 at 3600s: (3600/3600) * 0.86^2 * 100 ≈ 74
    expect(payload.plannedTss).toBe(Math.round((3600 / 3600) * Math.pow(0.86, 2) * 100));
  });

  it('TSS override saves effective TSS, IF, and correct flags', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Add a segment
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('segment-0'));
    fireEvent.change(screen.getByTestId('segment-0-duration'), { target: { value: '1:00:00' } });
    fireEvent.change(screen.getByTestId('segment-0-power-min'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('segment-0-power-max'), { target: { value: '80' } });

    // Override TSS
    fireEvent.change(screen.getByTestId('planned-tss-input'), { target: { value: '85' } });

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    expect(payload.plannedTssOverride).toBe(true);
    expect(payload.plannedIfOverride).toBe(false);
    expect(payload.plannedTss).toBe(85);
    // IF derived from TSS=85 at 3600s: sqrt(85 / ((3600/3600)*100)) = sqrt(0.85) ≈ 0.92
    expect(payload.plannedIf).toBeCloseTo(Math.sqrt(85 / 100), 2);
  });

  it('edit mode restores an IF override from persisted data', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-if-override',
      activityType: 'ride',
      date: '2024-08-20',
      plannedIf: 0.86,
      plannedTss: 74,
      plannedIfOverride: true,
      plannedTssOverride: false,
      segments: [
        { type: 'interval', durationSeconds: 3600, powerMin: 80, powerMax: 80 },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-if-override/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    // The IF field should show the override value (0.86), not the step-derived 0.80
    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: 0.86');
    // TSS derived from IF=0.86 at 3600s
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 74');
  });

  it('edit mode restores a TSS override from persisted data', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-tss-override',
      activityType: 'ride',
      date: '2024-08-20',
      plannedTss: 85,
      plannedIf: 0.92,
      plannedTssOverride: true,
      plannedIfOverride: false,
      segments: [
        { type: 'interval', durationSeconds: 3600, powerMin: 80, powerMax: 80 },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-tss-override/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // TSS should show the persisted override value
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 85');
  });

  it('modifying a step after reopening clears both overrides', async () => {
    mockGetWorkout.mockResolvedValue({
      id: 'edit-clear-override',
      activityType: 'ride',
      date: '2024-08-20',
      plannedIf: 0.86,
      plannedTss: 74,
      plannedIfOverride: true,
      plannedTssOverride: false,
      segments: [
        { type: 'interval', durationSeconds: 3600, powerMin: 80, powerMax: 80 },
      ],
    } as any);
    mockUpdateWorkout.mockResolvedValue({} as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-clear-override/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div>Calendar</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    // Add a new step — this should clear overrides
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-recovery'));

    // TSS/IF should now be step-derived (not the override)
    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // The IF should no longer be 0.86 from the override — it's recalculated from 2 segments

    // Save — overrides should be false
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockUpdateWorkout).toHaveBeenCalled();
    });

    const payload = mockUpdateWorkout.mock.calls[0][1];
    expect(payload.plannedTssOverride).toBe(false);
    expect(payload.plannedIfOverride).toBe(false);
  });

  it('existing activities without override fields behave as step-driven', async () => {
    // Activity without plannedTssOverride/plannedIfOverride fields (legacy)
    mockGetWorkout.mockResolvedValue({
      id: 'edit-legacy',
      activityType: 'ride',
      date: '2024-08-20',
      plannedTss: 64,
      plannedIf: 0.80,
      // No plannedTssOverride or plannedIfOverride fields
      segments: [
        { type: 'interval', durationSeconds: 3600, powerMin: 80, powerMax: 80 },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/activities/edit-legacy/edit']}>
        <Routes>
          <Route path="/activities/:id/edit" element={<PlanActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Edit Activity');
    });

    await waitFor(() => {
      expect(screen.getByTestId('segment-preview')).toBeInTheDocument();
    });
    // Values should be step-derived (FTP=250, 80% → TSS 64, IF 0.80)
    expect(screen.getByTestId('preview-tss')).toHaveTextContent('TSS: 64');
    expect(screen.getByTestId('preview-if')).toHaveTextContent('IF: 0.80');
  });

  it('no-segment activity saves override flags as false', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // No segments — just direct TSS/IF entry
    fireEvent.change(screen.getByTestId('planned-tss-input'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('planned-if-input'), { target: { value: '0.70' } });
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockCreateActivity).toHaveBeenCalled();
    });

    const payload = mockCreateActivity.mock.calls[0][0];
    expect(payload.plannedTssOverride).toBe(false);
    expect(payload.plannedIfOverride).toBe(false);
  });
});


describe('PlanActivityPage — Template Return Navigation (PLAN-035C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue({
      id: 'new-1',
      date: '2024-06-15',
      status: 'planned',
      activityType: 'ride',
    });
    mockCreateTemplate.mockResolvedValue({
      id: 'tmpl-new',
      activityType: 'ride',
      template: true,
      status: null,
    } as any);
    mockGetSettings.mockResolvedValue({
      userId: 'user-1',
      driveStoragePath: '/uploads',
      driveInboxPath: '/inbox',
      connectedSources: [],
      ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }],
      timezone: 'America/Chicago',
      updatedAt: '2024-06-01T00:00:00Z',
    });
  });

  it('new template from Calendar → Save → navigates to /calendar', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/templates/new', state: { returnTo: '/calendar' } }]}>
        <Routes>
          <Route path="/templates/new" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div data-testid="calendar-page">Calendar</div>} />
          <Route path="/templates" element={<div data-testid="template-library">Library</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-title')).toHaveTextContent('New Template');
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/calendar');
    });
  });

  it('new template from Calendar → Cancel → navigates to /calendar', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/templates/new', state: { returnTo: '/calendar' } }]}>
        <Routes>
          <Route path="/templates/new" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div data-testid="calendar-page">Calendar</div>} />
          <Route path="/templates" element={<div data-testid="template-library">Library</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/calendar');
  });

  it('new template from Template Library → Save → navigates to /templates', async () => {
    render(
      <MemoryRouter initialEntries={['/templates/new']}>
        <Routes>
          <Route path="/templates/new" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div data-testid="calendar-page">Calendar</div>} />
          <Route path="/templates" element={<div data-testid="template-library">Library</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-title')).toHaveTextContent('New Template');
    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/templates');
    });
  });

  it('new template from Template Library → Cancel → navigates to /templates', () => {
    render(
      <MemoryRouter initialEntries={['/templates/new']}>
        <Routes>
          <Route path="/templates/new" element={<PlanActivityPage />} />
          <Route path="/calendar" element={<div data-testid="calendar-page">Calendar</div>} />
          <Route path="/templates" element={<div data-testid="template-library">Library</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/templates');
  });
});


describe('PlanActivityPage — Save as Template (PLAN-036)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue({
      id: 'new-1', date: '2024-06-15', status: 'planned', activityType: 'ride',
    });
    mockCreateTemplate.mockResolvedValue({
      id: 'tmpl-new', activityType: 'ride', template: true, status: null,
    } as any);
    mockGetSettings.mockResolvedValue({
      userId: 'user-1', driveStoragePath: '/uploads', driveInboxPath: '/inbox',
      connectedSources: [], ftpHistory: [{ effectiveDate: '2024-01-01', ftpWatts: 250 }],
      timezone: 'America/Chicago', updatedAt: '2024-06-01T00:00:00Z',
    });
  });

  it('Save as Template button appears when segments exist', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // No button without segments
    expect(screen.queryByTestId('save-as-template-btn')).not.toBeInTheDocument();

    // Add a segment
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Button appears
    expect(screen.getByTestId('save-as-template-btn')).toBeInTheDocument();
  });

  it('Save as Template does NOT appear in template mode', async () => {
    render(
      <MemoryRouter initialEntries={['/templates/new']}>
        <Routes>
          <Route path="/templates/new" element={<PlanActivityPage />} />
          <Route path="/templates" element={<div>Library</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Add a segment
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    // Save as Template should NOT appear (already in template mode)
    expect(screen.queryByTestId('save-as-template-btn')).not.toBeInTheDocument();
  });

  it('clicking Save as Template calls createTemplate with current form state', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    // Set up the form
    fireEvent.change(screen.getByTestId('activity-title-input'), { target: { value: 'My Workout' } });
    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));

    fireEvent.click(screen.getByTestId('save-as-template-btn'));

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith(expect.objectContaining({
        activityType: 'ride',
        title: 'My Workout',
        segments: expect.any(Array),
      }));
    });
  });

  it('shows success message after template saved', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('save-as-template-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('template-save-success')).toBeInTheDocument();
    });
  });

  it('user remains on Plan Activity page after save', async () => {
    renderPlanPage();
    await waitFor(() => { expect(mockGetSettings).toHaveBeenCalled(); });

    fireEvent.click(screen.getByTestId('add-segment-btn'));
    fireEvent.click(screen.getByTestId('add-step-interval'));
    fireEvent.click(screen.getByTestId('save-as-template-btn'));

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalled();
    });
    // Still on Plan Activity page
    expect(screen.getByTestId('plan-activity-page')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
