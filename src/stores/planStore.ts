import { create } from 'zustand';
import type { TradingPlan } from '../types/tradingPlan';
import * as planRepo from '../db/planRepository';
import { useAppStore } from './appStore';

interface PlanState {
  currentPlan: TradingPlan | null;
  plans: TradingPlan[];
  isDirty: boolean;
  isLoading: boolean;

  loadPlan: (id: string) => Promise<void>;
  loadPlans: () => Promise<void>;
  createPlan: (plan: TradingPlan) => Promise<string>;
  savePlan: () => Promise<void>;
  updatePlan: (changes: Partial<TradingPlan>) => void;
  deletePlan: (id: string) => Promise<void>;
  setCurrentPlan: (plan: TradingPlan | null) => void;
  setDirty: (dirty: boolean) => void;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  currentPlan: null,
  plans: [],
  isDirty: false,
  isLoading: false,

  loadPlan: async (id) => {
    set({ isLoading: true });
    try {
      const plan = await planRepo.getPlan(id);
      set({ currentPlan: plan ?? null, isDirty: false });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load plan',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  loadPlans: async () => {
    set({ isLoading: true });
    try {
      const plans = await planRepo.listPlans();
      set({ plans });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load plans',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createPlan: async (plan) => {
    try {
      const id = await planRepo.createPlan(plan);
      const plans = await planRepo.listPlans();
      set({ plans, currentPlan: { ...plan, id }, isDirty: false });
      return id;
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to create plan',
        'error',
      );
      return '';
    }
  },

  savePlan: async () => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    try {
      await planRepo.updatePlan(currentPlan.id, currentPlan);
      // Reload to get the server-set updatedAt
      const saved = await planRepo.getPlan(currentPlan.id);
      const plans = await planRepo.listPlans();
      set({ currentPlan: saved ?? currentPlan, plans, isDirty: false });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to save plan',
        'error',
      );
    }
  },

  updatePlan: (changes) => {
    const { currentPlan } = get();
    if (!currentPlan) return;
    set({
      currentPlan: { ...currentPlan, ...changes },
      isDirty: true,
    });
  },

  deletePlan: async (id) => {
    try {
      await planRepo.deletePlan(id);
      const { currentPlan } = get();
      const plans = await planRepo.listPlans();
      set({
        plans,
        currentPlan: currentPlan?.id === id ? null : currentPlan,
        isDirty: currentPlan?.id === id ? false : get().isDirty,
      });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete plan',
        'error',
      );
    }
  },

  setCurrentPlan: (plan) => set({ currentPlan: plan, isDirty: false }),

  setDirty: (dirty) => set({ isDirty: dirty }),
}));
