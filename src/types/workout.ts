export interface WorkoutRecord {
  id: string;
  userId: string;
  activityType: string;
  subActivityType?: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  movingTimeSeconds?: number;
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters?: number;
  calories?: number;
  avgTemperatureCelsius?: number;
  maxTemperatureCelsius?: number;
  avgPowerWatts?: number;
  maxPowerWatts?: number;
  normalizedPowerWatts?: number;
  totalWorkKj?: number;
  ftpWatts?: number;
  intensityFactor?: number;
  tss?: number;
  aerobicDecoupling?: number;
  avgHeartRateBpm?: number;
  maxHeartRateBpm?: number;
  avgCadenceRpm?: number;
  maxCadenceRpm?: number;
  totalPedalRevolutions?: number;
  avgSpeedMps?: number;
  maxSpeedMps?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
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
  tags?: string[];
  duration: string;
  distance: string;
  avgSpeed: string;
  avgPower: string;
  normalizedPower: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
