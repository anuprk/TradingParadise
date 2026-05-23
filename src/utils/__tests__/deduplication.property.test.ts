/**
 * Property-based tests for the de-duplication engine.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 4: Duplicate detection excludes transactions with matching fingerprints
 *
 * Validates: Requirements 4.2, 5.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { findDuplicates } from '../../utils/deduplication';
import { computeFingerprint } from '../../utils/fingerprint';
import type { PortfolioTransaction, TransactionType, AssetType, TransactionSource } from '../../types/transaction';
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

/**
 * Generate an array of PortfolioTransactions with unique IDs.
 */
const arbTransactionArray: fc.Arbitrary<PortfolioTransaction[]> = fc.array(
  arbPortfolioTransaction,
  { minLength: 0, maxLength: 10 },
);

// --- Property 4: Duplicate detection excludes transactions with matching fingerprints ---

describe('Property 4: Duplicate detection excludes transactions with matching fingerprints', () => {
  /**
   * Validates: Requirements 4.2, 5.6
   * Every transaction in `duplicates` has a fingerprint that exists in the existing set.
   */
  it('every duplicate has a fingerprint matching an existing transaction', () => {
    fc.assert(
      fc.property(
        arbTransactionArray,
        arbTransactionArray,
        (newTransactions, existingTransactions) => {
          const report = findDuplicates(newTransactions, existingTransactions);

          const existingFingerprints = new Set(
            existingTransactions.map((txn) => computeFingerprint(txn)),
          );

          for (const dup of report.duplicates) {
            const fp = computeFingerprint(dup.transaction);
            expect(existingFingerprints.has(fp)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.2, 5.6
   * Every transaction in `unique` has a fingerprint that does NOT exist in the existing set.
   */
  it('every unique transaction has a fingerprint not matching any existing transaction', () => {
    fc.assert(
      fc.property(
        arbTransactionArray,
        arbTransactionArray,
        (newTransactions, existingTransactions) => {
          const report = findDuplicates(newTransactions, existingTransactions);

          const existingFingerprints = new Set(
            existingTransactions.map((txn) => computeFingerprint(txn)),
          );

          for (const uniqueTxn of report.unique) {
            const fp = computeFingerprint(uniqueTxn);
            expect(existingFingerprints.has(fp)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.2, 5.6
   * duplicates.length + unique.length === newTransactions.length (partition property).
   */
  it('duplicates and unique partition the new transactions completely', () => {
    fc.assert(
      fc.property(
        arbTransactionArray,
        arbTransactionArray,
        (newTransactions, existingTransactions) => {
          const report = findDuplicates(newTransactions, existingTransactions);

          expect(report.duplicates.length + report.unique.length).toBe(
            newTransactions.length,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.2, 5.6
   * If a new transaction is an exact copy of an existing one (same fingerprint fields),
   * it appears in duplicates.
   */
  it('exact copies of existing transactions are always detected as duplicates', () => {
    fc.assert(
      fc.property(
        arbTransactionArray.filter((arr) => arr.length > 0),
        fc.nat({ max: 50 }),
        (existingTransactions, extraIndex) => {
          // Pick one existing transaction and create a "new" copy with a different id
          const sourceIdx = extraIndex % existingTransactions.length;
          const source = existingTransactions[sourceIdx];
          const copy: PortfolioTransaction = {
            ...source,
            id: `copy-${source.id}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const report = findDuplicates([copy], existingTransactions);

          // The copy should be in duplicates
          expect(report.duplicates.length).toBe(1);
          expect(report.duplicates[0].transaction.id).toBe(copy.id);
          expect(report.unique.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
