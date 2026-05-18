import type { WorkoutTableRow } from '../types/workout';

export function sortWorkouts(
  rows: WorkoutTableRow[],
  column: keyof WorkoutTableRow,
  order: 'asc' | 'desc'
): WorkoutTableRow[] {
  const sorted = [...rows].sort((a, b) => {
    // Use raw ISO date for date column sorting
    const sortKey = column === 'date' ? 'dateRaw' : column;
    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}
