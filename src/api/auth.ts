import apiClient from './client';
import type { AuthResult } from '../types/auth';

interface ApiEnvelope<T> {
  data: T;
  errors: null;
  pagination: null;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<AuthResult>>('/auth/login', { email, password });
  return data.data;
}

export async function register(email: string, password: string): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<AuthResult>>('/auth/register', { email, password });
  return data.data;
}

export async function refreshToken(token: string): Promise<AuthResult> {
  const { data } = await apiClient.post<ApiEnvelope<AuthResult>>('/auth/refresh', { refreshToken: token });
  return data.data;
}
