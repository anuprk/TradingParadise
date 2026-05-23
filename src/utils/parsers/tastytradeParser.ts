/**
 * Tastytrade PDF Parser implementing the StatementParser strategy interface.
 * Extracts transactions from tastytrade monthly PDF statements by locating
 * the "Account Activity" or "Transaction History" section and parsing
 * transaction rows line-by-line.
 *
 * Handles stock, ETF, and options transactions. For options, parses the
 * description format (e.g., "AAPL 03/15/24 P170") to extract symbol,
 * expiration, strike, and type.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
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

// --- Options description regex patterns ---

/**
 * Matches tastytrade options descriptions in formats:
 * - "AAPL 03/15/24 P170"
 * - "AAPL 03/15/24 C170"
 * - "AAPL 03/15/24 P 170"
 * - "AAPL 03/15/24 C 170.50"
 * - "SPY 01/19/24 P450"
 * - "AAPL 03/15/2024 P170"
 */
const OPTIONS_PATTERN =
  /^([A-Z]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([CP])\s*(\d+(?:\.\d+)?)$/i;

/**
 * Alternative pattern where option type is attached to strike:
 * - "AAPL 03/15/24 P170" (P attached to strike)
 * - "SPY 01/19/24 C450.50"
 */
const OPTIONS_PATTERN_ALT =
  /^([A-Z]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([CP])(\d+(?:\.\d+)?)$/i;

// --- Date parsing ---

function parseTastytradeDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const trimmed = value.trim();

  // Try MM/DD/YY and MM/DD/YYYY formats
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (
      !isNaN(month) &&
      !isNaN(day) &&
      !isNaN(year) &&
      month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      return new Date(year, month - 1, day);
    }
  }

  // Fallback to Date.parse
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? undefined : d;
}

// --- Number parsing ---

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove $, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  // Handle parentheses for negative numbers
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const inner = cleaned.slice(1, -1);
    const num = parseFloat(inner);
    return isNaN(num) ? 0 : -num;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// --- Line classification helpers ---

const SUBTOTAL_PATTERNS = [
  /\btotal\b/i,
  /\bsubtotal\b/i,
  /\bnet\s+total\b/i,
  /\bbalance\b/i,
  /\bgrand\s+total\b/i,
];

const PAGE_HEADER_PATTERNS = [
  /^page\s+\d+/i,
  /^\d+\s+of\s+\d+$/i,
  /^tastytrade/i,
  /^account\s+statement/i,
  /^statement\s+period/i,
  /^account\s+number/i,
  /^account\s+#/i,
];

const SECTION_HEADER_PATTERNS = [
  /^account\s+activity$/i,
  /^transaction\s+history$/i,
];

function isSubtotalLine(line: string): boolean {
  return SUBTOTAL_PATTERNS.some((pattern) => pattern.test(line));
}

function isPageHeaderOrFooter(line: string): boolean {
  return PAGE_HEADER_PATTERNS.some((pattern) => pattern.test(line));
}

function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

