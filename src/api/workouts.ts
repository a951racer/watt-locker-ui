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

export async function uploadWorkout(file: File): Promise<WorkoutRecord> {
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const { data } = await apiClient.post<ApiEnvelope<WorkoutRecord>>('/workouts/upload', {
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

export async function updateWorkout(id: string, updates: { title?: string; description?: string; tags?: string[]; activityType?: string }): Promise<WorkoutRecord> {
  const { data } = await apiClient.put<ApiEnvelope<WorkoutRecord>>(`/workouts/${id}`, updates);
  return data.data;
}
