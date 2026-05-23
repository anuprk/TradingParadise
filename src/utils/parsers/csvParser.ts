/**
 * CSV Parser implementing the StatementParser strategy interface.
 * Parses CSV text content into PortfolioTransaction records using papaparse.
 *
 * Supported columns: Stock Symbol, Open Date, Expiration Date, Option Type,
 * Direction, Stock Price DOC, Strike Price, Premium, Contracts, Fees,
 * Exit Price, Close Date, Profit/Loss, Status, Strategy, Notes, etc.
 *
 * Required columns: Stock Symbol, Open Date
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

// --- Header normalization mapping ---

function normalizeHeader(header: string): string {
  const lower = header.toLowerCase().trim();
  if (lower === 'stock symbol' || lower === 'ticker' || lower === 'symbol') return 'stockSymbol';
  if (lower === 'open date') return 'openDate';
  if (lower === 'expiration date' || lower === 'exp date') return 'expirationDate';
  if (lower === 'option type' || lower === 'call or put' || lower === 'put/call') return 'optionType';
  if (lower === 'direction' || lower === 'b/s') return 'direction';
  if (lower === 'stock price doc') return 'stockPriceDOC';
  if (lower === 'strike price' || lower === 'strike') return 'strikePrice';
  if (lower === 'premium' || lower === 'open price') return 'premium';
  if (lower === 'contracts' || lower === 'c' || lower === 'quantity') return 'contracts';
  if (lower === 'fees' || lower === 'commission') return 'fees';
  if (lower === 'exit price' || lower === 'close price') return 'exitPrice';
  if (lower === 'close date') return 'closeDate';
  if (lower === 'profit/loss' || lower === 'profit / loss $' || lower === 'p/l') return 'profitLoss';
  if (lower === 'status') return 'status';
  if (lower === 'strategy') return 'strategy';
  if (lower === 'notes') return 'notes';
  if (lower === 'account') return 'account';
  if (lower === 'win/loss') return 'winLoss';
  if (lower === 'days held') return 'daysHeld';
  if (lower.includes('cash reserve') && !lower.includes('margin')) return 'cashReserve';
  if (lower.includes('margin cash') || lower.includes('margin')) return 'marginCashReserve';
  if (lower.includes('annualized ror') && !lower.includes('margin')) return 'annualizedROR';
  if (lower.includes('margin annualized') || lower.includes('margin ror')) return 'marginAnnualizedROR';
  return lower;
}

function buildHeaderMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    map[h] = normalizeHeader(h);
  }
  return map;
}

function getField(row: RawRow, headerMap: Record<string, string>, field: string): string {
  for (const [originalHeader, mappedField] of Object.entries(headerMap)) {
    if (mappedField === field) {
      return row[originalHeader] || '';
    }
  }
  return '';
}

// --- Value parsers ---

function parseDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const trimmed = value.trim();

  // Try MM/DD/YY and MM/DD/YYYY formats
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

  // Try YYYY-MM-DD format
  const isoParts = trimmed.split('-');
  if (isoParts.length === 3) {
    const year = parseInt(isoParts[0], 10);
    const month = parseInt(isoParts[1], 10);
    const day = parseInt(isoParts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  // Fallback to Date.parse
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove $, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  // Handle negative in parentheses
  if (value.includes('(') && value.includes(')')) return -Math.abs(num);
  return num;
}

function parseOptionType(value: string): OptionType | undefined {
  const v = value.trim().toLowerCase();
  if (v === 'call' || v === 'c') return 'Call';
  if (v === 'put' || v === 'p') return 'Put';
  return undefined;
}

function parseDirection(value: string): TransactionType {
  const v = value.trim().toLowerCase();
  if (v === 'b' || v === 'buy') return 'Buy';
  if (v === 's' || v === 'sell') return 'Sell';
  return 'Buy'; // default
}

function determineAssetType(optionType: OptionType | undefined): AssetType {
  if (optionType === 'Call' || optionType === 'Put') return 'Option';
  return 'Stock';
}

function hasRequiredColumns(headers: string[]): { valid: boolean; missing: string[] } {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  const missing: string[] = [];

  const hasSymbol = normalized.some(
    (h) => h === 'stock symbol' || h === 'ticker' || h === 'symbol',
  );
  if (!hasSymbol) missing.push('Stock Symbol');

  const hasOpenDate = normalized.some((h) => h === 'open date');
  if (!hasOpenDate) missing.push('Open Date');

  return { valid: missing.length === 0, missing };
}

// --- CSV Parser Class ---

export class CsvParser implements StatementParser {
  /**
   * CSV content is always a string (text), not an ArrayBuffer.
   */
  canParse(content: ArrayBuffer | string): boolean {
    return typeof content === 'string';
  }

  /**
   * Parse CSV string content into PortfolioTransaction records.
   */
  async parse(
    content: ArrayBuffer | string,
    portfolioId: string,
    planId: string,
  ): Promise<ParseResult> {
    if (typeof content !== 'string') {
      return {
        transactions: [],
        errors: [{ row: 0, content: '', reason: 'CSV parser requires string content, received ArrayBuffer' }],
        skipped: 0,
        total: 0,
      };
    }

    const result = Papa.parse<RawRow>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    const headers = result.meta.fields || [];

    // Validate required columns
    const { valid, missing } = hasRequiredColumns(headers);
    if (!valid) {
      return {
        transactions: [],
        errors: [
          {
            row: 0,
            content: '',
            reason: `Missing required columns: ${missing.join(', ')}`,
            missingFields: missing,
          },
        ],
        skipped: 0,
        total: result.data.length,
      };
    }

    const headerMap = buildHeaderMap(headers);
    const transactions: PortfolioTransaction[] = [];
    const errors: ParseError[] = [];
    let skipped = 0;

    for (let i = 0; i < result.data.length; i++) {
      const row = result.data[i];
      const rowNumber = i + 2; // +2 because row 1 is headers, data starts at row 2

      // Get and validate Stock Symbol
      const symbol = getField(row, headerMap, 'stockSymbol').trim().toUpperCase();
      if (!symbol) {
        skipped++;
        errors.push({
          row: rowNumber,
          content: JSON.stringify(row),
          reason: 'Missing or empty Stock Symbol',
        });
        continue;
      }

      // Get and validate Open Date
      const openDateStr = getField(row, headerMap, 'openDate');
      const transactionDate = parseDate(openDateStr);
      if (!transactionDate) {
        skipped++;
        errors.push({
          row: rowNumber,
          content: JSON.stringify(row),
          reason: `Unparseable Open Date: "${openDateStr}"`,
        });
        continue;
      }

      // Parse optional fields
      const optionType = parseOptionType(getField(row, headerMap, 'optionType'));
      const direction = parseDirection(getField(row, headerMap, 'direction'));
      const strikePrice = parseNumber(getField(row, headerMap, 'strikePrice'));
      const premium = parseNumber(getField(row, headerMap, 'premium'));
      const contracts = parseNumber(getField(row, headerMap, 'contracts'));
      const fees = parseNumber(getField(row, headerMap, 'fees'));
      const profitLoss = parseNumber(getField(row, headerMap, 'profitLoss'));
      const expirationDate = parseDate(getField(row, headerMap, 'expirationDate'));
      const closeDate = parseDate(getField(row, headerMap, 'closeDate'));
      const strategy = getField(row, headerMap, 'strategy');
      const notes = getField(row, headerMap, 'notes');

      const assetType = determineAssetType(optionType);
      const now = new Date();

      const transaction: PortfolioTransaction = {
        id: uuidv4(),
        portfolioId,
        planId,
        transactionDate,
        settlementDate: closeDate || undefined,
        symbol,
        description: strategy || '',
        transactionType: direction,
        assetType,
        optionType: optionType || undefined,
        strikePrice: strikePrice || undefined,
        expirationDate: expirationDate || undefined,
        quantity: Math.abs(contracts) || 1,
        price: Math.abs(premium),
        amount: profitLoss,
        fees: Math.abs(fees),
        source: 'csv',
        rawDescription: notes || undefined,
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
