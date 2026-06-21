import { useEffect, useCallback } from 'react';
import { usePortfolioStore } from '../stores/portfolioStore';
import type { Portfolio } from '../types/portfolio';

/**
 * Custom hook for portfolio management.
 * Loads all portfolios for the current user (independent of plan).
 */
export function usePortfolio() {
  const {
    portfolios,
    currentPortfolio,
    metrics,
    isLoading,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    selectPortfolio,
    refreshMetrics,
  } = usePortfolioStore();

  // Load all portfolios on mount
  useEffect(() => {
    const store = usePortfolioStore.getState();
    if (store.portfolios.length === 0) {
      store.loadAllPortfolios();
    }
  }, []);

  const create = useCallback(
    async (portfolio: Portfolio) => {
      return createPortfolio(portfolio);
    },
    [createPortfolio],
  );

  return {
    portfolios,
    currentPortfolio,
    metrics,
    isLoading,
    createPortfolio: create,
    updatePortfolio,
    deletePortfolio,
    selectPortfolio,
    refreshMetrics,
  };
}
