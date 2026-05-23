import { create } from 'zustand';
import type { Portfolio, PortfolioMetrics } from '../types/portfolio';
import type { TradeJournalEntry } from '../types/journal';
import * as portfolioRepo from '../db/portfolioRepository';
import * as journalRepo from '../db/journalRepository';
import { useTransactionStore } from './transactionStore';
import { useAppStore } from './appStore';

function computeMetrics(
  portfolio: Portfolio,
  entries: TradeJournalEntry[],
): PortfolioMetrics {
  const closedEntries = entries.filter((e) => e.tradeStatus === 'Closed');
  const openEntries = entries.filter((e) => e.tradeStatus === 'Open');

  const totalRealizedPL = closedEntries.reduce(
    (sum, e) => sum + (e.profitLoss ?? 0),
    0,
  );
  const totalUnrealizedPL = openEntries.reduce(
    (sum, e) => sum + (e.unrealizedPL ?? 0),
    0,
  );
  const totalPL = totalRealizedPL + totalUnrealizedPL;
  const netLiquidation = portfolio.initialBalance + totalPL;

  const totalTrades = closedEntries.length;
  const wins = closedEntries.filter((e) => e.winLoss === 'Win').length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const averageTradeReturn =
    totalTrades > 0 ? totalRealizedPL / totalTrades : 0;

  // Monthly returns grouped by YYYY-MM of closeDate
  const monthlyMap = new Map<string, number>();
  for (const e of closedEntries) {
    if (e.closeDate) {
      const d = new Date(e.closeDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + (e.profitLoss ?? 0));
    }
  }
  const monthlyReturns = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, dollarReturn]) => ({
      month,
      dollarReturn,
      percentageReturn:
        portfolio.initialBalance > 0
          ? (dollarReturn / portfolio.initialBalance) * 100
          : 0,
    }));

  // Max drawdown from cumulative P/L series
  let peak = 0;
  let maxDrawdown = 0;
  let cumulative = 0;
  const sortedClosed = [...closedEntries].sort(
    (a, b) =>
      new Date(a.closeDate!).getTime() - new Date(b.closeDate!).getTime(),
  );
  for (const e of sortedClosed) {
    cumulative += e.profitLoss ?? 0;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const cumulativeReturn =
    portfolio.initialBalance > 0
      ? (totalRealizedPL / portfolio.initialBalance) * 100
      : 0;

  return {
    netLiquidation,
    totalRealizedPL,
    totalUnrealizedPL,
    totalPL,
    monthlyReturns,
    maxDrawdown,
    cumulativeReturn,
    winRate,
    averageTradeReturn,
    totalTrades,
  };
}

interface PortfolioState {
  portfolios: Portfolio[];
  currentPortfolio: Portfolio | null;
  metrics: PortfolioMetrics | null;
  isLoading: boolean;

  loadPortfolios: (planId: string) => Promise<void>;
  loadAllPortfolios: () => Promise<void>;
  createPortfolio: (portfolio: Portfolio) => Promise<string>;
  updatePortfolio: (id: string, changes: Partial<Portfolio>) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  selectPortfolio: (id: string) => Promise<void>;
  refreshMetrics: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolios: [],
  currentPortfolio: null,
  metrics: null,
  isLoading: false,

  loadPortfolios: async (planId) => {
    set({ isLoading: true });
    try {
      const portfolios = await portfolioRepo.listPortfolios(planId);
      set({ portfolios });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load portfolios',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  loadAllPortfolios: async () => {
    set({ isLoading: true });
    try {
      const portfolios = await portfolioRepo.listAllPortfolios();
      set({ portfolios });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load portfolios',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createPortfolio: async (portfolio) => {
    try {
      const id = await portfolioRepo.createPortfolio(portfolio);
      const portfolios = await portfolioRepo.listPortfolios(portfolio.planId);
      set({ portfolios });
      return id;
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to create portfolio',
        'error',
      );
      return '';
    }
  },

  updatePortfolio: async (id, changes) => {
    try {
      await portfolioRepo.updatePortfolio(id, changes);
      const { currentPortfolio, portfolios } = get();
      // Refresh the list
      if (portfolios.length > 0) {
        const planId = portfolios[0].planId;
        const updated = await portfolioRepo.listPortfolios(planId);
        set({ portfolios: updated });
      }
      // If we updated the current portfolio, refresh it
      if (currentPortfolio?.id === id) {
        const refreshed = await portfolioRepo.getPortfolio(id);
        set({ currentPortfolio: refreshed ?? null });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to update portfolio',
        'error',
      );
    }
  },

  deletePortfolio: async (id) => {
    try {
      await portfolioRepo.deletePortfolio(id);
      const { currentPortfolio, portfolios } = get();
      if (portfolios.length > 0) {
        const planId = portfolios[0].planId;
        const updated = await portfolioRepo.listPortfolios(planId);
        set({ portfolios: updated });
      }
      if (currentPortfolio?.id === id) {
        set({ currentPortfolio: null, metrics: null });
        // Clear transaction store local state for the deleted portfolio
        useTransactionStore.getState().deleteTransactionsByPortfolio(id);
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete portfolio',
        'error',
      );
    }
  },

  selectPortfolio: async (id) => {
    set({ isLoading: true });
    try {
      const portfolio = await portfolioRepo.getPortfolio(id);
      if (!portfolio) {
        set({ currentPortfolio: null, metrics: null });
        return;
      }
      const { entries } = await journalRepo.filterJournalEntries({
        portfolioId: id,
        planId: portfolio.planId,
      });
      const metrics = computeMetrics(portfolio, entries);
      set({ currentPortfolio: portfolio, metrics });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load portfolio',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  refreshMetrics: async () => {
    const { currentPortfolio } = get();
    if (!currentPortfolio) return;
    try {
      const { entries } = await journalRepo.filterJournalEntries({
        portfolioId: currentPortfolio.id,
        planId: currentPortfolio.planId,
      });
      const metrics = computeMetrics(currentPortfolio, entries);
      set({ metrics });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to refresh metrics',
        'error',
      );
    }
  },
}));
