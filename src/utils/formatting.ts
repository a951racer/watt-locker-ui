import type { WorkoutRecord, WorkoutTableRow } from '../types/workout';

export function formatDate(isoString: string): string {
  if (!isoString) return 'N/A';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDuration(seconds: number): string {
  if (seconds == null || seconds < 0) return 'N/A';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDistance(meters: number): string {
  if (meters == null || meters < 0) return 'N/A';
  const miles = meters / 1609.344;
  return `${miles.toFixed(2)} mi`;
}

export function formatPower(watts: number | undefined): string {
  if (watts == null) return 'N/A';
  return `${Math.round(watts)} W`;
}

export function toWorkoutTableRow(record: WorkoutRecord): WorkoutTableRow {
  return {
    id: record.id,
    date: formatDate(record.startTime),
    dateRaw: record.startTime,
    name: record.title || record.activityType || 'Workout',
    duration: formatDuration(record.durationSeconds),
    distance: formatDistance(record.distanceMeters),
    avgPower: formatPower(record.avgPowerWatts),
    normalizedPower: formatPower(record.normalizedPowerWatts),
  };
}
