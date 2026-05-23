import { create } from 'zustand';
import type {
  PortfolioTransaction,
  Holding,
  PerformanceSummaryData,
  TransactionFilterState,
} from '../types/transaction';
import * as transactionRepo from '../db/transactionRepository';
import { useAppStore } from './appStore';

const PAGE_SIZE = 50;

const defaultFilters: TransactionFilterState = {
  symbol: '',
  dateFrom: null,
  dateTo: null,
  transactionType: '',
  assetType: '',
};

const defaultPerformanceSummary: PerformanceSummaryData = {
  totalPortfolioValue: 0,
  totalRealizedPL: 0,
  totalUnrealizedPL: 0,
  overallReturnPercentage: 0,
  winRate: 0,
  totalTransactions: 0,
};

interface TransactionState {
  transactions: PortfolioTransaction[];
  holdings: Holding[];
  performanceSummary: PerformanceSummaryData;
  filters: TransactionFilterState;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  currentPage: number;
  totalCount: number;
  isLoading: boolean;

  loadTransactions: (portfolioId: string) => Promise<void>;
  addTransactions: (
    portfolioId: string,
    transactions: PortfolioTransaction[],
  ) => Promise<void>;
  deleteTransaction: (portfolioId: string, transactionId: string) => Promise<void>;
  updateTransaction: (portfolioId: string, transactionId: string, changes: Partial<PortfolioTransaction>) => Promise<void>;
  deleteTransactionsByPortfolio: (portfolioId: string) => Promise<void>;
  setFilters: (
    portfolioId: string,
    filters: Partial<TransactionFilterState>,
  ) => Promise<void>;
  setSort: (
    portfolioId: string,
    column: string,
    direction: 'asc' | 'desc',
  ) => Promise<void>;
  setPage: (portfolioId: string, page: number) => Promise<void>;
  computeHoldings: (portfolioId: string) => Promise<void>;
  computePerformance: (
    portfolioId: string,
    initialBalance: number,
  ) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  holdings: [],
  performanceSummary: defaultPerformanceSummary,
  filters: { ...defaultFilters },
  sortColumn: 'transactionDate',
  sortDirection: 'desc',
  currentPage: 1,
  totalCount: 0,
  isLoading: false,

  loadTransactions: async (portfolioId) => {
    set({ isLoading: true });
    try {
      const { filters, sortColumn, sortDirection, currentPage } = get();
      const offset = (currentPage - 1) * PAGE_SIZE;

      const [transactions, totalCount] = await Promise.all([
        transactionRepo.getTransactionsByPortfolioFiltered(
          portfolioId,
          filters,
          offset,
          PAGE_SIZE,
        ),
        transactionRepo.countTransactionsByPortfolio(portfolioId, filters),
      ]);

      // Sort in memory since the repository doesn't handle sorting
      const sorted = sortTransactionsLocal(
        transactions,
        sortColumn,
        sortDirection,
      );

      set({ transactions: sorted, totalCount });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load transactions',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  addTransactions: async (portfolioId, transactions) => {
    set({ isLoading: true });
    try {
      await transactionRepo.bulkAddTransactions(transactions);
      // Reload transactions for the current view
      await get().loadTransactions(portfolioId);
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to add transactions',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTransaction: async (portfolioId, transactionId) => {
    set({ isLoading: true });
    try {
      await transactionRepo.deleteTransaction(transactionId);
      await get().loadTransactions(portfolioId);
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete transaction',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  updateTransaction: async (portfolioId, transactionId, changes) => {
    set({ isLoading: true });
    try {
      await transactionRepo.updateTransaction(transactionId, changes);
      await get().loadTransactions(portfolioId);
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to update transaction',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  deleteTransactionsByPortfolio: async (portfolioId) => {
    set({ isLoading: true });
    try {
      await transactionRepo.deleteTransactionsByPortfolio(portfolioId);
      set({
        transactions: [],
        holdings: [],
        performanceSummary: { ...defaultPerformanceSummary },
        totalCount: 0,
        currentPage: 1,
      });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete transactions',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  setFilters: async (portfolioId, newFilters) => {
    const { filters } = get();
    set({
      filters: { ...filters, ...newFilters },
      currentPage: 1,
    });
    await get().loadTransactions(portfolioId);
  },

  setSort: async (portfolioId, column, direction) => {
    set({ sortColumn: column, sortDirection: direction });
    await get().loadTransactions(portfolioId);
  },

  setPage: async (portfolioId, page) => {
    set({ currentPage: page });
    await get().loadTransactions(portfolioId);
  },

  computeHoldings: async (_portfolioId) => {
    // Placeholder — will be properly implemented in task 4.1
    set({ holdings: [] });
  },

  computePerformance: async (_portfolioId, _initialBalance) => {
    // Placeholder — will be properly implemented in task 4.3
    set({ performanceSummary: { ...defaultPerformanceSummary } });
  },
}));

/**
 * Sort transactions locally by the specified column and direction.
 */
function sortTransactionsLocal(
  transactions: PortfolioTransaction[],
  column: string,
  direction: 'asc' | 'desc',
): PortfolioTransaction[] {
  const sorted = [...transactions].sort((a, b) => {
    const aVal = getColumnValue(a, column);
    const bVal = getColumnValue(b, column);

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return direction === 'asc' ? -1 : 1;
    if (bVal == null) return direction === 'asc' ? 1 : -1;

    if (aVal instanceof Date && bVal instanceof Date) {
      return aVal.getTime() - bVal.getTime();
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return aVal - bVal;
    }

    return String(aVal).localeCompare(String(bVal));
  });

  if (direction === 'desc') {
    sorted.reverse();
  }

  return sorted;
}

/**
 * Extract a sortable value from a transaction by column name.
 */
function getColumnValue(
  txn: PortfolioTransaction,
  column: string,
): string | number | Date | null | undefined {
  switch (column) {
    case 'transactionDate':
      return txn.transactionDate;
    case 'settlementDate':
      return txn.settlementDate;
    case 'symbol':
      return txn.symbol;
    case 'description':
      return txn.description;
    case 'transactionType':
      return txn.transactionType;
    case 'assetType':
      return txn.assetType;
    case 'optionType':
      return txn.optionType;
    case 'strikePrice':
      return txn.strikePrice;
    case 'quantity':
      return txn.quantity;
    case 'price':
      return txn.price;
    case 'amount':
      return txn.amount;
    case 'fees':
      return txn.fees;
    default:
      return null;
  }
}
