/**
 * Property-based tests for CSV import parsing.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 5: CSV parsing extracts all valid rows with correct field mapping
 * Feature: portfolio-management, Property 6: CSV parser skips invalid rows with error reporting
 *
 * Validates: Requirements 3.3, 3.4, 3.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CsvParser } from '../../utils/parsers/csvParser';

// --- Generators ---

/**
 * Generate a valid stock symbol (1-5 uppercase letters).
 */
const arbValidSymbol: fc.Arbitrary<string> = fc.stringMatching(/^[A-Z]{1,5}$/);

/**
 * Generate a valid date string in MM/DD/YYYY format.
 */
const arbValidDateStr: fc.Arbitrary<string> = fc.record({
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid day-of-month issues
  year: fc.integer({ min: 2000, max: 2099 }),
}).map(({ month, day, year }) => {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${mm}/${dd}/${year}`;
});

/**
 * Generate an invalid date string (random non-date text).
 */
const arbInvalidDateStr: fc.Arbitrary<string> = fc.oneof(
  fc.stringMatching(/^[a-z]{3,10}$/), // random lowercase text like "abcdef"
  fc.constant('not-a-date'),
  fc.constant('13/32/2024'), // invalid month/day
  fc.constant('00/00/0000'),
  fc.constant('XX/YY/ZZZZ'),
);

/**
 * Generate an empty or whitespace-only symbol (invalid).
 */
const arbEmptySymbol: fc.Arbitrary<string> = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
);

/**
 * Represents a valid CSV data row.
 */
interface ValidRow {
  kind: 'valid';
  symbol: string;
  date: string;
}

/**
 * Represents an invalid CSV data row (empty symbol).
 */
interface InvalidSymbolRow {
  kind: 'invalidSymbol';
  symbol: string;
  date: string;
}

/**
 * Represents an invalid CSV data row (unparseable date).
 */
interface InvalidDateRow {
  kind: 'invalidDate';
  symbol: string;
  date: string;
}

type CsvRow = ValidRow | InvalidSymbolRow | InvalidDateRow;

const arbValidRow: fc.Arbitrary<ValidRow> = fc.record({
  kind: fc.constant('valid' as const),
  symbol: arbValidSymbol,
  date: arbValidDateStr,
});

const arbInvalidSymbolRow: fc.Arbitrary<InvalidSymbolRow> = fc.record({
  kind: fc.constant('invalidSymbol' as const),
  symbol: arbEmptySymbol,
  date: arbValidDateStr,
});

const arbInvalidDateRow: fc.Arbitrary<InvalidDateRow> = fc.record({
  kind: fc.constant('invalidDate' as const),
  symbol: arbValidSymbol,
  date: arbInvalidDateStr,
});

const arbInvalidRow: fc.Arbitrary<CsvRow> = fc.oneof(arbInvalidSymbolRow, arbInvalidDateRow);

/**
 * Generate a mixed array of valid and invalid rows (at least 1 invalid).
 */
const arbMixedRows: fc.Arbitrary<CsvRow[]> = fc.tuple(
  fc.array(arbValidRow, { minLength: 0, maxLength: 10 }),
  fc.array(arbInvalidRow, { minLength: 1, maxLength: 10 }),
).chain(([validRows, invalidRows]) => {
  const all: CsvRow[] = [...validRows, ...invalidRows];
  // Shuffle the rows
  return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
});

/**
 * Build CSV text from an array of rows.
 */
function buildCsv(rows: CsvRow[]): string {
  const header = 'Stock Symbol,Open Date';
  const dataLines = rows.map((row) => `${row.symbol},${row.date}`);
  return [header, ...dataLines].join('\n');
}

// --- Property 5: CSV parsing extracts all valid rows with correct field mapping ---
// Feature: portfolio-management, Property 5: CSV parsing extracts all valid rows with correct field mapping

describe('Property 5: CSV parsing extracts all valid rows with correct field mapping', () => {
  const parser = new CsvParser();
  const portfolioId = 'test-portfolio-id';
  const planId = 'test-plan-id';

  /**
   * Validates: Requirements 3.3, 3.4
   * For N valid rows (non-empty symbol, valid date), parser produces exactly N transactions.
   */
  it('produces exactly N transactions for N valid rows', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 1, maxLength: 50 }),
        async (rows) => {
          const csv = buildCsv(rows);
          const result = await parser.parse(csv, portfolioId, planId);

          expect(result.transactions.length).toBe(rows.length);
          expect(result.errors.length).toBe(0);
          expect(result.skipped).toBe(0);
          expect(result.total).toBe(rows.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.3, 3.4
   * Each transaction's symbol matches the input row's Stock Symbol (uppercased).
   */
  it('each transaction symbol matches the input row Stock Symbol uppercased', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 1, maxLength: 50 }),
        async (rows) => {
          const csv = buildCsv(rows);
          const result = await parser.parse(csv, portfolioId, planId);

          for (let i = 0; i < rows.length; i++) {
            expect(result.transactions[i].symbol).toBe(rows[i].symbol.toUpperCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.3, 3.4
   * Each transaction's transactionDate matches the input row's Open Date.
   */
  it('each transaction transactionDate matches the input row Open Date', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 1, maxLength: 50 }),
        async (rows) => {
          const csv = buildCsv(rows);
          const result = await parser.parse(csv, portfolioId, planId);

          for (let i = 0; i < rows.length; i++) {
            const txn = result.transactions[i];
            // Parse the expected date from the row's date string (MM/DD/YYYY)
            const parts = rows[i].date.split('/');
            const expectedMonth = parseInt(parts[0], 10);
            const expectedDay = parseInt(parts[1], 10);
            const expectedYear = parseInt(parts[2], 10);

            expect(txn.transactionDate.getFullYear()).toBe(expectedYear);
            expect(txn.transactionDate.getMonth() + 1).toBe(expectedMonth);
            expect(txn.transactionDate.getDate()).toBe(expectedDay);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.3, 3.4
   * Parser handles CSV with additional optional columns correctly,
   * still producing N transactions with correct symbol and date mapping.
   */
  it('handles CSV with additional optional columns and still maps correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 1, maxLength: 30 }),
        fc.constantFrom('Call', 'Put', ''),
        fc.constantFrom('Buy', 'Sell', ''),
        async (rows, optionType, direction) => {
          // Build CSV with extra columns
          const header = 'Stock Symbol,Open Date,Option Type,Direction,Strike Price,Premium';
          const dataLines = rows.map((row) =>
            `${row.symbol},${row.date},${optionType},${direction},100.00,2.50`,
          );
          const csv = [header, ...dataLines].join('\n');

          const result = await parser.parse(csv, portfolioId, planId);

          expect(result.transactions.length).toBe(rows.length);
          for (let i = 0; i < rows.length; i++) {
            expect(result.transactions[i].symbol).toBe(rows[i].symbol.toUpperCase());
            const parts = rows[i].date.split('/');
            const expectedMonth = parseInt(parts[0], 10);
            const expectedDay = parseInt(parts[1], 10);
            const expectedYear = parseInt(parts[2], 10);
            expect(result.transactions[i].transactionDate.getFullYear()).toBe(expectedYear);
            expect(result.transactions[i].transactionDate.getMonth() + 1).toBe(expectedMonth);
            expect(result.transactions[i].transactionDate.getDate()).toBe(expectedDay);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 6: CSV parser skips invalid rows with error reporting ---
// Feature: portfolio-management, Property 6: CSV parser skips invalid rows with error reporting

describe('Property 6: CSV parser skips invalid rows with error reporting', () => {
  const parser = new CsvParser();
  const portfolioId = 'test-portfolio-id';
  const planId = 'test-plan-id';

  /**
   * Validates: Requirements 3.7
   * Rows with empty Stock Symbol are excluded from transactions and included in errors.
   */
  it('rows with empty Stock Symbol are excluded from transactions and included in errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 0, maxLength: 5 }),
        fc.array(arbInvalidSymbolRow, { minLength: 1, maxLength: 5 }),
        async (validRows, invalidSymbolRows) => {
          const allRows: CsvRow[] = [...validRows, ...invalidSymbolRows];
          const csv = buildCsv(allRows);

          const result = await parser.parse(csv, portfolioId, planId);

          // Invalid symbol rows should NOT appear in transactions
          expect(result.transactions.length).toBe(validRows.length);

          // Invalid symbol rows should appear in errors
          const symbolErrors = result.errors.filter((e) =>
            e.reason.toLowerCase().includes('symbol'),
          );
          expect(symbolErrors.length).toBe(invalidSymbolRows.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.7
   * Rows with unparseable Open Date are excluded from transactions and included in errors.
   */
  it('rows with unparseable Open Date are excluded from transactions and included in errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbValidRow, { minLength: 0, maxLength: 5 }),
        fc.array(arbInvalidDateRow, { minLength: 1, maxLength: 5 }),
        async (validRows, invalidDateRows) => {
          const allRows: CsvRow[] = [...validRows, ...invalidDateRows];
          const csv = buildCsv(allRows);

          const result = await parser.parse(csv, portfolioId, planId);

          // Invalid date rows should NOT appear in transactions
          expect(result.transactions.length).toBe(validRows.length);

          // Invalid date rows should appear in errors
          const dateErrors = result.errors.filter((e) =>
            e.reason.toLowerCase().includes('date'),
          );
          expect(dateErrors.length).toBe(invalidDateRows.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.7
   * The error entry contains the correct row number (header is row 1, first data row is row 2).
   */
  it('error entries contain correct row numbers (header=row 1, data starts at row 2)', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedRows, async (rows) => {
        const csv = buildCsv(rows);
        const result = await parser.parse(csv, portfolioId, planId);

        // Determine expected row numbers for invalid rows
        const expectedErrorRowNumbers: number[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].kind !== 'valid') {
            expectedErrorRowNumbers.push(i + 2); // +2: header is row 1, data starts at row 2
          }
        }

        const actualErrorRowNumbers = result.errors.map((e) => e.row).sort((a, b) => a - b);
        expect(actualErrorRowNumbers).toEqual(expectedErrorRowNumbers.sort((a, b) => a - b));
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.7
   * The skipped count equals the number of invalid rows.
   */
  it('skipped count equals the number of invalid rows', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedRows, async (rows) => {
        const csv = buildCsv(rows);
        const result = await parser.parse(csv, portfolioId, planId);

        const invalidCount = rows.filter((r) => r.kind !== 'valid').length;
        expect(result.skipped).toBe(invalidCount);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.7
   * transactions.length equals the count of valid rows and errors.length equals the count of invalid rows.
   */
  it('transactions.length equals valid row count and errors.length equals invalid row count', async () => {
    await fc.assert(
      fc.asyncProperty(arbMixedRows, async (rows) => {
        const csv = buildCsv(rows);
        const result = await parser.parse(csv, portfolioId, planId);

        const validCount = rows.filter((r) => r.kind === 'valid').length;
        const invalidCount = rows.filter((r) => r.kind !== 'valid').length;

        expect(result.transactions.length).toBe(validCount);
        expect(result.errors.length).toBe(invalidCount);
      }),
      { numRuns: 100 },
    );
  });
});
