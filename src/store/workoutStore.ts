import { create } from 'zustand';
import type { WorkoutRecord, PaginationMeta } from '../types/workout';
import * as workoutsApi from '../api/workouts';

export interface WorkoutState {
  workouts: WorkoutRecord[];
  pagination: PaginationMeta | null;
  currentWorkout: WorkoutRecord | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  fetchWorkouts: () => Promise<void>;
  fetchWorkout: (id: string) => Promise<void>;
  updateWorkout: (id: string, updates: { title?: string; tags?: string[] }) => Promise<void>;
  setSort: (column: string, order: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  workouts: [],
  pagination: null,
  currentWorkout: null,
  sortBy: 'date',
  sortOrder: 'desc',
  currentPage: 1,
  isLoading: false,
  error: null,

  fetchWorkouts: async () => {
    const { currentPage } = get();
    set({ isLoading: true, error: null });
    try {
      const result = await workoutsApi.listWorkouts({
        page: currentPage,
        pageSize: 25,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      set({ workouts: result.items, pagination: result.pagination, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch workouts';
      set({ error: message, isLoading: false });
    }
  },

  fetchWorkout: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const workout = await workoutsApi.getWorkout(id);
      set({ currentWorkout: workout, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch workout';
      set({ error: message, isLoading: false });
    }
  },

  updateWorkout: async (id: string, updates: { title?: string; tags?: string[] }) => {
    try {
      const updated = await workoutsApi.updateWorkout(id, updates);
      set({ currentWorkout: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update workout';
      set({ error: message });
    }
  },

  setSort: (column: string, order: 'asc' | 'desc') => {
    set({ sortBy: column, sortOrder: order, currentPage: 1 });
  },

  setPage: (page: number) => {
    set({ currentPage: page });
  },
}));
