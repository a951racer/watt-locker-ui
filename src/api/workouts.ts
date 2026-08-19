import apiClient from './client';
import type { WorkoutRecord, PaginationMeta } from '../types/workout';

interface ApiEnvelope<T> {
  data: T;
  errors: null;
  pagination: PaginationMeta | null;
}

export interface ListWorkoutsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listWorkouts(params: ListWorkoutsParams): Promise<{ items: WorkoutRecord[]; pagination: PaginationMeta }> {
  const { data } = await apiClient.get<ApiEnvelope<WorkoutRecord[]>>('/workouts', { params });
  return {
    items: data.data,
    pagination: data.pagination ?? { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
  };
}

export async function getWorkout(id: string): Promise<WorkoutRecord> {
  const { data } = await apiClient.get<ApiEnvelope<WorkoutRecord>>(`/workouts/${id}`);
  return data.data;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface UploadWorkoutResult {
  workoutId: string;
  driveFileId: string;
  summary: { activityType: string; startTime: string; durationSeconds: number; distanceMeters: number };
  matchedExisting?: boolean;
  duplicate?: boolean;
}

export async function uploadWorkout(file: File): Promise<UploadWorkoutResult> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const { data } = await apiClient.post<ApiEnvelope<UploadWorkoutResult>>('/workouts/upload', {
    file: base64,
    fileName: file.name,
  });
  return data.data;
}

export async function uploadBulk(files: File[]): Promise<{ processed: number; failed: number }> {
  const fileData = await Promise.all(
    files.map(async (f) => {
      const buffer = await f.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      return { file: base64, fileName: f.name };
    })
  );
  const { data } = await apiClient.post<ApiEnvelope<{ total: number; successful: unknown[]; failed: unknown[]; inProgress: number }>>('/workouts/upload/bulk', {
    files: fileData,
  });
  return {
    processed: data.data.successful?.length ?? 0,
    failed: data.data.failed?.length ?? 0,
  };
}

export async function ingestFromInbox(): Promise<{ processed: number; failed: number }> {
  const { data } = await apiClient.post<ApiEnvelope<{ total: number; successful: unknown[]; failed: unknown[]; inProgress: number }>>('/workouts/ingest/inbox');
  return {
    processed: data.data.successful?.length ?? 0,
    failed: data.data.failed?.length ?? 0,
  };
}

export async function updateWorkout(id: string, updates: {
  title?: string;
  description?: string;
  comment?: string;
  tags?: string[];
  activityType?: string;
  date?: string;
  plannedDurationSeconds?: number;
  plannedDistanceMeters?: number;
  plannedTss?: number;
  plannedIf?: number;
  plannedTssOverride?: boolean;
  plannedIfOverride?: boolean;
  targetPowerMin?: number;
  targetPowerMax?: number;
  targetHrMin?: number;
  targetHrMax?: number;
  targetCadenceMin?: number;
  targetCadenceMax?: number;
  targetSpeed?: number;
  segments?: unknown[];
  equipment?: { equipmentId: string; configurationId: string } | null;
  eventId?: string;
  referenceMetric?: { type: string; value: number };
}): Promise<WorkoutRecord> {
  const { data } = await apiClient.put<ApiEnvelope<WorkoutRecord>>(`/workouts/${id}`, updates);
  return data.data;
}

export async function exportWorkoutsCsv(params?: { dateFrom?: string; dateTo?: string }): Promise<string> {
  const queryParams: Record<string, string> = {};
  if (params?.dateFrom) queryParams.dateFrom = params.dateFrom;
  if (params?.dateTo) queryParams.dateTo = params.dateTo;
  const { data } = await apiClient.get('/workouts/export', { params: queryParams, responseType: 'text' });
  return data as unknown as string;
}

export async function importWorkoutsCsv(csv: string): Promise<{ total: number; updated: number; skipped: number; failed: Array<{ row: number; id: string; reason: string }> }> {
  const { data } = await apiClient.post<ApiEnvelope<{ total: number; updated: number; skipped: number; failed: Array<{ row: number; id: string; reason: string }> }>>('/workouts/import', { csv });
  return data.data;
}

export interface PerformanceMetric {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
}

export async function getPerformanceMetrics(days: number = 90): Promise<PerformanceMetric[]> {
  const { data } = await apiClient.get<ApiEnvelope<PerformanceMetric[]>>('/workouts/performance-metrics', { params: { days } });
  return data.data;
}

export async function recalculateWorkouts(): Promise<{ total: number; updated: number; failed: number }> {
  const { data } = await apiClient.post<ApiEnvelope<{ total: number; updated: number; failed: number }>>('/workouts/recalculate');
  return data.data;
}

export async function recalculateSpeed(): Promise<{ total: number; updated: number; failed: number }> {
  const { data } = await apiClient.post<ApiEnvelope<{ total: number; updated: number; failed: number }>>('/workouts/recalculate-speed');
  return data.data;
}

export async function deleteWorkout(id: string, removeFromDrive: boolean = false): Promise<void> {
  await apiClient.delete(`/workouts/${id}`, { params: removeFromDrive ? { removeFromDrive: 'true' } : {} });
}

export async function moveActivity(id: string, date: string): Promise<WorkoutRecord> {
  const { data } = await apiClient.put<ApiEnvelope<WorkoutRecord>>(`/workouts/${id}/move`, { date });
  return data.data;
}

export async function completeActivity(id: string): Promise<WorkoutRecord> {
  const { data } = await apiClient.put<ApiEnvelope<WorkoutRecord>>(`/workouts/${id}/status`, { status: 'completed' });
  return data.data;
}

export async function createTemplate(params: {
  activityType: string;
  title?: string;
  description?: string;
  plannedDurationSeconds?: number;
  plannedDistanceMeters?: number;
  plannedTss?: number;
  plannedIf?: number;
  targetPowerMin?: number;
  targetPowerMax?: number;
  targetHrMin?: number;
  targetHrMax?: number;
  targetCadenceMin?: number;
  targetCadenceMax?: number;
  targetSpeed?: number;
  segments?: unknown[];
  tags?: string[];
  equipment?: { equipmentId: string; configurationId: string } | null;
  referenceMetric?: { type: string; value: number };
}): Promise<Template> {
  const { data } = await apiClient.post<ApiEnvelope<Template>>('/workouts/templates', params);
  return data.data;
}

export async function copyTemplateToActivity(templateId: string, date: string): Promise<CalendarActivity> {
  const { data } = await apiClient.post<ApiEnvelope<CalendarActivity>>(`/workouts/templates/${templateId}/copy`, { date });
  return data.data;
}

export async function saveAsTemplate(activityId: string): Promise<Template> {
  const { data } = await apiClient.post<ApiEnvelope<Template>>(`/workouts/${activityId}/save-as-template`);
  return data.data;
}

export interface PowerCurveEntry {
  workoutId: string;
  date: string;
  title?: string;
  maxPowers: Record<string, number>;
}

export async function getPowerCurve(months: number = 6): Promise<PowerCurveEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<PowerCurveEntry[]>>('/workouts/power-curve', { params: { months } });
  return data.data;
}

