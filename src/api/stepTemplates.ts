/**
 * PLAN-057: Step Template API client.
 *
 * User-scoped CRUD for Step Templates. The step payload is the canonical
 * `PlanSegment` (shared with the planner) — no template-specific step type.
 */
import apiClient from './client';
import type { PlanSegment } from '../utils/tssCalculator';

interface ApiEnvelope<T> {
  data: T;
  errors: null;
  pagination: unknown;
}

/** A user-owned Step Template as returned by the API. */
export interface StepTemplate {
  id: string;
  userId: string;
  name: string;
  step: PlanSegment;
  createdAt: string;
  updatedAt: string;
}

export interface StepTemplateInput {
  name: string;
  step: PlanSegment;
}

const BASE = '/templates/steps';

export async function listStepTemplates(): Promise<StepTemplate[]> {
  const { data } = await apiClient.get<ApiEnvelope<StepTemplate[]>>(BASE);
  return data.data;
}

export async function getStepTemplate(id: string): Promise<StepTemplate> {
  const { data } = await apiClient.get<ApiEnvelope<StepTemplate>>(`${BASE}/${id}`);
  return data.data;
}

export async function createStepTemplate(input: StepTemplateInput): Promise<StepTemplate> {
  const { data } = await apiClient.post<ApiEnvelope<StepTemplate>>(BASE, input);
  return data.data;
}

export async function updateStepTemplate(id: string, input: Partial<StepTemplateInput>): Promise<StepTemplate> {
  const { data } = await apiClient.put<ApiEnvelope<StepTemplate>>(`${BASE}/${id}`, input);
  return data.data;
}

export async function deleteStepTemplate(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
