/**
 * Transaction filtering and sorting utilities for the Portfolio Transactions view.
 *
 * Filters are AND-combined: a transaction must satisfy all active filter conditions.
 * Sorting supports all displayed columns with null/undefined values sorted to the end.
 */

import type {
  PortfolioTransaction,
  TransactionFilterState,
} from '../types/transaction';

/**
 * Filters transactions by the given filter state.
 * All filters are AND-combined. Empty/null filter values are skipped.
 *
 * - symbol: case-insensitive substring match (contains)
 * - dateFrom: include transactions with transactionDate >= dateFrom
 * - dateTo: include transactions with transactionDate <= dateTo
 * - transactionType: exact match (skip if empty string)
 * - assetType: exact match (skip if empty string)
 */
export function filterTransactions(
  transactions: PortfolioTransaction[],
  filters: TransactionFilterState,
): PortfolioTransaction[] {
  return transactions.filter((txn) => {
    // Symbol: case-insensitive contains
    if (filters.symbol) {
      const needle = filters.symbol.toLowerCase();
      if (!txn.symbol.toLowerCase().includes(needle)) {
        return false;
      }
    }

    // Date from: transactionDate >= dateFrom
    if (filters.dateFrom) {
      if (txn.transactionDate.getTime() < filters.dateFrom.getTime()) {
        return false;
      }
    }

    // Date to: transactionDate <= dateTo
    if (filters.dateTo) {
      if (txn.transactionDate.getTime() > filters.dateTo.getTime()) {
        return false;
      }
    }

    // Transaction type: exact match
    if (filters.transactionType) {
      if (txn.transactionType !== filters.transactionType) {
        return false;
      }
    }

    // Asset type: exact match
    if (filters.assetType) {
      if (txn.assetType !== filters.assetType) {
        return false;
      }
    }

    return true;
  });
}

/** Columns that can be sorted on in the transactions table. */
export type SortableColumn =
  | 'transactionDate'
  | 'symbol'
  | 'transactionType'
  | 'assetType'
  | 'optionType'
  | 'strikePrice'
  | 'quantity'
  | 'price'
  | 'amount'
  | 'fees';

export type SortDirection = 'asc' | 'desc';

/** Columns that hold string values and should use localeCompare. */
const STRING_COLUMNS: ReadonlySet<string> = new Set([
  'symbol',
  'transactionType',
  'assetType',
  'optionType',
]);

/** Columns that hold Date values and should compare by timestamp. */
const DATE_COLUMNS: ReadonlySet<string> = new Set(['transactionDate']);

/**
 * Sorts transactions by the specified column and direction.
 * Handles null/undefined values by sorting them to the end regardless of direction.
 * - Dates: compared by timestamp
 * - Strings: compared using localeCompare
 * - Numbers: numeric comparison
 */
export function sortTransactions(
  transactions: PortfolioTransaction[],
  column: SortableColumn,
  direction: SortDirection,
): PortfolioTransaction[] {
  const sorted = [...transactions];
  const dirMultiplier = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    // Null/undefined values sort to the end regardless of direction
    const aNull = aVal == null;
    const bNull = bVal == null;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    // Date comparison by timestamp
    if (DATE_COLUMNS.has(column)) {
      const aTime = (aVal as Date).getTime();
      const bTime = (bVal as Date).getTime();
      return (aTime - bTime) * dirMultiplier;
    }

    // String comparison using localeCompare
    if (STRING_COLUMNS.has(column)) {
      return (aVal as string).localeCompare(bVal as string) * dirMultiplier;
    }

    // Numeric comparison
    return ((aVal as number) - (bVal as number)) * dirMultiplier;
  });

  return sorted;
}
