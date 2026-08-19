import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import WorkoutDetailPage from './WorkoutDetailPage';
import * as workoutStore from '../store/workoutStore';

// Mock the workout store
const mockFetchWorkout = vi.fn();
const mockUpdateWorkout = vi.fn();

vi.mock('../store/workoutStore', () => ({
  useWorkoutStore: vi.fn(),
}));

const mockUseWorkoutStore = vi.mocked(workoutStore.useWorkoutStore);

function renderDetailPage(id = 'workout-1') {
  return render(
    <MemoryRouter initialEntries={[`/workouts/${id}`]}>
      <Routes>
        <Route path="/workouts/:id" element={<WorkoutDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('WorkoutDetailPage — Planned vs Actual (PLAN-032)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWorkout.mockResolvedValue(undefined);
    mockUpdateWorkout.mockResolvedValue(undefined);
  });

  it('shows Planned vs Actual section when planned data exists', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-1',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 40000,
        elevationGainMeters: 300,
        dataSource: 'strava',
        tss: 102,
        intensityFactor: 0.88,
        plannedDurationSeconds: 5400,
        plannedTss: 96,
        plannedIf: 0.86,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage();

    expect(screen.getByTestId('planned-vs-actual')).toBeInTheDocument();
    expect(screen.getByTestId('planned-duration')).toHaveTextContent('1h 30m 0s');
    expect(screen.getByTestId('actual-duration')).toHaveTextContent('1h 30m 0s');
    expect(screen.getByTestId('planned-tss')).toHaveTextContent('96');
    expect(screen.getByTestId('actual-tss')).toHaveTextContent('102');
    expect(screen.getByTestId('planned-if')).toHaveTextContent('0.86');
    expect(screen.getByTestId('actual-if')).toHaveTextContent('0.88');
  });

  it('does NOT show Planned vs Actual section when no planned data exists', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-2',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 40000,
        elevationGainMeters: 300,
        dataSource: 'strava',
        tss: 85,
        intensityFactor: 0.80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('workout-2');

    expect(screen.queryByTestId('planned-vs-actual')).not.toBeInTheDocument();
  });

  it('shows different planned and actual TSS values independently', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-3',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 40000,
        elevationGainMeters: 300,
        dataSource: 'strava',
        tss: 110,
        intensityFactor: 0.92,
        plannedTss: 85,
        plannedIf: 0.80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('workout-3');

    // Planned and actual are distinct — not accidentally substituted
    expect(screen.getByTestId('planned-tss')).toHaveTextContent('85');
    expect(screen.getByTestId('actual-tss')).toHaveTextContent('110');
    expect(screen.getByTestId('planned-if')).toHaveTextContent('0.80');
    expect(screen.getByTestId('actual-if')).toHaveTextContent('0.92');
  });

  it('shows persisted TSS/IF override values (not recalculated)', () => {
    // User overrode IF to 0.90, which derived TSS to 122
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-4',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 40000,
        elevationGainMeters: 300,
        dataSource: 'strava',
        tss: 105,
        intensityFactor: 0.89,
        plannedTss: 122,
        plannedIf: 0.90,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('workout-4');

    // Must show persisted override values, not recalculated
    expect(screen.getByTestId('planned-tss')).toHaveTextContent('122');
    expect(screen.getByTestId('planned-if')).toHaveTextContent('0.90');
  });

  it('manually completed activity with planned but no actual metrics shows em-dashes', () => {
    // Manually completed — has planned values but no actual TSS/IF
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-5',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T10:00:00Z',
        durationSeconds: 0,
        distanceMeters: 0,
        elevationGainMeters: 0,
        dataSource: 'manual',
        plannedDurationSeconds: 3600,
        plannedTss: 64,
        plannedIf: 0.80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('workout-5');

    expect(screen.getByTestId('planned-vs-actual')).toBeInTheDocument();
    expect(screen.getByTestId('planned-tss')).toHaveTextContent('64');
    expect(screen.getByTestId('planned-if')).toHaveTextContent('0.80');
    // No actual TSS/IF since manually completed
    expect(screen.getByTestId('actual-tss')).toHaveTextContent('—');
    expect(screen.getByTestId('actual-if')).toHaveTextContent('—');
  });

  it('existing actual metrics still display in the detail cards', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'workout-6',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 40000,
        elevationGainMeters: 300,
        dataSource: 'strava',
        tss: 85,
        intensityFactor: 0.80,
        avgPowerWatts: 200,
        normalizedPowerWatts: 215,
        plannedTss: 80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('workout-6');

    // Power card should still show existing metrics
    expect(screen.getByText('200 W')).toBeInTheDocument(); // avg power
    expect(screen.getByText('215 W')).toBeInTheDocument(); // NP
    // Actual TSS displayed in the comparison section
    expect(screen.getByTestId('actual-tss')).toHaveTextContent('85');
  });
});


