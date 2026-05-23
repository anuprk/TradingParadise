/**
 * Property-based tests for format detection utility.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Feature: portfolio-management, Property 13: Format detection correctness
 *
 * Validates: Requirements 2.2
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

// Mock pdfUtils to return controlled text content
vi.mock('../../utils/parsers/pdfUtils', () => ({
  extractTextFromPDF: vi.fn(),
}));

import { detectFormat } from '../../utils/parsers/formatDetector';
import { extractTextFromPDF } from '../../utils/parsers/pdfUtils';

const mockedExtractTextFromPDF = vi.mocked(extractTextFromPDF);

// --- Helpers ---

/**
 * Creates a File object with the given name and content.
 */
function createFile(name: string, content: string = ''): File {
  return new File([content], name, {
    type: name.endsWith('.pdf') ? 'application/pdf' : 'text/csv',
  });
}

// --- Generators ---

/** Arbitrary text that does NOT contain any broker-specific markers */
const arbNeutralText: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 200 }).filter(
  (s) => {
    const lower = s.toLowerCase();
    return (
      !lower.includes('tastytrade') &&
      !s.includes('Account Activity') &&
      !s.includes('Transaction History') &&
      !lower.includes('fidelity') &&
      !s.includes('Transaction Detail')
    );
  },
);

/** Arbitrary tastytrade markers */
const arbTastytradeMarker: fc.Arbitrary<string> = fc.constantFrom(
  'tastytrade',
  'Tastytrade',
  'TASTYTRADE',
  'Account Activity',
  'Transaction History',
);

/** Arbitrary Fidelity markers */
const arbFidelityMarker: fc.Arbitrary<string> = fc.constantFrom(
  'Fidelity',
  'fidelity',
  'FIDELITY',
  'Transaction Detail',
);

/** Generate text with a tastytrade marker embedded in random surrounding text */
const arbTastytradeContent: fc.Arbitrary<string> = fc.tuple(
  arbNeutralText,
  arbTastytradeMarker,
  arbNeutralText,
).map(([prefix, marker, suffix]) => `${prefix} ${marker} ${suffix}`);

/** Generate text with a Fidelity marker embedded in random surrounding text */
const arbFidelityContent: fc.Arbitrary<string> = fc.tuple(
  arbNeutralText,
  arbFidelityMarker,
  arbNeutralText,
).map(([prefix, marker, suffix]) => `${prefix} ${marker} ${suffix}`);

/** Arbitrary CSV file name */
const arbCsvFileName: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
  .map((name) => `${name}.csv`);

/** Arbitrary PDF file name */
const arbPdfFileName: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-zA-Z0-9_-]{1,20}$/)
  .map((name) => `${name}.pdf`);

/** Arbitrary content for CSV files (any text) */
const arbCsvContent: fc.Arbitrary<string> = fc.string({ minLength: 0, maxLength: 500 });

// --- Property 13: Format detection correctness ---

describe('Property 13: Format detection correctness', () => {
  /**
   * Validates: Requirements 2.2
   * For any PDF content containing tastytrade-specific markers
   * ("tastytrade", "Account Activity", or "Transaction History" in expected positions),
   * the format detector SHALL identify it as tastytrade format.
   */
  it('any PDF with tastytrade markers is detected as tastytrade_pdf', async () => {
    await fc.assert(
      fc.asyncProperty(arbPdfFileName, arbTastytradeContent, async (fileName, textContent) => {
        const file = createFile(fileName);

        // Mock extractTextFromPDF to return the generated text as the first page
        mockedExtractTextFromPDF.mockResolvedValue([textContent]);

        const result = await detectFormat(file);
        expect(result).toBe('tastytrade_pdf');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 2.2
   * For any PDF content containing Fidelity-specific markers
   * ("Fidelity", "Transaction Detail"), the format detector SHALL identify it as Fidelity format.
   */
  it('any PDF with Fidelity markers is detected as fidelity_pdf', async () => {
    await fc.assert(
      fc.asyncProperty(arbPdfFileName, arbFidelityContent, async (fileName, textContent) => {
        // Ensure the content does NOT also contain tastytrade markers
        // (tastytrade is checked first, so if both are present, tastytrade wins)
        const lower = textContent.toLowerCase();
        fc.pre(
          !lower.includes('tastytrade') &&
          !textContent.includes('Account Activity') &&
          !textContent.includes('Transaction History'),
        );

        const file = createFile(fileName);

        mockedExtractTextFromPDF.mockResolvedValue([textContent]);

        const result = await detectFormat(file);
        expect(result).toBe('fidelity_pdf');
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 2.2
   * CSV files always return 'csv' regardless of content.
   */
  it('CSV files always return csv regardless of content', async () => {
    await fc.assert(
      fc.asyncProperty(arbCsvFileName, arbCsvContent, async (fileName, _content) => {
        const file = createFile(fileName);

        const result = await detectFormat(file);
        expect(result).toBe('csv');
      }),
      { numRuns: 100 },
    );
  });
});