export async function computePowerCurves(force = false): Promise<{ computed: number; skipped: number; failed: number }> {
  const { data } = await apiClient.post<ApiEnvelope<{ computed: number; skipped: number; failed: number }>>(`/workouts/compute-power-curves${force ? '?force=true' : ''}`);
  return data.data;
}

export interface CalendarActivity {
  id: string;
  date: string;
  status: string;
  title?: string;
  activityType: string;
  plannedTss?: number;
  tss?: number;
  plannedDurationSeconds?: number;
  durationSeconds?: number;
  plannedDistanceMeters?: number;
  distanceMeters?: number;
}

export interface CalendarWeeklySummary {
  weekStart: string;
  weekEnd: string;
  plannedDuration: number;
  completedDuration: number;
  plannedDistance: number;
  completedDistance: number;
  plannedTss: number;
  completedTss: number;
}

export interface CalendarResponse {
  activities: CalendarActivity[];
  weeklySummaries: CalendarWeeklySummary[];
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  plannedTss: number;
  completedTss: number;
  remainingTss: number;
  activities: CalendarActivity[];
}

export async function getCalendar(dateFrom: string, dateTo: string): Promise<CalendarResponse> {
  const { data } = await apiClient.get<ApiEnvelope<CalendarResponse>>('/workouts/calendar', { params: { dateFrom, dateTo } });
  return data.data;
}

export async function getWeeklySummary(weekOf: string): Promise<WeeklySummary> {
  const { data } = await apiClient.get<ApiEnvelope<WeeklySummary>>('/workouts/weekly-summary', { params: { weekOf } });
  return data.data;
}

export interface CreateActivityParams {
  date: string;
  activityType: string;
  title?: string;
  description?: string;
  comment?: string;
  plannedDurationSeconds?: number;
  plannedDistanceMeters?: number;
  plannedTss?: number;
  plannedIf?: number;
  plannedTssOverride?: boolean;
  plannedIfOverride?: boolean;
  targetPowerMin?: number;
  targetPowerMax?: number;
  targetHrMin?: number;
  targetHrMax?: number;
  targetCadenceMin?: number;
  targetCadenceMax?: number;
  targetSpeed?: number;
  segments?: unknown[];
  tags?: string[];
  equipment?: { equipmentId: string; configurationId: string } | null;
  eventId?: string;
  referenceMetric?: { type: string; value: number };
}

export async function createActivity(params: CreateActivityParams): Promise<CalendarActivity> {
  const { data } = await apiClient.post<ApiEnvelope<CalendarActivity>>('/workouts', params);
  return data.data;
}

// --- Template Library ---

export interface Template {
  id: string;
  title?: string;
  activityType: string;
  template: boolean;
  status: null;
  description?: string;
  plannedDurationSeconds?: number;
  plannedDistanceMeters?: number;
  plannedTss?: number;
  plannedIf?: number;
  targetPowerMin?: number;
  targetPowerMax?: number;
  targetHrMin?: number;
  targetHrMax?: number;
  targetCadenceMin?: number;
  targetCadenceMax?: number;
  targetSpeed?: number;
  segments?: Array<{
    type: string;
    durationSeconds: number;
    powerMin?: number;
    powerMax?: number;
    hrMin?: number;
    hrMax?: number;
    cadenceMin?: number;
    cadenceMax?: number;
    notes?: string;
  }>;
  tags?: string[];
}

export interface TemplateListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  activityType?: string;
}

export interface TemplateListResponse {
  items: Template[];
  pagination: PaginationMeta;
}

export async function listTemplates(params: TemplateListParams): Promise<TemplateListResponse> {
  const queryParams: Record<string, string> = {};
  if (params.page) queryParams.page = String(params.page);
  if (params.pageSize) queryParams.pageSize = String(params.pageSize);
  if (params.search) queryParams.search = params.search;
  if (params.activityType) queryParams.activityType = params.activityType;
  const { data } = await apiClient.get<ApiEnvelope<Template[]>>('/workouts/templates', { params: queryParams });
  return {
    items: data.data,
    pagination: data.pagination ?? { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
  };
}
