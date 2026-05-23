import { useEffect, useCallback } from 'react';
import { usePlanStore } from '../stores/planStore';
import { useAppStore } from '../stores/appStore';
import type { TradingPlan } from '../types/tradingPlan';

/**
 * Custom hook wrapping the plan store with DB sync.
 * Loads the plan when activePlanId changes and exposes plan data + CRUD actions.
 *
 * Requirements: 13.4, 13.5, 13.9
 */
export function useTradingPlan() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const {
    currentPlan,
    plans,
    isDirty,
    isLoading,
    loadPlan,
    loadPlans,
    createPlan,
    savePlan,
    updatePlan,
    deletePlan,
    setCurrentPlan,
    setDirty,
  } = usePlanStore();

  // Load plan when activePlanId changes
  useEffect(() => {
    if (activePlanId) {
      loadPlan(activePlanId);
    } else {
      setCurrentPlan(null);
    }
  }, [activePlanId, loadPlan, setCurrentPlan]);

  const create = useCallback(
    async (plan: TradingPlan) => {
      const id = await createPlan(plan);
      useAppStore.getState().setActivePlanId(id);
      return id;
    },
    [createPlan],
  );

  const remove = useCallback(
    async (id: string) => {
      await deletePlan(id);
      if (activePlanId === id) {
        useAppStore.getState().setActivePlanId(null);
      }
    },
    [deletePlan, activePlanId],
  );

  return {
    plan: currentPlan,
    plans,
    isDirty,
    isLoading,
    loadPlans,
    createPlan: create,
    savePlan,
    updatePlan,
    deletePlan: remove,
    setDirty,
  };
}
