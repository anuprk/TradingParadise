import { create } from 'zustand';
import type { TradeJournalEntry } from '../types/journal';
import * as journalRepo from '../db/journalRepository';
import type { JournalFilters } from '../db/journalRepository';
import { useAppStore } from './appStore';

export interface JournalSummary {
  totalTrades: number;
  winRate: number;
  totalPL: number;
  avgPL: number;
  totalFees: number;
}

type SortField = keyof TradeJournalEntry;
type SortDirection = 'asc' | 'desc';

interface JournalState {
  entries: TradeJournalEntry[];
  filters: JournalFilters;
  sortField: SortField;
  sortDirection: SortDirection;
  isLoading: boolean;
  totalCount: number;
  currentPage: number;
  stats: { totalPL: number; winCount: number; lossCount: number; closedCount: number; monthlyPL: number; yearlyPL: Record<number, number> };

  loadEntries: (planId: string) => Promise<void>;
  loadStats: (planId: string) => Promise<void>;
  addEntry: (entry: TradeJournalEntry) => Promise<string>;
  updateEntry: (id: string, changes: Partial<TradeJournalEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  setFilters: (filters: JournalFilters) => Promise<void>;
  setSort: (field: SortField, direction: SortDirection) => void;
  setPage: (page: number) => Promise<void>;
  assignDefaultStrategies: (shortPutId: string, shortCallId: string, leapId: string) => Promise<void>;
  getSummary: () => JournalSummary;
}

function computeSummary(entries: TradeJournalEntry[]): JournalSummary {
  const totalTrades = entries.length;
  if (totalTrades === 0) {
    return { totalTrades: 0, winRate: 0, totalPL: 0, avgPL: 0, totalFees: 0 };
  }

  const wins = entries.filter((e) => e.winLoss === 'Win').length;
  const totalPL = entries.reduce((sum, e) => sum + (e.profitLoss ?? 0), 0);
  const totalFees = entries.reduce((sum, e) => sum + e.fees, 0);

  return {
    totalTrades,
    winRate: (wins / totalTrades) * 100,
    totalPL,
    avgPL: totalPL / totalTrades,
    totalFees,
  };
}

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  filters: { tradeStatus: 'Open' },
  sortField: 'openDate' as SortField,
  sortDirection: 'desc' as SortDirection,
  isLoading: false,
  totalCount: 0,
  currentPage: 1,
  stats: { totalPL: 0, winCount: 0, lossCount: 0, closedCount: 0, monthlyPL: 0, yearlyPL: {} },

  loadEntries: async (planId) => {
    set({ isLoading: true });
    try {
      const { filters, currentPage } = get();
      const updatedFilters = { ...filters, planId };
      const offset = (currentPage - 1) * 20;
      const { entries, total } = await journalRepo.filterJournalEntries(updatedFilters, offset, 20);
      set({ entries, filters: updatedFilters, totalCount: total });
      // Also load stats
      get().loadStats(planId);
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load journal entries',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async (planId) => {
    try {
      const stats = await journalRepo.getJournalStats(planId);
      set({ stats });
    } catch {
      // Stats are non-critical, don't show error
    }
  },

  addEntry: async (entry) => {
    try {
      const id = await journalRepo.createJournalEntry(entry);
      const { filters, currentPage } = get();
      if (filters.planId) {
        const offset = (currentPage - 1) * 20;
        const { entries, total } = await journalRepo.filterJournalEntries(filters, offset, 20);
        set({ entries, totalCount: total });
      }
      return id;
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to add journal entry',
        'error',
      );
      return '';
    }
  },

  updateEntry: async (id, changes) => {
    try {
      await journalRepo.updateJournalEntry(id, changes);
      const { filters, currentPage } = get();
      if (filters.planId) {
        const offset = (currentPage - 1) * 20;
        const { entries, total } = await journalRepo.filterJournalEntries(filters, offset, 20);
        set({ entries, totalCount: total });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to update journal entry',
        'error',
      );
    }
  },

  deleteEntry: async (id) => {
    try {
      await journalRepo.deleteJournalEntry(id);
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }));
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete journal entry',
        'error',
      );
    }
  },

  setFilters: async (filters) => {
    set({ isLoading: true, filters, currentPage: 1 });
    try {
      const { entries, total } = await journalRepo.filterJournalEntries(filters, 0, 20);
      set({ entries, totalCount: total });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to filter journal entries',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  setSort: (field, direction) => {
    set((state) => {
      const sorted = [...state.entries].sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
      return { entries: sorted, sortField: field, sortDirection: direction };
    });
  },

  setPage: async (page) => {
    set({ isLoading: true, currentPage: page });
    try {
      const { filters } = get();
      const offset = (page - 1) * 20;
      const { entries, total } = await journalRepo.filterJournalEntries(filters, offset, 20);
      set({ entries, totalCount: total });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load page',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  assignDefaultStrategies: async (shortPutId, shortCallId, leapId) => {
    const { filters } = get();
    if (!filters.planId) return;
    try {
      await journalRepo.assignDefaultStrategies(filters.planId, shortPutId, shortCallId, leapId);
      // Reload entries
      await get().loadEntries(filters.planId);
      useAppStore.getState().addToast('Default strategies assigned to all records', 'success');
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to assign strategies',
        'error',
      );
    }
  },

  getSummary: () => computeSummary(get().entries),
}));
