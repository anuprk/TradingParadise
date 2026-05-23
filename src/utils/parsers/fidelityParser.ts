/**
 * Fidelity PDF Parser implementing the StatementParser strategy interface.
 * Parses Fidelity brokerage account PDF statements into PortfolioTransaction records.
 *
 * Locates the "Transaction Detail" section and extracts transaction rows with:
 * - Date (MM/DD/YYYY)
 * - Action: "YOU BOUGHT", "YOU SOLD", "REINVESTMENT", "DIVIDEND"
 * - Symbol, description, quantity, price, amount, fees
 *
 * Maps actions to transaction types and extracts option details from descriptions.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  StatementParser,
  ParseResult,
  ParseError,
  PortfolioTransaction,
  TransactionType,
  AssetType,
} from '../../types/transaction';
import type { OptionType } from '../../types/journal';
import { extractTextFromPDF } from './pdfUtils';

// --- Action to TransactionType mapping ---

const ACTION_MAP: Record<string, TransactionType> = {
  'YOU BOUGHT': 'Buy',
  'YOU SOLD': 'Sell',
  'REINVESTMENT': 'Dividend',
  'DIVIDEND': 'Dividend',
};

const SUPPORTED_ACTIONS = Object.keys(ACTION_MAP);

// --- Date parsing ---

function parseFidelityDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const trimmed = value.trim();

  // Fidelity uses MM/DD/YYYY format
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      return new Date(year, month - 1, day);
    }
  }

  return undefined;
}

// --- Number parsing ---

function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove $, commas, whitespace
  let cleaned = value.replace(/[$,\s]/g, '');
  // Handle negative in parentheses
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }
  // Handle explicit negative sign
  const hasNegSign = cleaned.startsWith('-');
  if (hasNegSign) {
    cleaned = cleaned.slice(1);
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return (isNegative || hasNegSign) ? -num : num;
}

// --- Option details extraction ---

interface OptionDetails {
  optionType: OptionType;
  strikePrice: number;
  expirationDate?: Date;
  underlyingSymbol?: string;
}

/**
 * Extracts option details from a Fidelity transaction description.
 * Fidelity option descriptions typically contain patterns like:
 * - "CALL" or "PUT" keywords
 * - Strike price (numeric value near CALL/PUT)
 * - Expiration date
 * Example: "AAPL JAN 19 2024 190 CALL"
 */
function extractOptionDetails(description: string): OptionDetails | undefined {
  if (!description) return undefined;
  const upper = description.toUpperCase();

  // Check for CALL or PUT keywords
  const isCall = upper.includes('CALL');
  const isPut = upper.includes('PUT');

  if (!isCall && !isPut) return undefined;

  const optionType: OptionType = isCall ? 'Call' : 'Put';

  // Try to extract strike price - look for a number near CALL/PUT
  // Pattern: numbers that could be strike prices (e.g., 190, 170.50)
  const strikeMatch = upper.match(/(\d+(?:\.\d+)?)\s*(?:CALL|PUT)/);
  let strikePrice = 0;
  if (strikeMatch) {
    strikePrice = parseFloat(strikeMatch[1]);
  } else {
    // Try alternative pattern: CALL/PUT followed by number
    const altMatch = upper.match(/(?:CALL|PUT)\s*(\d+(?:\.\d+)?)/);
    if (altMatch) {
      strikePrice = parseFloat(altMatch[1]);
    }
  }

  // Try to extract expiration date from description
  // Common patterns: "JAN 19 2024", "01/19/2024", "JAN 19 24"
  let expirationDate: Date | undefined;
  const dateMatch = description.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    const year = parseInt(dateMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      expirationDate = new Date(year, month - 1, day);
    }
  } else {
    // Try month name pattern: "JAN 19 2024" or "JAN 19 24"
    const monthNames: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    const monthMatch = upper.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})\s+(\d{2,4})/);
    if (monthMatch) {
      const month = monthNames[monthMatch[1]];
      const day = parseInt(monthMatch[2], 10);
      let year = parseInt(monthMatch[3], 10);
      if (year < 100) year += 2000;
      if (month !== undefined && day >= 1 && day <= 31) {
        expirationDate = new Date(year, month, day);
      }
    }
  }

  return { optionType, strikePrice, expirationDate };
}

// --- Transaction row parsing ---

/**
 * Regex to match a date at the start of a line (MM/DD/YYYY).
 */
