/**
 * Fidelity CSV Parser implementing the StatementParser strategy interface.
 * Parses CSV exports from Fidelity's account history download.
 *
 * Expected columns: Run Date, Action, Symbol, Description, Type,
 * Exchange Quantity, Exchange Currency, Currency, Price, Quantity,
 * Exchange Rate, Commission, Fees, Accrued Interest, Amount, Cash Balance,
 * Settlement Date
 *
 * Key parsing logic:
 * - Run Date = Open Date
 * - Action contains "OPENING TRANSACTION" (new trade) or "CLOSING TRANSACTION" (closing existing)
 * - Description has option details: PUT/CALL, (SYMBOL), expiration (e.g. JUN 18 26), $STRIKE, (100 SHS)
 * - Symbol field (e.g. -PLTR260618P120) encodes: underlying, expiration YYMMDD, P/C, strike
 * - Negative quantity = Sell, Positive quantity = Buy
 * - If Type is "Margin", marginUsed = strike × |quantity| × 100 × 0.30
 */

import Papa from 'papaparse';
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

interface RawRow {
  [key: string]: string;
}

// --- Header detection ---

const FIDELITY_CSV_REQUIRED_HEADERS = ['Run Date', 'Action', 'Symbol', 'Amount'];

/**
 * Checks if a CSV's headers match the Fidelity account history format.
 */
export function isFidelityCsvFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim());
  return FIDELITY_CSV_REQUIRED_HEADERS.every((req) =>
    normalized.some((h) => h === req),
  );
}

// --- Value parsers ---

function parseDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const trimmed = value.trim();

  // Fidelity uses MM/DD/YYYY or M/D/YY format
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(month) && !isNaN(day) && !isNaN(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  return undefined;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove $, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// --- Month name mapping for expiration parsing ---
const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

/**
 * Parse expiration date from description like "JUN 18 26" or "JUN 18 2026"
 */
function parseExpirationFromDescription(description: string): Date | undefined {
  // Match patterns like "JUN 18 26" or "JUN 18 2026" or "JUL 17 26"
  const match = description.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})\s+(\d{2,4})\b/i);
  if (!match) return undefined;

  const monthStr = match[1].toUpperCase();
  const day = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;

  const month = MONTH_MAP[monthStr];
  if (month === undefined || isNaN(day) || isNaN(year)) return undefined;

  return new Date(year, month, day);
}

/**
 * Extract option details from Fidelity's symbol format.
 * Fidelity option symbols look like: -PLTR260618P120
 * Format: -UNDERLYING YYMMDD C/P STRIKE
 */
