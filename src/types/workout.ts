export interface WorkoutRecord {
  id: string;
  userId: string;
  activityType: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  avgPowerWatts?: number;
  maxPowerWatts?: number;
  normalizedPowerWatts?: number;
  tss?: number;
  aerobicDecoupling?: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  avgCadenceRpm?: number;
  avgSpeedMps?: number;
  dataSource: string;
  title?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutTableRow {
  id: string;
  date: string;
  dateRaw: string; // ISO string for sorting
  name: string;
  duration: string;
  distance: string;
  avgPower: string;
  normalizedPower: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