const DATE_PATTERN = /\d{2}\/\d{2}\/\d{4}/;

/**
 * Attempts to find the action keyword in a text segment.
 */
function findAction(text: string): string | undefined {
  const upper = text.toUpperCase();
  for (const action of SUPPORTED_ACTIONS) {
    if (upper.includes(action)) {
      return action;
    }
  }
  return undefined;
}

/**
 * Parses a single transaction segment from the Fidelity PDF text.
 * A segment is the text between two date markers.
 */
function parseTransactionSegment(
  segment: string,
  rowIndex: number,
  portfolioId: string,
  planId: string,
): { transaction?: PortfolioTransaction; error?: ParseError } {
  const trimmed = segment.trim();
  if (!trimmed) {
    return {};
  }

  // Extract date
  const dateMatch = trimmed.match(DATE_PATTERN);
  if (!dateMatch) {
    return {
      error: {
        row: rowIndex,
        content: trimmed.substring(0, 200),
        reason: 'Missing date field',
        missingFields: ['date'],
      },
    };
  }

  const transactionDate = parseFidelityDate(dateMatch[0]);
  if (!transactionDate) {
    return {
      error: {
        row: rowIndex,
        content: trimmed.substring(0, 200),
        reason: `Invalid date format: "${dateMatch[0]}"`,
        missingFields: ['date'],
      },
    };
  }

  // Find action
  const action = findAction(trimmed);
  if (!action) {
    // Check if it's an unsupported transaction type
    // If there's a date but no recognized action, it's unsupported
    return {
      error: {
        row: rowIndex,
        content: trimmed.substring(0, 200),
        reason: 'unsupported transaction type',
      },
    };
  }

  const transactionType = ACTION_MAP[action];

  // Extract symbol - typically appears after the action
  // Pattern: action followed by symbol (uppercase letters, 1-5 chars)
  const actionIndex = trimmed.toUpperCase().indexOf(action);
  const afterAction = trimmed.substring(actionIndex + action.length).trim();

  // Symbol is usually the first word after the action (uppercase ticker)
  const symbolMatch = afterAction.match(/^([A-Z]{1,5})\b/);
  const symbol = symbolMatch ? symbolMatch[1] : '';

  // Extract description - everything after the symbol until numbers start
  const description = afterAction.trim();

  // Extract numeric values from the segment
  // Look for patterns: quantity, price, amount, fees
  // Numbers in Fidelity statements: quantity (integer or decimal), price ($X.XX), amount ($X,XXX.XX)
  const numbers = trimmed.match(/[-]?\$?[\d,]+\.?\d*/g) || [];
  const numericValues = numbers
    .map((n) => parseAmount(n))
    .filter((n) => !isNaN(n));

  // For dividends and reinvestments, quantity may be 0
  let quantity = 0;
  let price = 0;
  let amount = 0;
  let fees = 0;

  if (transactionType === 'Dividend') {
    // Dividends: amount is the key value, quantity is 0
    quantity = 0;
    price = 0;
    // The amount is typically the last significant number
    if (numericValues.length > 0) {
      // Skip the date components (month, day, year numbers)
      const nonDateNumbers = numericValues.filter((n) => Math.abs(n) > 31 || n < 0 || n === 0);
      if (nonDateNumbers.length > 0) {
        amount = nonDateNumbers[nonDateNumbers.length - 1];
      } else if (numericValues.length > 3) {
        amount = numericValues[numericValues.length - 1];
      }
    }
  } else {
    // Buy/Sell: extract quantity, price, amount, fees
    // Typical order after date: quantity, price, amount, [fees]
    // Filter out date-like numbers (the date was already parsed)
    const dateStr = dateMatch[0];
    const dateParts = dateStr.split('/').map((p) => parseInt(p, 10));
    const nonDateNumbers = numericValues.filter(
      (n) => !dateParts.includes(n) || Math.abs(n) > 2100,
    );

    if (nonDateNumbers.length >= 3) {
      quantity = Math.abs(nonDateNumbers[0]);
      price = Math.abs(nonDateNumbers[1]);
      amount = nonDateNumbers[2];
      if (nonDateNumbers.length >= 4) {
        fees = Math.abs(nonDateNumbers[3]);
      }
    } else if (nonDateNumbers.length === 2) {
      quantity = Math.abs(nonDateNumbers[0]);
      price = Math.abs(nonDateNumbers[1]);
      amount = quantity * price;
    } else if (nonDateNumbers.length === 1) {
      amount = nonDateNumbers[0];
    }
  }

  // Check for missing required fields
  if (!action) {
    return {
      error: {
        row: rowIndex,
        content: trimmed.substring(0, 200),
        reason: 'Missing action field',
        missingFields: ['action'],
      },
    };
  }

  if (amount === 0 && transactionType !== 'Dividend') {
    // Amount is required for non-dividend transactions
    // But we still allow it through - some transactions may legitimately be $0
  }

  // Determine asset type and extract option details
  let assetType: AssetType = 'Stock';
  let optionType: OptionType | undefined;
  let strikePrice: number | undefined;
  let expirationDate: Date | undefined;

  const optionDetails = extractOptionDetails(description);
  if (optionDetails) {
    assetType = 'Option';
    optionType = optionDetails.optionType;
    strikePrice = optionDetails.strikePrice || undefined;
    expirationDate = optionDetails.expirationDate;
  }

  const now = new Date();

  const transaction: PortfolioTransaction = {
    id: uuidv4(),
    portfolioId,
    planId,
    transactionDate,
    symbol: symbol || 'UNKNOWN',
    description: description.substring(0, 500),
    transactionType,
    assetType,
    optionType,
    strikePrice,
    expirationDate,
    quantity,
    price,
    amount,
    fees,
    source: 'fidelity_pdf',
    rawDescription: trimmed.substring(0, 500),
    createdAt: now,
    updatedAt: now,
  };

  return { transaction };
}

