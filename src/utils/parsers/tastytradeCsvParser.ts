/**
 * Tastytrade CSV Parser implementing the StatementParser strategy interface.
 * Parses CSV exports from tastytrade's transaction history download.
 *
 * Expected columns: Date, Type, Sub Type, Action, Symbol, Instrument Type,
 * Description, Value, Quantity, Average Price, Commissions, Fees, Multiplier,
 * Root Symbol, Underlying Symbol, Expiration Date, Strike Price, Call or Put,
 * Order #, Total, Currency
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

const TASTYTRADE_CSV_REQUIRED_HEADERS = ['Date', 'Type', 'Action', 'Symbol', 'Description'];

/**
 * Checks if a CSV's headers match the tastytrade transaction history format.
 */
export function isTastytradeCsvFormat(headers: string[]): boolean {
  const normalized = headers.map((h) => h.trim());
  return TASTYTRADE_CSV_REQUIRED_HEADERS.every((req) =>
    normalized.some((h) => h === req),
  );
}

// --- Value parsers ---

function parseDate(value: string): Date | undefined {
  if (!value || value.trim() === '') return undefined;
  const trimmed = value.trim();

  // Tastytrade uses ISO format: 2026-05-08T13:00:00-0700
  // Extract just the date part
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return new Date(year, month - 1, day);
  }

  // Try MM/DD/YY format for expiration dates
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }

  return undefined;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '' || value.trim() === '--') return 0;
  // Remove $, commas, quotes, and whitespace
  const cleaned = value.replace(/[$,"\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseOptionType(value: string): OptionType | undefined {
  const v = value.trim().toUpperCase();
  if (v === 'CALL' || v === 'C') return 'Call';
  if (v === 'PUT' || v === 'P') return 'Put';
  return undefined;
}

function mapAction(action: string, subType: string): TransactionType {
  const a = action.trim().toUpperCase();
  if (a === 'SELL_TO_OPEN' || a === 'SELL_TO_CLOSE') return 'Sell';
  if (a === 'BUY_TO_OPEN' || a === 'BUY_TO_CLOSE') return 'Buy';

  const st = subType.trim().toLowerCase();
  if (st === 'sell to open' || st === 'sell to close') return 'Sell';
  if (st === 'buy to open' || st === 'buy to close') return 'Buy';
  if (st === 'expiration') return 'Expiration';
  if (st === 'assignment') return 'Assignment';
  if (st === 'dividend') return 'Dividend';

  return 'Buy';
}

function mapAssetType(instrumentType: string, optionType: OptionType | undefined): AssetType {
  const it = instrumentType.trim().toLowerCase();
  if (it === 'equity option' || it === 'future option') return 'Option';
  if (it === 'equity') return 'Stock';
  if (optionType) return 'Option';
  return 'Stock';
}

// --- Tastytrade CSV Parser Class ---

export class TastytradeCsvParser implements StatementParser {
  canParse(content: ArrayBuffer | string): boolean {
    if (typeof content !== 'string') return false;
    // Check first line for tastytrade headers
    const firstLine = content.split('\n')[0] || '';
    const headers = firstLine.split(',').map((h) => h.trim());
    return isTastytradeCsvFormat(headers);
  }

  async parse(
    content: ArrayBuffer | string,
    portfolioId: string,
    planId: string,
  ): Promise<ParseResult> {
    if (typeof content !== 'string') {
      return {
        transactions: [],
        errors: [{ row: 0, content: '', reason: 'Tastytrade CSV parser requires string content' }],
        skipped: 0,
        total: 0,
      };
    }

    const result = Papa.parse<RawRow>(content, {
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

      const type = (row['Type'] || '').trim();
      const subType = (row['Sub Type'] || '').trim();
      const action = (row['Action'] || '').trim();

      // Skip non-trade rows (Money Movement, Balance Adjustment, etc.)
      if (type === 'Money Movement' || type === 'Receive Deliver') {
        // Keep expirations and assignments from Receive Deliver
        if (type === 'Receive Deliver' && (subType === 'Expiration' || subType === 'Assignment')) {
          // Process these
        } else {
          skipped++;
          continue;
        }
      }

      // Parse date
      const dateStr = (row['Date'] || '').trim();
      const transactionDate = parseDate(dateStr);
      if (!transactionDate) {
        skipped++;
        errors.push({ row: rowNumber, content: dateStr, reason: `Unparseable date: "${dateStr}"` });
        continue;
      }

      // Get symbol - use Root Symbol or Underlying Symbol for options, Symbol for stocks
      const rootSymbol = (row['Root Symbol'] || '').trim();
      const underlyingSymbol = (row['Underlying Symbol'] || '').trim();
      const rawSymbol = (row['Symbol'] || '').trim();
      const symbol = (rootSymbol || underlyingSymbol || rawSymbol.split(/\s+/)[0] || '').toUpperCase();

      if (!symbol) {
        skipped++;
        errors.push({ row: rowNumber, content: JSON.stringify(row), reason: 'Missing symbol' });
        continue;
      }

      // Parse fields
      const optionType = parseOptionType(row['Call or Put'] || '');
      const transactionType = mapAction(action, subType);
      const instrumentType = (row['Instrument Type'] || '').trim();
      const assetType = mapAssetType(instrumentType, optionType);

      // Only keep options trades — skip stocks, futures, and other instruments
      if (assetType !== 'Option') {
        skipped++;
        continue;
      }

      const quantity = Math.abs(parseNumber(row['Quantity'] || ''));
      const price = Math.abs(parseNumber(row['Average Price'] || ''));
      const value = parseNumber(row['Value'] || '');
      const total = parseNumber(row['Total'] || '');
      const commissions = Math.abs(parseNumber(row['Commissions'] || ''));
      const fees = Math.abs(parseNumber(row['Fees'] || ''));
      const strikePrice = parseNumber(row['Strike Price'] || '') || undefined;
      const expirationDateStr = (row['Expiration Date'] || '').trim();
      const expirationDate = expirationDateStr ? parseDate(expirationDateStr) : undefined;
      const description = (row['Description'] || '').trim();

      const now = new Date();

      const transaction: PortfolioTransaction = {
        id: uuidv4(),
        portfolioId,
        planId,
        transactionDate,
        symbol,
        description,
        transactionType,
        assetType,
        optionType,
        strikePrice,
        expirationDate,
        quantity: quantity || 1,
        price,
        amount: total || value,
        fees: commissions + fees,
        source: 'tastytrade_csv',
        rawDescription: `${action} | ${description}`,
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
