/**
 * Property-based tests for Tastytrade PDF parser round-trip consistency.
 * Uses fast-check to verify that formatting transaction field values into
 * tastytrade text representation then parsing that text produces a
 * PortfolioTransaction with identical field values.
 *
 * Feature: portfolio-management, Property 11: Tastytrade parser round-trip consistency
 *
 * Validates: Requirements 9.8
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { TastytradeParser } from '../../utils/parsers/tastytradeParser';
import type { OptionType } from '../../types/journal';

// Mock pdfUtils to return controlled text content
vi.mock('../../utils/parsers/pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { extractTextFromPDF } from '../../utils/parsers/pdfUtils';

const mockedExtractTextFromPDF = vi.mocked(extractTextFromPDF);

// --- Generators ---

const arbSymbol: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z]{1,5}$/);

const arbDate: fc.Arbitrary<Date> = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
  noInvalidDate: true,
});

const arbPositivePrice: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 9999.99,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbFees: fc.Arbitrary<number> = fc.double({
  min: 0.01,
  max: 99.99,
  noNaN: true,
  noDefaultInfinity: true,
});

const arbQuantity: fc.Arbitrary<number> = fc.integer({ min: 1, max: 1000 });

const arbOptionType: fc.Arbitrary<OptionType> = fc.constantFrom('Call', 'Put');

const arbStrikePrice: fc.Arbitrary<number> = fc.double({
  min: 1,
  max: 9999,
  noNaN: true,
  noDefaultInfinity: true,
});

// --- Helpers ---

/**
 * Format a date as MM/DD/YY for tastytrade text representation.
 */
function formatDateMMDDYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear() % 100).padStart(2, '0');
  return `${month}/${day}/${year}`;
}

/**
 * Format a number with 2 decimal places for tastytrade text.
 */
function formatNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * Build a tastytrade-style text line for a stock transaction.
 * Format: "MM/DD/YY SYMBOL Buy/Sell QUANTITY PRICE FEES AMOUNT"
 */
function buildStockLine(params: {
  date: Date;
  symbol: string;
  direction: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  fees: number;
  amount: number;
}): string {
  const dateStr = formatDateMMDDYY(params.date);
  return `${dateStr} ${params.symbol} ${params.direction} ${params.quantity} ${formatNumber(params.price)} ${formatNumber(params.fees)} ${formatNumber(params.amount)}`;
}

/**
 * Build a tastytrade-style text line for an options transaction.
 * Format: "MM/DD/YY SYMBOL MM/DD/YY C/PSTRIKE Buy/Sell QUANTITY PRICE FEES AMOUNT"
 * The options description is embedded: "SYMBOL MM/DD/YY C/PSTRIKE"
 */
function buildOptionsLine(params: {
  date: Date;
  symbol: string;
  expirationDate: Date;
  optionType: OptionType;
  strikePrice: number;
  direction: 'Buy' | 'Sell';
  quantity: number;
  price: number;
  fees: number;
  amount: number;
}): string {
  const dateStr = formatDateMMDDYY(params.date);
  const expStr = formatDateMMDDYY(params.expirationDate);
  const typeChar = params.optionType === 'Call' ? 'C' : 'P';
  const strikeStr = params.strikePrice % 1 === 0
    ? String(Math.round(params.strikePrice))
    : formatNumber(params.strikePrice);
  // Options description format: "SYMBOL MM/DD/YY C/PSTRIKE"
  const optDesc = `${params.symbol} ${expStr} ${typeChar}${strikeStr}`;
  return `${dateStr} ${optDesc} ${params.direction} ${params.quantity} ${formatNumber(params.price)} ${formatNumber(params.fees)} ${formatNumber(params.amount)}`;
}

/**
 * Wrap transaction lines in a tastytrade-style document with the required header.
 */
function wrapInDocument(lines: string[]): string {
  return `Account Activity\n${lines.join('\n')}`;
}

/**
 * Compare two dates at the day level (ignoring time).
 */
function datesEqualDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// --- Property 11: Tastytrade parser round-trip consistency ---

describe('Property 11: Tastytrade parser round-trip consistency', () => {
  const parser = new TastytradeParser();
  const portfolioId = 'test-portfolio-id';
  const planId = 'test-plan-id';

  /**
   * Validates: Requirements 9.8
   * For stock transactions: format as tastytrade text → parse → verify
   * symbol, date, quantity, price, fees, amount match.
   */
  it('stock transactions: format → parse → fields match', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSymbol,
        arbDate,
        fc.constantFrom('Buy' as const, 'Sell' as const),
        arbQuantity,
        arbPositivePrice,
        arbFees,
        arbPositivePrice,
        async (symbol, date, direction, quantity, price, fees, amount) => {
          const line = buildStockLine({ date, symbol, direction, quantity, price, fees, amount });
          const docText = wrapInDocument([line]);

          mockedExtractTextFromPDF.mockResolvedValue([docText]);

          const result = await parser.parse(new ArrayBuffer(0), portfolioId, planId);

          expect(result.transactions.length).toBe(1);
          const txn = result.transactions[0];

          // Verify symbol matches
          expect(txn.symbol).toBe(symbol.toUpperCase());

          // Verify date matches at day level
          expect(datesEqualDay(txn.transactionDate, date)).toBe(true);

          // Verify quantity matches
          expect(txn.quantity).toBe(quantity);

          // Verify price matches (to 2dp)
          expect(txn.price.toFixed(2)).toBe(price.toFixed(2));

          // Verify fees match (to 2dp)
          expect(txn.fees.toFixed(2)).toBe(fees.toFixed(2));

          // Verify amount matches (to 2dp)
          expect(txn.amount.toFixed(2)).toBe(amount.toFixed(2));
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 9.8
   * For options transactions: format as tastytrade text → parse → verify
   * symbol, date, optionType, strikePrice, expirationDate, quantity, price, fees, amount match.
   */
  it('options transactions: format → parse → fields match', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbSymbol,
        arbDate,
        arbOptionType,
        arbStrikePrice,
        arbDate,
        fc.constantFrom('Buy' as const, 'Sell' as const),
        arbQuantity,
        arbPositivePrice,
        arbFees,
        arbPositivePrice,
        async (symbol, date, optionType, strikePrice, expirationDate, direction, quantity, price, fees, amount) => {
          const line = buildOptionsLine({
            date,
            symbol,
            expirationDate,
            optionType,
            strikePrice,
            direction,
            quantity,
            price,
            fees,
            amount,
          });
          const docText = wrapInDocument([line]);

          mockedExtractTextFromPDF.mockResolvedValue([docText]);

          const result = await parser.parse(new ArrayBuffer(0), portfolioId, planId);

          expect(result.transactions.length).toBe(1);
          const txn = result.transactions[0];

          // Verify symbol matches
          expect(txn.symbol).toBe(symbol.toUpperCase());

          // Verify date matches at day level
          expect(datesEqualDay(txn.transactionDate, date)).toBe(true);

          // Verify option type matches
          expect(txn.optionType).toBe(optionType);

          // Verify strike price matches (to 2dp)
          expect(txn.strikePrice!.toFixed(2)).toBe(strikePrice.toFixed(2));

          // Verify expiration date matches at day level
          expect(datesEqualDay(txn.expirationDate!, expirationDate)).toBe(true);

          // Verify quantity matches
          expect(txn.quantity).toBe(quantity);

          // Verify price matches (to 2dp)
          expect(txn.price.toFixed(2)).toBe(price.toFixed(2));

          // Verify fees match (to 2dp)
          expect(txn.fees.toFixed(2)).toBe(fees.toFixed(2));

          // Verify amount matches (to 2dp)
          expect(txn.amount.toFixed(2)).toBe(amount.toFixed(2));
        },
      ),
      { numRuns: 100 },
    );
  });
});