// --- Fidelity Parser Class ---

export class FidelityParser implements StatementParser {
  /**
   * Fidelity PDFs are binary (ArrayBuffer).
   * Check if content is an ArrayBuffer.
   */
  canParse(content: ArrayBuffer | string): boolean {
    return content instanceof ArrayBuffer;
  }

  /**
   * Parse Fidelity PDF content into PortfolioTransaction records.
   * Extracts text from PDF, locates "Transaction Detail" section,
   * and parses transaction rows.
   */
  async parse(
    content: ArrayBuffer | string,
    portfolioId: string,
    planId: string,
  ): Promise<ParseResult> {
    if (!(content instanceof ArrayBuffer)) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            content: '',
            reason: 'Fidelity parser requires ArrayBuffer content (PDF binary data)',
          },
        ],
        skipped: 0,
        total: 0,
      };
    }

    // Extract text from PDF
    let pageTexts: string[];
    try {
      pageTexts = await extractTextFromPDF(content);
    } catch (error) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            content: '',
            reason: `Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        skipped: 0,
        total: 0,
      };
    }

    // Combine all page texts
    const fullText = pageTexts.join(' ');

    // Locate "Transaction Detail" section
    const sectionHeaderIndex = fullText.toUpperCase().indexOf('TRANSACTION DETAIL');
    if (sectionHeaderIndex === -1) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            content: '',
            reason: 'No "Transaction Detail" section found in PDF',
          },
        ],
        skipped: 0,
        total: 0,
      };
    }

    // Extract text from the Transaction Detail section onward
    const sectionText = fullText.substring(sectionHeaderIndex + 'TRANSACTION DETAIL'.length);

    // Split into transaction segments by date pattern (MM/DD/YYYY)
    // Each transaction starts with a date
    const segments: string[] = [];
    const dateRegex = /\d{2}\/\d{2}\/\d{4}/g;
    let match: RegExpExecArray | null;
    const datePositions: number[] = [];

    while ((match = dateRegex.exec(sectionText)) !== null) {
      datePositions.push(match.index);
    }

    // Create segments between consecutive date positions
    for (let i = 0; i < datePositions.length; i++) {
      const start = datePositions[i];
      const end = i + 1 < datePositions.length ? datePositions[i + 1] : sectionText.length;
      segments.push(sectionText.substring(start, end));
    }

    // Parse each segment
    const transactions: PortfolioTransaction[] = [];
    const errors: ParseError[] = [];
    let skipped = 0;

    for (let i = 0; i < segments.length; i++) {
      const result = parseTransactionSegment(segments[i], i + 1, portfolioId, planId);

      if (result.transaction) {
        transactions.push(result.transaction);
      } else if (result.error) {
        skipped++;
        errors.push(result.error);
      }
      // If neither transaction nor error, it's a blank/empty segment - skip silently
    }

    return {
      transactions,
      errors,
      skipped,
      total: segments.length,
    };
  }
}
