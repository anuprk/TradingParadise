/**
 * Parser registry and orchestrator for brokerage statement import.
 *
 * Exports `detectAndParse` which validates the file, detects its format,
 * and delegates to the appropriate parser (Tastytrade CSV/PDF, Fidelity CSV/PDF, or generic CSV).
 *
 * Also re-exports individual parsers and the format detector for direct use.
 */

import type { ParseResult } from '../../types/transaction';
import { TastytradeParser } from './tastytradeParser';
import { FidelityParser } from './fidelityParser';
import { CsvParser } from './csvParser';
import { TastytradeCsvParser } from './tastytradeCsvParser';
import { FidelityCsvParser } from './fidelityCsvParser';
import { detectFormat } from './formatDetector';

// --- Constants ---

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'csv'];

// --- Parser Registry ---

const tastytradeParser = new TastytradeParser();
const fidelityParser = new FidelityParser();
const csvParser = new CsvParser();
const tastytradeCsvParser = new TastytradeCsvParser();
const fidelityCsvParser = new FidelityCsvParser();

// --- Helpers ---

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// --- Main Orchestrator ---

/**
 * Validates the file, detects its format, and parses it into transactions.
 */
export async function detectAndParse(
  file: File,
  portfolioId: string,
  planId: string,
): Promise<ParseResult> {
  // 1. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      transactions: [],
      errors: [
        {
          row: 0,
          content: '',
          reason: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed size of 10 MB`,
        },
      ],
      skipped: 0,
      total: 0,
    };
  }

  // 2. Validate file extension
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      transactions: [],
      errors: [
        {
          row: 0,
          content: '',
          reason: `Unsupported file extension ".${extension}". Supported formats: .pdf, .csv`,
        },
      ],
      skipped: 0,
      total: 0,
    };
  }

  // 3. Detect format
  const format = await detectFormat(file);

  // 4. Handle unknown format
  if (format === 'unknown') {
    return {
      transactions: [],
      errors: [
        {
          row: 0,
          content: '',
          reason: 'Unable to determine file format. Supported formats: tastytrade (PDF/CSV), Fidelity (PDF/CSV), and generic CSV',
        },
      ],
      skipped: 0,
      total: 0,
    };
  }

  // 5. Read content and parse based on detected format
  switch (format) {
    case 'tastytrade_csv': {
      const text = await file.text();
      return tastytradeCsvParser.parse(text, portfolioId, planId);
    }
    case 'fidelity_csv': {
      const text = await file.text();
      return fidelityCsvParser.parse(text, portfolioId, planId);
    }
    case 'csv': {
      const text = await file.text();
      return csvParser.parse(text, portfolioId, planId);
    }
    case 'tastytrade_pdf': {
      const buffer = await file.arrayBuffer();
      return tastytradeParser.parse(buffer, portfolioId, planId);
    }
    case 'fidelity_pdf': {
      const buffer = await file.arrayBuffer();
      return fidelityParser.parse(buffer, portfolioId, planId);
    }
  }
}

// --- Re-exports for direct use ---

export { TastytradeParser } from './tastytradeParser';
export { FidelityParser } from './fidelityParser';
export { CsvParser } from './csvParser';
export { TastytradeCsvParser } from './tastytradeCsvParser';
export { FidelityCsvParser } from './fidelityCsvParser';
export { detectFormat } from './formatDetector';