describe('WorkoutDetailPage — Distance & Speed Comparison (PLAN-032A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWorkout.mockResolvedValue(undefined);
    mockUpdateWorkout.mockResolvedValue(undefined);
  });

  it('shows planned and actual distance', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'w-dist',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 34440, // ~21.4 mi
        elevationGainMeters: 200,
        dataSource: 'strava',
        plannedDistanceMeters: 32187, // ~20 mi
        plannedTss: 80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('w-dist');

    expect(screen.getByTestId('planned-distance')).toHaveTextContent('20.00 mi');
    expect(screen.getByTestId('actual-distance')).toHaveTextContent('21.40 mi');
  });

  it('shows planned and actual average speed', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'w-speed',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 35000,
        elevationGainMeters: 200,
        dataSource: 'strava',
        avgSpeedMps: 7.87, // ~17.6 mph
        targetSpeed: 18, // mph
        plannedTss: 80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('w-speed');

    expect(screen.getByTestId('planned-speed')).toHaveTextContent('18.0 mph');
    expect(screen.getByTestId('actual-speed')).toHaveTextContent('17.6 mph');
  });

  it('shows all five comparison metrics together', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'w-all',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:34:12Z',
        durationSeconds: 5652,
        distanceMeters: 34440,
        elevationGainMeters: 300,
        dataSource: 'strava',
        avgSpeedMps: 6.09,
        tss: 102,
        intensityFactor: 0.88,
        plannedDurationSeconds: 5400,
        plannedDistanceMeters: 32187,
        targetSpeed: 18,
        plannedTss: 96,
        plannedIf: 0.86,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('w-all');

    const section = screen.getByTestId('planned-vs-actual');
    expect(section).toBeInTheDocument();
    expect(screen.getByTestId('planned-duration')).toBeInTheDocument();
    expect(screen.getByTestId('actual-duration')).toBeInTheDocument();
    expect(screen.getByTestId('planned-distance')).toBeInTheDocument();
    expect(screen.getByTestId('actual-distance')).toBeInTheDocument();
    expect(screen.getByTestId('planned-speed')).toBeInTheDocument();
    expect(screen.getByTestId('actual-speed')).toBeInTheDocument();
    expect(screen.getByTestId('planned-tss')).toBeInTheDocument();
    expect(screen.getByTestId('actual-tss')).toBeInTheDocument();
    expect(screen.getByTestId('planned-if')).toBeInTheDocument();
    expect(screen.getByTestId('actual-if')).toBeInTheDocument();
  });

  it('manually completed activity shows planned distance/speed but not fabricated actual', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'w-manual',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T10:00:00Z',
        durationSeconds: 0,
        distanceMeters: 0,
        elevationGainMeters: 0,
        dataSource: 'manual',
        plannedDistanceMeters: 32187,
        targetSpeed: 18,
        plannedTss: 80,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('w-manual');

    expect(screen.getByTestId('planned-distance')).toHaveTextContent('mi');
    expect(screen.getByTestId('planned-speed')).toHaveTextContent('18.0 mph');
    // Actual distance is 0 which formatDistance shows as "0.0 mi" — acceptable; not fabricated
    // Actual speed is missing — shows dash
    expect(screen.getByTestId('actual-speed')).toHaveTextContent('—');
  });

  it('activity without planned data still does not show comparison', () => {
    mockUseWorkoutStore.mockReturnValue({
      currentWorkout: {
        id: 'w-noplan',
        userId: 'user-1',
        activityType: 'ride',
        status: 'completed',
        startTime: '2024-08-20T10:00:00Z',
        endTime: '2024-08-20T11:30:00Z',
        durationSeconds: 5400,
        distanceMeters: 34440,
        elevationGainMeters: 200,
        dataSource: 'strava',
        avgSpeedMps: 6.09,
        tss: 85,
        createdAt: '2024-08-20T10:00:00Z',
        updatedAt: '2024-08-20T12:00:00Z',
      },
      isLoading: false,
      error: null,
      fetchWorkout: mockFetchWorkout,
      updateWorkout: mockUpdateWorkout,
    } as any);

    renderDetailPage('w-noplan');

    expect(screen.queryByTestId('planned-vs-actual')).not.toBeInTheDocument();
  });
});
