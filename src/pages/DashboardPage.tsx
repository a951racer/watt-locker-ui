import { useEffect } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import PerformanceChart from '../components/PerformanceChart';
import SummaryStats from '../components/SummaryStats';
import MonthlyMileageChart from '../components/MonthlyMileageChart';

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
    </div>
  );
}
