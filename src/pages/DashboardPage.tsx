import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import WorkoutTable from '../components/WorkoutTable';
import PerformanceChart from '../components/PerformanceChart';
import WeeklyMilesChart from '../components/WeeklyMilesChart';
import WeeklyDurationChart from '../components/WeeklyDurationChart';
import WeeklyNPChart from '../components/WeeklyNPChart';
import WeeklyNPvsHRChart from '../components/WeeklyNPvsHRChart';
import RecentDecouplingChart from '../components/RecentDecouplingChart';
import WeeklyTSSChart from '../components/WeeklyTSSChart';
import { toWorkoutTableRow } from '../utils/formatting';
import { sortWorkouts } from '../utils/sorting';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { workouts, isLoading, error, fetchWorkouts } = useWorkoutStore();

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  const handleRowClick = (id: string) => {
    navigate(`/workouts/${id}`);
  };

  // Show most recent 10 workouts, sorted by date descending
  const tableRows = workouts.map(toWorkoutTableRow);
  const sortedRows = sortWorkouts(tableRows, 'date', 'desc').slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-lightSilver text-lg">Loading workouts...</p>
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

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-pureWhite">Dashboard</h1>

      {/* Performance Chart (CTL/ATL/TSB) */}
      <PerformanceChart />

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WeeklyMilesChart workouts={workouts} />
        <WeeklyDurationChart workouts={workouts} />
        <WeeklyNPChart workouts={workouts} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WeeklyNPvsHRChart workouts={workouts} />
        <RecentDecouplingChart workouts={workouts} />
        <WeeklyTSSChart workouts={workouts} />
      </div>

      {/* Recent workouts */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-lightSilver">Recent Workouts</h2>
        <Link
          to="/workouts"
          className="text-sm px-4 py-2 rounded bg-electricBlue text-pureWhite hover:bg-brightCyan transition-colors"
        >
          View All Workouts
        </Link>
      </div>

      <WorkoutTable
        workouts={sortedRows}
        onRowClick={handleRowClick}
      />
    </div>
  );
}