function isSectionHeader(line: string): boolean {
  return SECTION_HEADER_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

function shouldSkipLine(line: string): boolean {
  return isBlankLine(line) || isSubtotalLine(line) || isPageHeaderOrFooter(line);
}

// --- Options description parsing ---

interface OptionsInfo {
  symbol: string;
  expirationDate: Date;
  strikePrice: number;
  optionType: OptionType;
}

/**
 * Searches for an options pattern anywhere within the description string.
 * Handles cases where the options description is embedded in a larger string
 * (e.g., "AAPL 03/15/24 P170 Sold" or "Buy AAPL 03/15/24 C450").
 */
const OPTIONS_SEARCH_PATTERN =
  /([A-Z]{1,6})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([CP])\s*(\d+(?:\.\d+)?)/i;

function parseOptionsDescription(description: string): OptionsInfo | null {
  const trimmed = description.trim();

  // Try exact match patterns first
  let match = trimmed.match(OPTIONS_PATTERN);
  if (!match) {
    match = trimmed.match(OPTIONS_PATTERN_ALT);
  }

  // If no exact match, search within the description
  if (!match) {
    match = trimmed.match(OPTIONS_SEARCH_PATTERN);
  }

  if (!match) return null;

  const symbol = match[1].toUpperCase();
  const dateStr = match[2];
  const typeChar = match[3].toUpperCase();
  const strike = parseFloat(match[4]);

  const expirationDate = parseTastytradeDate(dateStr);
  if (!expirationDate) return null;
  if (isNaN(strike)) return null;

  const optionType: OptionType = typeChar === 'C' ? 'Call' : 'Put';

  return { symbol, expirationDate, strikePrice: strike, optionType };
}

// --- Transaction row parsing ---

/**
 * Tastytrade transaction rows typically follow this pattern in extracted PDF text:
 * DATE DESCRIPTION QUANTITY PRICE FEES AMOUNT
 *
 * The exact format can vary, but we look for lines that start with a date pattern.
 */
const DATE_PATTERN = /^(\d{1,2}\/\d{1,2}\/\d{2,4})/;

interface ParsedRow {
  date: string;
  description: string;
  quantity: number;
  price: number;
  fees: number;
  amount: number;
  settlementDate?: string;
}

function parseTransactionRow(line: string): ParsedRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const dateMatch = trimmed.match(DATE_PATTERN);
  if (!dateMatch) return null;

  const date = dateMatch[1];
  const rest = trimmed.slice(dateMatch[0].length).trim();

  if (!rest) return null;

  // Split the remaining content into tokens
  // The last few tokens are typically numeric values (quantity, price, fees, amount)
  const tokens = rest.split(/\s+/);

  if (tokens.length < 2) return null;

  // Try to identify numeric tokens from the end
  const numericFromEnd: number[] = [];
  let descTokens = [...tokens];

  // Walk backwards collecting numeric values
  while (descTokens.length > 0) {
    const last = descTokens[descTokens.length - 1];
    const num = parseNumber(last);
    // Check if it looks like a number (contains digits, possibly with $, commas, parens, minus)
    if (/^[($\-\d,.\s)]+$/.test(last) && last.replace(/[$,\s()]/g, '').length > 0) {
      numericFromEnd.unshift(num);
      descTokens.pop();
    } else {
      break;
    }
  }

  // We expect at least 2 numeric values (price/amount at minimum)
  if (numericFromEnd.length < 2) return null;

  const description = descTokens.join(' ');

  // Map numeric values based on count:
  // 4 values: quantity, price, fees, amount
  // 3 values: quantity, price, amount (fees = 0)
  // 2 values: price, amount (quantity = 1, fees = 0)
  let quantity: number;
  let price: number;
  let fees: number;
  let amount: number;

  if (numericFromEnd.length >= 4) {
    quantity = Math.abs(numericFromEnd[numericFromEnd.length - 4]);
    price = numericFromEnd[numericFromEnd.length - 3];
    fees = Math.abs(numericFromEnd[numericFromEnd.length - 2]);
    amount = numericFromEnd[numericFromEnd.length - 1];
  } else if (numericFromEnd.length === 3) {
    quantity = Math.abs(numericFromEnd[0]);
    price = numericFromEnd[1];
    amount = numericFromEnd[2];
    fees = 0;
  } else {
    quantity = 1;
    price = numericFromEnd[0];
    amount = numericFromEnd[1];
    fees = 0;
  }

  return { date, description, quantity, price: Math.abs(price), fees, amount };
}

// --- Transaction type determination ---

function determineTransactionType(description: string, amount: number): TransactionType {
  const lower = description.toLowerCase();
  if (lower.includes('dividend') || lower.includes('div')) return 'Dividend';
  if (lower.includes('fee') || lower.includes('commission')) return 'Fee';
  if (lower.includes('transfer') || lower.includes('deposit') || lower.includes('withdrawal'))
    return 'Transfer';
  if (lower.includes('expir')) return 'Expiration';
  if (lower.includes('assign')) return 'Assignment';
  if (lower.includes('sell') || lower.includes('sold') || lower.includes('stc') || lower.includes('btc')) {
    // STC = Sell to Close, BTC = Buy to Close
    if (lower.includes('btc') || lower.includes('buy to close')) return 'Buy';
    return 'Sell';
  }
  if (lower.includes('buy') || lower.includes('bought') || lower.includes('sto') || lower.includes('bto')) {
    // STO = Sell to Open, BTO = Buy to Open
    if (lower.includes('sto') || lower.includes('sell to open')) return 'Sell';
    return 'Buy';
  }
  // Infer from amount sign: positive = sell/credit, negative = buy/debit
  return amount >= 0 ? 'Sell' : 'Buy';
}

function determineAssetType(optionsInfo: OptionsInfo | null, description: string): AssetType {
  if (optionsInfo) return 'Option';
  const lower = description.toLowerCase();
  if (lower.includes('etf')) return 'ETF';
  if (lower.includes('dividend') || lower.includes('fee') || lower.includes('transfer'))
    return 'Cash';
  return 'Stock';
}