function parseOptionSymbol(symbol: string): {
  underlying: string;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: Date;
} | null {
  // Remove leading dash
  const clean = symbol.replace(/^-/, '');
  // Pattern: SYMBOL YYMMDD P/C STRIKE (e.g., PLTR260618P120 or SPY260731P658)
  const match = clean.match(/^([A-Z]+)(\d{6})([CP])(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const underlying = match[1];
  const dateStr = match[2]; // YYMMDD
  const typeChar = match[3];
  const strike = parseFloat(match[4]);

  const year = 2000 + parseInt(dateStr.substring(0, 2), 10);
  const month = parseInt(dateStr.substring(2, 4), 10);
  const day = parseInt(dateStr.substring(4, 6), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(strike)) return null;

  return {
    underlying,
    optionType: typeChar === 'C' ? 'Call' : 'Put',
    strikePrice: strike,
    expirationDate: new Date(year, month - 1, day),
  };
}

/**
 * Extract option type (PUT/CALL) from the Action or Description field.
 */
function extractOptionTypeFromText(text: string): OptionType | undefined {
  const upper = text.toUpperCase();
  // Check for PUT or CALL at word boundary in description
  if (/\bPUT\b/.test(upper)) return 'Put';
  if (/\bCALL\b/.test(upper)) return 'Call';
  return undefined;
}

/**
 * Extract the underlying symbol from description like "PUT (PLTR) PALANTIR..."
 */
function extractSymbolFromDescription(description: string): string | undefined {
  // Match pattern: (SYMBOL) where SYMBOL is 1-5 uppercase letters
  const match = description.match(/\(([A-Z]{1,5})\)/);
  return match ? match[1] : undefined;
}

/**
 * Determine transaction type from Fidelity's Action field.
 * Key logic:
 * - "OPENING TRANSACTION" = new position
 * - "CLOSING TRANSACTION" = closing existing position
 * - "YOU SOLD" + negative quantity = Sell
 * - "YOU BOUGHT" + positive quantity = Buy
 * - "ASSIGNED" = Assignment
 */
function mapAction(action: string, _quantity: number): { transactionType: TransactionType; isOpening: boolean; skip: boolean } {
  const upper = action.toUpperCase();

  // Skip money market and core account transactions
  if (upper.includes('PURCHASE INTO CORE') || upper.includes('REDEMPTION FROM CORE')) {
    return { transactionType: 'Transfer', isOpening: false, skip: true };
  }

  // Skip transfers, debits, wires, journaled entries, margin interest, mark-to-market
  if (
    upper.includes('TRANSFERRED') ||
    upper.includes('DIRECT DEBIT') ||
    upper.includes('WIRE TRANSFER') ||
    upper.includes('JOURNALED') ||
    upper.includes('MARGIN INTEREST') ||
    upper.includes('MARK TO MARKET') ||
    upper.includes('ELECTRONIC FUNDS TRANSFER') ||
    upper.includes('CHECK PAID') ||
    upper.includes('REINVESTMENT')
  ) {
    return { transactionType: 'Transfer', isOpening: false, skip: true };
  }

  const isOpening = upper.includes('OPENING TRANSACTION');

  if (upper.includes('YOU SOLD') || upper.includes('SOLD')) {
    return { transactionType: 'Sell', isOpening, skip: false };
  }
  if (upper.includes('YOU BOUGHT') || upper.includes('BOUGHT')) {
    return { transactionType: 'Buy', isOpening, skip: false };
  }
  if (upper.includes('ASSIGNED')) {
    return { transactionType: 'Assignment', isOpening: false, skip: false };
  }
  if (upper.includes('DIVIDEND') || upper.includes('DISTRIBUTION')) {
    return { transactionType: 'Dividend', isOpening: false, skip: false };
  }

  return { transactionType: 'Transfer', isOpening: false, skip: true };
}

// --- Fidelity CSV Parser Class ---

export class FidelityCsvParser implements StatementParser {
  canParse(content: ArrayBuffer | string): boolean {
    if (typeof content !== 'string') return false;
    // Remove BOM and find first non-empty line for Fidelity headers
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n');
    let firstLine = '';
    for (const line of lines) {
      if (line.trim()) {
        firstLine = line;
        break;
      }
    }
    const headers = firstLine.split(',').map((h) => h.trim().replace(/"/g, ''));
    return isFidelityCsvFormat(headers);
  }

  async parse(
    content: ArrayBuffer | string,
    portfolioId: string,
    planId: string,
  ): Promise<ParseResult> {
    if (typeof content !== 'string') {
      return {
        transactions: [],
        errors: [{ row: 0, content: '', reason: 'Fidelity CSV parser requires string content' }],
        skipped: 0,
        total: 0,
      };
    }

    // Remove BOM if present and skip leading blank lines
    const cleanContent = content.replace(/^\uFEFF/, '').replace(/^\s*\n/, '');

    const result = Papa.parse<RawRow>(cleanContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    const transactions: PortfolioTransaction[] = [];
    const errors: ParseError[] = [];
    let skipped = 0;

    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i];
      const rowNumber = i + 2;

      const action = (row['Action'] || '').trim();
      const rawSymbol = (row['Symbol'] || '').trim();
      const runDateStr = (row['Run Date'] || '').trim();
      const description = (row['Description'] || '').trim();
      const accountType = (row['Type'] || '').trim();

      // Skip empty rows or disclaimer rows at the bottom
      if (!action || !runDateStr) {
        skipped++;
        continue;
      }

      // Parse quantity first (needed for action mapping)
      const quantity = parseNumber(row['Quantity'] || '');

      // Determine transaction type and whether to skip
      const { transactionType, skip } = mapAction(action, quantity);
      if (skip) {
        skipped++;
        continue;
      }

      // Parse date (Run Date = Open Date)
      const transactionDate = parseDate(runDateStr);
      if (!transactionDate) {
        skipped++;
        errors.push({ row: rowNumber, content: runDateStr, reason: `Unparseable date: "${runDateStr}"` });
        continue;
      }

      // Parse symbol and option details
      let symbol = '';
      let optionType: OptionType | undefined;
      let strikePrice: number | undefined;
      let expirationDate: Date | undefined;
      let assetType: AssetType = 'Stock';

      // First try to parse the structured option symbol (e.g., -PLTR260618P120)
      const optionDetails = parseOptionSymbol(rawSymbol);
      if (optionDetails) {
        symbol = optionDetails.underlying;
        optionType = optionDetails.optionType;
        strikePrice = optionDetails.strikePrice;
        expirationDate = optionDetails.expirationDate;
        assetType = 'Option';
      } else {
        // For stock trades or if symbol parsing fails, extract from description
        symbol = extractSymbolFromDescription(action) || rawSymbol.replace(/^-/, '').toUpperCase();

        // Check if it's an option trade from the action/description text
        const textOptionType = extractOptionTypeFromText(action);
        if (textOptionType) {
          optionType = textOptionType;
          assetType = 'Option';
          // Try to get expiration from description
          expirationDate = parseExpirationFromDescription(action);
          // Try to extract strike from the raw symbol if available
          const strikeMatch = rawSymbol.match(/[CP](\d+(?:\.\d+)?)$/);
          if (strikeMatch) {
            strikePrice = parseFloat(strikeMatch[1]);
          }
        }
      }

      // Skip money market fund
      if (!symbol || symbol === 'FZFXX') {
        skipped++;
        continue;
      }

      // Skip options trades — portfolio tracks stock/ETF holdings and dividends only
      if (assetType === 'Option') {
        skipped++;
        continue;
      }

      // Parse numeric fields
      const price = Math.abs(parseNumber(row['Price'] || '')); // Premium per share/contract
      const absQuantity = Math.abs(quantity);
      const commission = Math.abs(parseNumber(row['Commission'] || ''));
      const fees = Math.abs(parseNumber(row['Fees'] || ''));
      const amount = parseNumber(row['Amount'] || '');
      const settlementDateStr = (row['Settlement Date'] || '').trim();
      const settlementDate = settlementDateStr ? parseDate(settlementDateStr) : undefined;

      // Calculate margin used for Margin account option trades
      // Margin = strike × |quantity| × 100 × 0.30
      let marginUsed: number | undefined;
      if (accountType.toLowerCase() === 'margin' && strikePrice && absQuantity > 0) {
        marginUsed = strikePrice * absQuantity * 100 * 0.30;
      }

      // Determine asset type for non-option symbols
      // Treat as ETF if it's a known ETF pattern (most symbols in this context are ETFs)
      if (assetType === 'Stock' && transactionType === 'Dividend') {
        assetType = 'ETF';
      }

      const now = new Date();

      const transaction: PortfolioTransaction = {
        id: uuidv4(),
        portfolioId,
        planId,
        transactionDate,
        settlementDate,
        symbol,
        description: description || action,
        transactionType,
        assetType,
        optionType,
        strikePrice,
        expirationDate,
        quantity: absQuantity || 1,
        price,
        amount,
        fees: commission + fees,
        source: 'fidelity_csv',
        rawDescription: action,
        marginUsed,
        createdAt: now,
        updatedAt: now,
      };

      transactions.push(transaction);
    }

    return {
      transactions,
      errors,
      skipped,
      total: result.data.length,
    };
  }
}
