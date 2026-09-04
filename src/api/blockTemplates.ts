/**
 * PLAN-058: Block Template API client.
 *
 * User-scoped CRUD for Block Templates. Steps are canonical `PlanSegment`s
 * (shared with the planner and Step Templates) — no template-specific step
 * type, no nested blocks, no step-template references.
 */
import apiClient from './client';
import type { PlanSegment } from '../utils/tssCalculator';

interface ApiEnvelope<T> {
  data: T;
  errors: null;
  pagination: unknown;
}

/** A user-owned Block Template as returned by the API. */
export interface BlockTemplate {
  id: string;
  userId: string;
  name: string;
  repeatCount: number;
  steps: PlanSegment[];
  createdAt: string;
  updatedAt: string;
}

export interface BlockTemplateInput {
  name: string;
  repeatCount: number;
  steps: PlanSegment[];
}

const BASE = '/templates/blocks';

export async function listBlockTemplates(): Promise<BlockTemplate[]> {
  const { data } = await apiClient.get<ApiEnvelope<BlockTemplate[]>>(BASE);
  return data.data;
}

export async function getBlockTemplate(id: string): Promise<BlockTemplate> {
  const { data } = await apiClient.get<ApiEnvelope<BlockTemplate>>(`${BASE}/${id}`);
  return data.data;
}

export async function createBlockTemplate(input: BlockTemplateInput): Promise<BlockTemplate> {
  const { data } = await apiClient.post<ApiEnvelope<BlockTemplate>>(BASE, input);
  return data.data;
}

export async function updateBlockTemplate(id: string, input: Partial<BlockTemplateInput>): Promise<BlockTemplate> {
  const { data } = await apiClient.put<ApiEnvelope<BlockTemplate>>(`${BASE}/${id}`, input);
  return data.data;
}

export async function deleteBlockTemplate(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
