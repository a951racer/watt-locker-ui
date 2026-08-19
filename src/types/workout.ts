export interface WorkoutRecord {
  id: string;
  userId: string;
  activityType: string;
  subActivityType?: string;
  status?: string;
  date?: string;
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
  ftpUsed?: number;
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
  comment?: string;
  tags?: string[];
  // Planning fields
  plannedDurationSeconds?: number;
  plannedDistanceMeters?: number;
  plannedTss?: number;
  plannedIf?: number;
  targetSpeed?: number;
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
  durationRaw: number; // seconds for sorting
  distance: string;
  distanceRaw: number; // meters for sorting
  avgSpeed: string;
  avgSpeedRaw: number; // m/s for sorting
  avgPower: string;
  avgPowerRaw: number; // watts for sorting
  normalizedPower: string;
  normalizedPowerRaw: number; // watts for sorting
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
