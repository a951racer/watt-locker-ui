import { useEffect } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import PerformanceChart from '../components/PerformanceChart';
import SummaryStats from '../components/SummaryStats';
import MonthlyMileageChart from '../components/MonthlyMileageChart';
import WeeklyMilesChart from '../components/WeeklyMilesChart';
import WeeklyDurationChart from '../components/WeeklyDurationChart';
import WeeklyNPChart from '../components/WeeklyNPChart';
import WeeklyNPvsHRChart from '../components/WeeklyNPvsHRChart';
import RecentDecouplingChart from '../components/RecentDecouplingChart';
import WeeklyTSSChart from '../components/WeeklyTSSChart';
import MonthlyCaloriesChart from '../components/MonthlyCaloriesChart';
import MonthlyCadenceChart from '../components/MonthlyCadenceChart';
import MonthlySpeedChart from '../components/MonthlySpeedChart';
import MonthlyTimeChart from '../components/MonthlyTimeChart';
import MonthlyDistanceChart from '../components/MonthlyDistanceChart';
import MonthlyAscentChart from '../components/MonthlyAscentChart';

export default function DashboardPage() {
  const { workouts, isLoading, error, fetchWorkouts } = useWorkoutStore();

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

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

      {/* Summary Stats */}
      <SummaryStats workouts={workouts} />

      {/* Performance Chart (CTL/ATL/TSB) */}
      <PerformanceChart />

      {/* Monthly Mileage Comparison */}
      <MonthlyMileageChart workouts={workouts} />

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

      {/* Charts row 3 - Monthly */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MonthlyCaloriesChart workouts={workouts} />
        <MonthlyCadenceChart workouts={workouts} />
        <MonthlySpeedChart workouts={workouts} />
      </div>

      {/* Charts row 4 - Monthly totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <MonthlyTimeChart workouts={workouts} />
        <MonthlyDistanceChart workouts={workouts} />
        <MonthlyAscentChart workouts={workouts} />
      </div>
    </div>
  );
}
