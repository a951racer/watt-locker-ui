import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/workoutStore';
import WorkoutTable from '../components/WorkoutTable';
import Pagination from '../components/Pagination';
import WeeklyMilesChart from '../components/WeeklyMilesChart';
import WeeklyDurationChart from '../components/WeeklyDurationChart';
import WeeklyNPChart from '../components/WeeklyNPChart';
import WeeklyNPvsHRChart from '../components/WeeklyNPvsHRChart';
import RecentDecouplingChart from '../components/RecentDecouplingChart';
import WeeklyTSSChart from '../components/WeeklyTSSChart';
import { toWorkoutTableRow } from '../utils/formatting';
import { sortWorkouts } from '../utils/sorting';
import { computeTotalPages } from '../utils/pagination';
import type { WorkoutTableRow } from '../types/workout';

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    workouts,
    pagination,
    sortBy,
    sortOrder,
    currentPage,
    isLoading,
    error,
    fetchWorkouts,
    setSort,
    setPage,
  } = useWorkoutStore();

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts, currentPage]);

  const handleSort = (column: string) => {
    if (column === sortBy) {
      setSort(column, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column, 'asc');
    }
  };

  const handlePageChange = (page: number) => {
    setPage(page);
  };

  const handleRowClick = (id: string) => {
    navigate(`/workouts/${id}`);
  };

  const tableRows: WorkoutTableRow[] = workouts.map(toWorkoutTableRow);
  const sortedRows = sortWorkouts(tableRows, sortBy as keyof WorkoutTableRow, sortOrder);

  const totalPages = pagination
    ? computeTotalPages(pagination.totalItems, pagination.pageSize)
    : 0;

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

      <WorkoutTable
        workouts={sortedRows}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={handleRowClick}
      />
      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