// --- Section locator ---

function findTransactionSection(pageTexts: string[]): { lines: string[]; found: boolean } {
  const allText = pageTexts.join('\n');
  const lines = allText.split(/\n/);

  // Look for section headers
  let sectionStartIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isSectionHeader(lines[i])) {
      sectionStartIndex = i + 1;
      break;
    }
  }

  // Also try searching within each line for the section header keywords
  if (sectionStartIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (lower.includes('account activity') || lower.includes('transaction history')) {
        sectionStartIndex = i + 1;
        break;
      }
    }
  }

  if (sectionStartIndex === -1) {
    return { lines: [], found: false };
  }

  // Collect lines from section start until end or next major section
  const sectionLines: string[] = [];
  for (let i = sectionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    // Stop at next major section (but not our own section headers)
    if (
      !isSectionHeader(line) &&
      /^(account\s+summary|positions|cash\s+balance|margin\s+summary)/i.test(line.trim())
    ) {
      break;
    }
    sectionLines.push(line);
  }

  return { lines: sectionLines, found: true };
}

// --- Tastytrade Parser Class ---

export class TastytradeParser implements StatementParser {
  /**
   * Tastytrade PDFs are binary (ArrayBuffer).
   * Check if content is an ArrayBuffer to determine if this parser can handle it.
   */
  canParse(content: ArrayBuffer | string): boolean {
    return content instanceof ArrayBuffer;
  }

  /**
   * Parse a tastytrade PDF statement into PortfolioTransaction records.
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
            reason: 'Tastytrade parser requires ArrayBuffer content (PDF binary data)',
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

    // Locate the transaction section
    const { lines, found } = findTransactionSection(pageTexts);

    if (!found) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            content: '',
            reason:
              'No valid transaction section found. Expected "Account Activity" or "Transaction History" section header.',
          },
        ],
        skipped: 0,
        total: 0,
      };
    }

    // Parse transaction rows
    const transactions: PortfolioTransaction[] = [];
    const errors: ParseError[] = [];
    let skipped = 0;
    let totalRows = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip non-transaction lines without adding to errors
      if (shouldSkipLine(line)) {
        skipped++;
        continue;
      }

      // Skip section headers within the section
      if (isSectionHeader(line)) {
        skipped++;
        continue;
      }

      totalRows++;

      // Try to parse as a transaction row
      const parsed = parseTransactionRow(line);
      if (!parsed) {
        // Line doesn't match transaction format - could be a continuation or unrecognized
        // Only add to errors if it looks like it should be a transaction (has some content)
        if (line.trim().length > 3) {
          errors.push({
            row: i + 1,
            content: line.trim(),
            reason: 'Unrecognized transaction row format',
          });
        } else {
          skipped++;
        }
        continue;
      }

      // Parse the date
      const transactionDate = parseTastytradeDate(parsed.date);
      if (!transactionDate) {
        errors.push({
          row: i + 1,
          content: line.trim(),
          reason: `Invalid date: "${parsed.date}"`,
          missingFields: ['date'],
        });
        continue;
      }

      // Try to parse options description
      const optionsInfo = parseOptionsDescription(parsed.description);

      // Determine transaction type and asset type
      const transactionType = determineTransactionType(parsed.description, parsed.amount);
      const assetType = determineAssetType(optionsInfo, parsed.description);

      // Build the symbol
      const symbol = optionsInfo
        ? optionsInfo.symbol
        : parsed.description.split(/\s+/)[0]?.toUpperCase() || '';

      if (!symbol) {
        errors.push({
          row: i + 1,
          content: line.trim(),
          reason: 'Unable to extract symbol from transaction',
          missingFields: ['symbol'],
        });
        continue;
      }

      const now = new Date();

      const transaction: PortfolioTransaction = {
        id: uuidv4(),
        portfolioId,
        planId,
        transactionDate,
        settlementDate: undefined,
        symbol,
        description: parsed.description,
        transactionType,
        assetType,
        optionType: optionsInfo?.optionType,
        strikePrice: optionsInfo?.strikePrice,
        expirationDate: optionsInfo?.expirationDate,
        quantity: parsed.quantity || 1,
        price: parsed.price,
        amount: parsed.amount,
        fees: parsed.fees,
        source: 'tastytrade_pdf',
        rawDescription: line.trim(),
        createdAt: now,
        updatedAt: now,
      };

      transactions.push(transaction);
    }

    return {
      transactions,
      errors,
      skipped,
      total: totalRows,
    };
  }
}
