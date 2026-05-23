/**
 * Property-based tests for transaction fingerprint utility.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 3: Transaction fingerprint determinism and field sensitivity
 *
 * Validates: Requirements 4.1, 4.6, 4.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

// --- Property 3: Transaction fingerprint determinism and field sensitivity ---

describe('Property 3: Transaction fingerprint determinism and field sensitivity', () => {
  /**
   * Validates: Requirements 4.1, 4.6
   * For any valid PortfolioTransaction, computing the fingerprint twice
   * SHALL produce the same string (determinism).
   */
  it('determinism: same transaction always produces the same fingerprint', () => {
    fc.assert(
      fc.property(arbPortfolioTransaction, (txn) => {
        const fp1 = computeFingerprint(txn);
        const fp2 = computeFingerprint(txn);
        expect(fp1).toBe(fp2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in transactionDate,
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different transactionDate produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbDate,
        (txn, differentDate) => {
          // Ensure the dates are actually different at the UTC day level
          const origDay = `${txn.transactionDate.getUTCFullYear()}-${txn.transactionDate.getUTCMonth()}-${txn.transactionDate.getUTCDate()}`;
          const newDay = `${differentDate.getUTCFullYear()}-${differentDate.getUTCMonth()}-${differentDate.getUTCDate()}`;
          fc.pre(origDay !== newDay);

          const txn2 = { ...txn, transactionDate: differentDate };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in symbol,
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different symbol produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbSymbol,
        (txn, differentSymbol) => {
          fc.pre(txn.symbol.trim().toUpperCase() !== differentSymbol.trim().toUpperCase());

          const txn2 = { ...txn, symbol: differentSymbol };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in transactionType,
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different transactionType produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbTransactionType,
        (txn, differentType) => {
          fc.pre(txn.transactionType !== differentType);

          const txn2 = { ...txn, transactionType: differentType };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in optionType,
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different optionType produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbOptionType,
        (txn, differentOptType) => {
          const origOpt = txn.optionType ?? 'None';
          const newOpt = differentOptType ?? 'None';
          fc.pre(origOpt !== newOpt);

          const txn2 = { ...txn, optionType: differentOptType };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in strikePrice (at 2dp),
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different strikePrice (at 2dp) produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        fc.double({ min: 1, max: 10_000, noNaN: true, noDefaultInfinity: true }),
        (txn, differentStrike) => {
          const origStrike = (txn.strikePrice ?? 0).toFixed(2);
          const newStrike = differentStrike.toFixed(2);
          fc.pre(origStrike !== newStrike);

          const txn2 = { ...txn, strikePrice: differentStrike };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in price (at 2dp),
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different price (at 2dp) produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbPrice,
        (txn, differentPrice) => {
          fc.pre(txn.price.toFixed(2) !== differentPrice.toFixed(2));

          const txn2 = { ...txn, price: differentPrice };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.1, 4.6
   * For any two transactions that differ in quantity (at 4dp),
   * their fingerprints SHALL differ.
   */
  it('field sensitivity: different quantity (at 4dp) produces different fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        arbQuantity,
        (txn, differentQty) => {
          fc.pre(txn.quantity.toFixed(4) !== differentQty.toFixed(4));

          const txn2 = { ...txn, quantity: differentQty };
          expect(computeFingerprint(txn)).not.toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 4.7
   * For any two transactions whose strikePrice and price values are equal
   * when rounded to 2 decimal places, and all other fingerprint fields are
   * identical, their fingerprints SHALL be equal.
   */
  it('decimal precision: strikePrice/price equal at 2dp produces same fingerprint', () => {
    fc.assert(
      fc.property(
        arbPortfolioTransaction,
        fc.double({ min: 0.001, max: 0.004, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.001, max: 0.004, noNaN: true, noDefaultInfinity: true }),
        (txn, strikeDelta, priceDelta) => {
          // Create a base transaction with known strikePrice and price
          const baseStrike = Math.floor((txn.strikePrice ?? 100) * 100) / 100; // round to 2dp
          const basePrice = Math.floor(txn.price * 100) / 100; // round to 2dp

          const txn1 = { ...txn, strikePrice: baseStrike + strikeDelta * 0.001, price: basePrice + priceDelta * 0.001 };
          const txn2 = { ...txn, strikePrice: baseStrike + strikeDelta * 0.0001, price: basePrice + priceDelta * 0.0001 };

          // Both should round to the same 2dp values
          fc.pre(txn1.strikePrice!.toFixed(2) === txn2.strikePrice!.toFixed(2));
          fc.pre(txn1.price.toFixed(2) === txn2.price.toFixed(2));

          expect(computeFingerprint(txn1)).toBe(computeFingerprint(txn2));
        },
      ),
      { numRuns: 100 },
    );
  });
});
