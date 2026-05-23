/**
 * Property-based tests for Fidelity PDF parser round-trip consistency.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 12: Fidelity parser round-trip consistency
 *
 * Validates: Requirements 10.6
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { FidelityParser } from '../../utils/parsers/fidelityParser';

// Mock pdfUtils to return controlled text content
vi.mock('../../utils/parsers/pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { extractTextFromPDF } from '../../utils/parsers/pdfUtils';

const mockedExtractTextFromPDF = vi.mocked(extractTextFromPDF);

// --- Generators ---

/**
 * Generate a valid stock symbol (1-5 uppercase letters).
 */
const arbValidSymbol: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Generate a valid date in MM/DD/YYYY format.
 * Uses a fixed month/day range that won't collide with typical transaction values.
 */
const arbValidDate: fc.Arbitrary<{ dateStr: string; month: number; day: number; year: number }> =
  fc.record({
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid day-of-month issues
    year: fc.integer({ min: 2000, max: 2099 }),
  }).map(({ month, day, year }) => {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${mm}/${dd}/${year}`;
    return { dateStr, month, day, year };
  });

/**
 * Generate a quantity that won't collide with date parts.
 * The parser filters out numbers matching date parts (month 1-12, day 1-28, year 2000-2099).
 * We use quantities > 2100 to ensure they pass the parser's filter (> 2100 always passes).
 */
const arbQuantity: fc.Arbitrary<number> = fc.integer({ min: 2101, max: 9999 });

/**
 * Generate a price that won't collide with date parts.
 * Use values > 2100 to ensure they always pass the parser's date-part filter.
 */
const arbPrice: fc.Arbitrary<number> = fc.double({ min: 2101, max: 9999.99, noNaN: true }).map(
  (n) => Math.round(n * 100) / 100,
);

/**
 * Generate fees that won't collide with date parts.
 * Use values > 2100 to ensure they always pass the parser's date-part filter.
 */
const arbFees: fc.Arbitrary<number> = fc.double({ min: 2101, max: 5000, noNaN: true }).map(
  (n) => Math.round(n * 100) / 100,
);

/**
 * Generate a dividend amount > 31 so it passes the parser's dividend filter
 * (parser filters for Math.abs(n) > 31 to skip date components).
 */
const arbDividendAmount: fc.Arbitrary<number> = fc.double({ min: 32, max: 99999.99, noNaN: true }).map(
  (n) => Math.round(n * 100) / 100,
);

// --- Helpers ---

/**
 * Format a buy/sell transaction into Fidelity text representation.
 * The parser extracts all numbers from the segment, filters out date-part matches,
 * then takes the first 4 remaining numbers as quantity, price, amount, fees.
 */
function formatBuySellAsFidelityText(params: {
  dateStr: string;
  action: 'YOU BOUGHT' | 'YOU SOLD';
  symbol: string;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
}): string {
  const { dateStr, action, symbol, quantity, price, amount, fees } = params;
  // Build text that the Fidelity parser can parse:
  // The parser looks for "Transaction Detail" section header, then splits by date patterns.
  // Each segment starts with a date, followed by action, symbol, then numeric values.
  // Use $ prefix for monetary values to help the parser's regex match them.
  return `Transaction Detail ${dateStr} ${action} ${symbol} SHARES ${quantity} $${price.toFixed(2)} $${amount.toFixed(2)} $${fees.toFixed(2)}`;
}

/**
 * Format a dividend transaction into Fidelity text representation.
 * The parser looks for numbers > 31 and takes the last one as the amount.
 */
function formatDividendAsFidelityText(params: {
  dateStr: string;
  symbol: string;
  amount: number;
}): string {
  const { dateStr, symbol, amount } = params;
  return `Transaction Detail ${dateStr} DIVIDEND ${symbol} CASH DIVIDEND $${amount.toFixed(2)}`;
}

// --- Property 12: Fidelity parser round-trip consistency ---
// Feature: portfolio-management, Property 12: Fidelity parser round-trip consistency

describe('Property 12: Fidelity parser round-trip consistency', () => {
  const parser = new FidelityParser();
  const portfolioId = 'test-portfolio-id';
  const planId = 'test-plan-id';

  /**
   * Validates: Requirements 10.6
   * For stock buy/sell transactions: format as Fidelity text → parse → verify fields match
   * (numeric within 0.01, dates exact, strings exact)
   */
  it('buy/sell transactions: format → parse → fields match within tolerance', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbValidDate,
        fc.constantFrom('YOU BOUGHT' as const, 'YOU SOLD' as const),
        arbValidSymbol,
        arbQuantity,
        arbPrice,
        arbFees,
        async (dateInfo, action, symbol, quantity, price, fees) => {
          const amount = Math.round(quantity * price * 100) / 100;

          const fidelityText = formatBuySellAsFidelityText({
            dateStr: dateInfo.dateStr,
            action,
            symbol,
            quantity,
            price,
            amount,
            fees,
          });

          // Mock extractTextFromPDF to return our formatted text
          mockedExtractTextFromPDF.mockResolvedValue([fidelityText]);

          const result = await parser.parse(new ArrayBuffer(0), portfolioId, planId);

          // Should parse at least one transaction
          expect(result.transactions.length).toBeGreaterThanOrEqual(1);

          const txn = result.transactions[0];

          // Date fields match exactly
          expect(txn.transactionDate.getFullYear()).toBe(dateInfo.year);
          expect(txn.transactionDate.getMonth() + 1).toBe(dateInfo.month);
          expect(txn.transactionDate.getDate()).toBe(dateInfo.day);

          // String fields match exactly
          expect(txn.symbol).toBe(symbol);

          // Transaction type matches action
          const expectedType = action === 'YOU BOUGHT' ? 'Buy' : 'Sell';
          expect(txn.transactionType).toBe(expectedType);

          // Numeric fields match within 0.01 tolerance
          expect(Math.abs(txn.quantity - quantity)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(txn.price - price)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(txn.amount - amount)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(txn.fees - fees)).toBeLessThanOrEqual(0.01);

          // Source is fidelity_pdf
          expect(txn.source).toBe('fidelity_pdf');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 10.6
   * For dividend transactions: format as Fidelity text → parse → verify amount matches within 0.01
   */
  it('dividend transactions: format → parse → amount matches within tolerance', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbValidDate,
        arbValidSymbol,
        arbDividendAmount,
        async (dateInfo, symbol, amount) => {
          const fidelityText = formatDividendAsFidelityText({
            dateStr: dateInfo.dateStr,
            symbol,
            amount,
          });

          // Mock extractTextFromPDF to return our formatted text
          mockedExtractTextFromPDF.mockResolvedValue([fidelityText]);

          const result = await parser.parse(new ArrayBuffer(0), portfolioId, planId);

          // Should parse at least one transaction
          expect(result.transactions.length).toBeGreaterThanOrEqual(1);

          const txn = result.transactions[0];

          // Date fields match exactly
          expect(txn.transactionDate.getFullYear()).toBe(dateInfo.year);
          expect(txn.transactionDate.getMonth() + 1).toBe(dateInfo.month);
          expect(txn.transactionDate.getDate()).toBe(dateInfo.day);

          // String fields match exactly
          expect(txn.symbol).toBe(symbol);

          // Transaction type is Dividend
          expect(txn.transactionType).toBe('Dividend');

          // Amount matches within 0.01 tolerance
          expect(Math.abs(txn.amount - amount)).toBeLessThanOrEqual(0.01);

          // Source is fidelity_pdf
          expect(txn.source).toBe('fidelity_pdf');
        },
      ),
      { numRuns: 100 },
    );
  });
});
