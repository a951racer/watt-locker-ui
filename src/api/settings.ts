import apiClient from './client';
import type { UserSettings } from '../types/settings';

interface ApiEnvelope<T> {
  data: T;
  errors: null;
  pagination: null;
}

export async function getSettings(): Promise<UserSettings> {
  const { data } = await apiClient.get<ApiEnvelope<UserSettings>>('/settings');
  return data.data;
}

export async function updateSettings(updates: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await apiClient.put<ApiEnvelope<UserSettings>>('/settings', updates);
  return data.data;
}
