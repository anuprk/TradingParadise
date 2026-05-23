/**
 * Property-based tests for transaction sorting utility.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 9: Transaction sorting produces correct order
 *
 * Validates: Requirements 7.3, 7.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sortTransactions } from '../../utils/transactionFilters';
import type { SortableColumn, SortDirection } from '../../utils/transactionFilters';
import type {
  PortfolioTransaction,
  TransactionType,
  AssetType,
  TransactionSource,
} from '../../types/transaction';
import type { OptionType } from '../../types/journal';

// --- Generators ---

const arbTransactionType: fc.Arbitrary<TransactionType> = fc.constantFrom(
  'Buy', 'Sell', 'Dividend', 'Fee', 'Transfer', 'Expiration', 'Assignment',
);

const arbAssetType: fc.Arbitrary<AssetType> = fc.constantFrom('Stock', 'ETF', 'Option', 'Cash');

const arbTransactionSource: fc.Arbitrary<TransactionSource> = fc.constantFrom(
  'tastytrade_pdf', 'fidelity_pdf', 'csv', 'manual',
);

const arbOptionType: fc.Arbitrary<OptionType | undefined> = fc.constantFrom(
  'Call' as const, 'Put' as const, undefined,
);

const arbSymbol: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z]{1,5}$/);

const arbPrice: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbQuantity: fc.Arbitrary<number> = fc.double({
  min: 0.0001,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbStrikePrice: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.double({ min: 1, max: 10_000, noNaN: true, noDefaultInfinity: true }),
);

const arbDate: fc.Arbitrary<Date> = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
  noInvalidDate: true,
});

/**
 * Generate a valid PortfolioTransaction with arbitrary field values.
 */
const arbPortfolioTransaction: fc.Arbitrary<PortfolioTransaction> = fc.record({
  id: fc.uuid(),
  portfolioId: fc.uuid(),
  planId: fc.uuid(),
  transactionDate: arbDate,
  settlementDate: fc.option(arbDate, { nil: undefined }),
  symbol: arbSymbol,
  description: fc.string({ minLength: 0, maxLength: 50 }),
  transactionType: arbTransactionType,
  assetType: arbAssetType,
  optionType: arbOptionType,
  strikePrice: arbStrikePrice,
  expirationDate: fc.option(arbDate, { nil: undefined }),
  quantity: arbQuantity,
  price: arbPrice,
  amount: arbPrice,
  fees: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
  source: arbTransactionSource,
  rawDescription: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  createdAt: arbDate,
  updatedAt: arbDate,
});

const arbSortableColumn: fc.Arbitrary<SortableColumn> = fc.constantFrom(
  'transactionDate',
  'symbol',
  'transactionType',
  'assetType',
  'optionType',
  'strikePrice',
  'quantity',
  'price',
  'amount',
  'fees',
);

const arbSortDirection: fc.Arbitrary<SortDirection> = fc.constantFrom('asc', 'desc');

// --- Helpers ---

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
 * Compare two values from a sortable column.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareValues(
  aVal: string | number | Date | undefined | null,
  bVal: string | number | Date | undefined | null,
  column: SortableColumn,
): number {
  if (DATE_COLUMNS.has(column)) {
    return (aVal as Date).getTime() - (bVal as Date).getTime();
  }
  if (STRING_COLUMNS.has(column)) {
    return (aVal as string).localeCompare(bVal as string);
  }
  return (aVal as number) - (bVal as number);
}

// --- Property 9: Transaction sorting produces correct order ---

describe('Property 9: Transaction sorting produces correct order', () => {
  /**
   * Validates: Requirements 7.3, 7.4
   * For ascending sort: every adjacent pair (a, b) has a's value ≤ b's value
   * (or b is null/undefined, meaning nulls are at the end).
   */
  it('ascending sort: every adjacent pair has a.value <= b.value for non-null values', () => {
    fc.assert(
      fc.property(
        fc.array(arbPortfolioTransaction, { minLength: 2, maxLength: 50 }),
        arbSortableColumn,
        (transactions, column) => {
          const sorted = sortTransactions(transactions, column, 'asc');

          for (let i = 0; i < sorted.length - 1; i++) {
            const aVal = sorted[i][column];
            const bVal = sorted[i + 1][column];

            // If a is null, b must also be null (nulls at end)
            if (aVal == null) {
              expect(bVal == null).toBe(true);
              continue;
            }

            // If b is null, that's fine (null at end)
            if (bVal == null) {
              continue;
            }

            // Both non-null: a <= b
            const cmp = compareValues(aVal, bVal, column);
            expect(cmp).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 7.3, 7.4
   * For descending sort: every adjacent pair (a, b) has a's value >= b's value
   * (or b is null/undefined, meaning nulls are at the end).
   */
  it('descending sort: every adjacent pair has a.value >= b.value for non-null values', () => {
    fc.assert(
      fc.property(
        fc.array(arbPortfolioTransaction, { minLength: 2, maxLength: 50 }),
        arbSortableColumn,
        (transactions, column) => {
          const sorted = sortTransactions(transactions, column, 'desc');

          for (let i = 0; i < sorted.length - 1; i++) {
            const aVal = sorted[i][column];
            const bVal = sorted[i + 1][column];

            // If a is null, b must also be null (nulls at end)
            if (aVal == null) {
              expect(bVal == null).toBe(true);
              continue;
            }

            // If b is null, that's fine (null at end)
            if (bVal == null) {
              continue;
            }

            // Both non-null: a >= b
            const cmp = compareValues(aVal, bVal, column);
            expect(cmp).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 7.3, 7.4
   * Sorting preserves the set of elements (same length, same elements).
   */
  it('sorting preserves the set of elements (same length, same IDs)', () => {
    fc.assert(
      fc.property(
        fc.array(arbPortfolioTransaction, { minLength: 0, maxLength: 50 }),
        arbSortableColumn,
        arbSortDirection,
        (transactions, column, direction) => {
          const sorted = sortTransactions(transactions, column, direction);

          // Same length
          expect(sorted).toHaveLength(transactions.length);

          // Same set of IDs (order-independent)
          const originalIds = transactions.map((t) => t.id).sort();
          const sortedIds = sorted.map((t) => t.id).sort();
          expect(sortedIds).toEqual(originalIds);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 7.3, 7.4
   * Null/undefined values are always at the end regardless of direction.
   */
  it('null/undefined values are always sorted to the end regardless of direction', () => {
    fc.assert(
      fc.property(
        fc.array(arbPortfolioTransaction, { minLength: 1, maxLength: 50 }),
        arbSortableColumn,
        arbSortDirection,
        (transactions, column, direction) => {
          const sorted = sortTransactions(transactions, column, direction);

          // Find the first null/undefined value index
          let firstNullIdx = -1;
          for (let i = 0; i < sorted.length; i++) {
            if (sorted[i][column] == null) {
              firstNullIdx = i;
              break;
            }
          }

          // If there are null values, all values after the first null must also be null
          if (firstNullIdx !== -1) {
            for (let i = firstNullIdx; i < sorted.length; i++) {
              expect(sorted[i][column] == null).toBe(true);
            }
          }

          // All values before the first null (or all values if no nulls) must be non-null
          const endIdx = firstNullIdx === -1 ? sorted.length : firstNullIdx;
          for (let i = 0; i < endIdx; i++) {
            expect(sorted[i][column] != null).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
