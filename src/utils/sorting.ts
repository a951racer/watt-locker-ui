import type { WorkoutTableRow } from '../types/workout';

export function sortWorkouts(
  rows: WorkoutTableRow[],
  column: keyof WorkoutTableRow,
  order: 'asc' | 'desc'
): WorkoutTableRow[] {
  // Map display columns to their raw numeric counterparts for proper sorting
  const rawKeyMap: Partial<Record<keyof WorkoutTableRow, keyof WorkoutTableRow>> = {
    date: 'dateRaw',
    duration: 'durationRaw',
    distance: 'distanceRaw',
    avgSpeed: 'avgSpeedRaw',
    avgPower: 'avgPowerRaw',
    normalizedPower: 'normalizedPowerRaw',
  };

  const sorted = [...rows].sort((a, b) => {
    const sortKey = rawKeyMap[column] || column;
    const aVal = a[sortKey] ?? '';
    const bVal = b[sortKey] ?? '';

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}
