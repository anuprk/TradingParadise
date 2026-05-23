/**
 * CSV Import utility for Google Sheets trade journal.
 * Parses CSV exported from the user's trading spreadsheet and maps
 * rows to TradeJournalEntry objects.
 *
 * Supported format columns:
 * Stock Symbol, Open Date, Exp Date, Call or Put, B/S, Stock Price DOC,
 * DTE, DIT, Current Stock Price, Break Even Price, Strike Price, Premium,
 * C (contracts), (Put) Cash Reserve, (Put) Margin Cash Reserve, Fees,
 * Exit Price, Close Date, Profit/Loss, Win/Loss, Days Held,
 * Annualized ROR for Options, Margin Annualized ROR, Status, Account,
 * P/L wrt to current price, Strategy, Actions
 */

import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { TradeJournalEntry, OptionType, TradeDirection, TradeStatus, WinLoss } from '../types/journal';

export interface CsvParseResult {
  entries: TradeJournalEntry[];
  errors: string[];
  skipped: number;
  total: number;
}

interface RawRow {
  [key: string]: string;
}

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
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
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
  // Handle negative in parentheses or with minus
  if (value.includes('(') && value.includes(')')) return -Math.abs(num);
  return num;
}

function parseOptionType(value: string): OptionType {
  const v = value.trim().toLowerCase();
  if (v === 'call' || v === 'c') return 'Call';
  return 'Put';
}

function parseDirection(value: string): TradeDirection {
  const v = value.trim().toLowerCase();
  if (v === 'b' || v === 'buy') return 'Buy';
  return 'Sell';
}

function parseStatus(value: string): TradeStatus {
  const v = value.trim().toLowerCase();
  if (v === 'open') return 'Open';
  if (v === 'expired') return 'Expired';
  if (v === 'exercised' || v === 'assigned') return 'Assigned';
  return 'Closed';
}

function parseWinLoss(value: string, profitLoss: number): WinLoss {
  if (value && value.trim()) {
    const v = value.trim().toLowerCase();
    if (v === 'win' || v === 'w') return 'Win';
    if (v === 'loss' || v === 'l') return 'Loss';
  }
  // Derive from P/L
  if (profitLoss > 0) return 'Win';
  if (profitLoss < 0) return 'Loss';
  return null;
}

function isHeaderOrSeparatorRow(row: RawRow): boolean {
  const symbol = row['Stock Symbol'] || row['stock symbol'] || '';
  // Skip rows that look like year headers (e.g., "2021 Trades") or empty
  if (!symbol.trim()) return true;
  if (/^\d{4}\s*(trades|options|puts|calls)?$/i.test(symbol.trim())) return true;
  if (symbol.trim() === '---------') return true;
  return false;
}

function normalizeHeaders(headers: string[]): Record<string, string> {
  // Map various header names to our expected keys
  const map: Record<string, string> = {};
  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (lower.includes('stock symbol') || lower === 'ticker' || lower === 'symbol') map[h] = 'stockSymbol';
    else if (lower === 'open date') map[h] = 'openDate';
    else if (lower === 'exp date' || lower === 'expiration date') map[h] = 'expirationDate';
    else if (lower === 'call or put' || lower === 'type' || lower === 'put/call') map[h] = 'optionType';
    else if (lower === 'b/s' || lower === 'direction') map[h] = 'direction';
    else if (lower === 'stock price doc') map[h] = 'stockPriceDOC';
    else if (lower === 'dte') map[h] = 'dte';
    else if (lower === 'dit' || lower === 'ditc') map[h] = 'dit';
    else if (lower === 'current stock price') map[h] = 'currentStockPrice';
    else if (lower === 'break even price') map[h] = 'breakEvenPrice';
    else if (lower === 'strike price' || lower === 'strike') map[h] = 'strikePrice';
    else if (lower === 'premium' || lower === 'open price') map[h] = 'premium';
    else if (lower === 'c' || lower === 'contracts' || lower === 'quantity') map[h] = 'contracts';
    else if (lower.includes('cash reserve') && !lower.includes('margin')) map[h] = 'cashReserve';
    else if (lower.includes('margin cash') || lower.includes('margin')) map[h] = 'marginCashReserve';
    else if (lower === 'fees' || lower === 'commission') map[h] = 'fees';
    else if (lower === 'exit price' || lower === 'close price') map[h] = 'exitPrice';
    else if (lower === 'close date') map[h] = 'closeDate';
    else if (lower === 'profit/loss' || lower === 'profit / loss $' || lower === 'p/l') map[h] = 'profitLoss';
    else if (lower === 'win/loss') map[h] = 'winLoss';
    else if (lower === 'days held') map[h] = 'daysHeld';
    else if (lower.includes('annualized ror') && !lower.includes('margin')) map[h] = 'annualizedROR';
    else if (lower.includes('margin annualized') || lower.includes('margin ror')) map[h] = 'marginAnnualizedROR';
    else if (lower === 'status') map[h] = 'status';
    else if (lower === 'account') map[h] = 'account';
    else if (lower === 'strategy') map[h] = 'strategy';
    else if (lower === 'notes') map[h] = 'notes';
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

export function parseCsvToEntries(csvText: string, planId: string, portfolioId: string): CsvParseResult {
  if (!portfolioId || portfolioId.trim() === '') {
    return { entries: [], errors: ['No portfolio selected. Please create or select a portfolio before importing.'], skipped: 0, total: 0 };
  }

  const result = Papa.parse<RawRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields || [];
  const headerMap = normalizeHeaders(headers);
  const entries: TradeJournalEntry[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i];

    // Skip header/separator rows
    if (isHeaderOrSeparatorRow(row)) {
      skipped++;
      continue;
    }

    const symbol = getField(row, headerMap, 'stockSymbol').trim().toUpperCase();
    if (!symbol) { skipped++; continue; }

    const openDate = parseDate(getField(row, headerMap, 'openDate'));
    if (!openDate) {
      errors.push(`Row ${i + 2}: Missing or invalid open date for ${symbol}`);
      skipped++;
      continue;
    }

    const expirationDate = parseDate(getField(row, headerMap, 'expirationDate'));
    const closeDate = parseDate(getField(row, headerMap, 'closeDate'));
    const strikePrice = parseNumber(getField(row, headerMap, 'strikePrice'));
    const premium = parseNumber(getField(row, headerMap, 'premium'));
    const exitPrice = parseNumber(getField(row, headerMap, 'exitPrice'));
    const profitLoss = parseNumber(getField(row, headerMap, 'profitLoss'));
    const cashReserve = parseNumber(getField(row, headerMap, 'cashReserve'));
    const marginCashReserve = parseNumber(getField(row, headerMap, 'marginCashReserve'));
    const fees = parseNumber(getField(row, headerMap, 'fees'));
    const stockPriceDOC = parseNumber(getField(row, headerMap, 'stockPriceDOC'));
    const currentStockPrice = parseNumber(getField(row, headerMap, 'currentStockPrice'));
    const breakEvenPrice = parseNumber(getField(row, headerMap, 'breakEvenPrice'));
    const dte = parseInt(getField(row, headerMap, 'dte')) || 0;
    const dit = parseInt(getField(row, headerMap, 'dit')) || 0;
    const daysHeld = parseInt(getField(row, headerMap, 'daysHeld')) || undefined;

    const optionType = parseOptionType(getField(row, headerMap, 'optionType'));
    const direction = parseDirection(getField(row, headerMap, 'direction'));
    const status = parseStatus(getField(row, headerMap, 'status'));
    const winLoss = parseWinLoss(getField(row, headerMap, 'winLoss'), profitLoss);

    const rorStr = getField(row, headerMap, 'annualizedROR').replace('%', '').trim();
    const marginRorStr = getField(row, headerMap, 'marginAnnualizedROR').replace('%', '').trim();
    const rorParsed = rorStr ? parseFloat(rorStr) : NaN;
    const marginRorParsed = marginRorStr ? parseFloat(marginRorStr) : NaN;
    const annualizedROR = Number.isFinite(rorParsed) ? rorParsed : undefined;
    const marginAnnualizedROR = Number.isFinite(marginRorParsed) ? marginRorParsed : undefined;

    const strategy = getField(row, headerMap, 'strategy') || '';
    const account = getField(row, headerMap, 'account') || '';
    const notes = getField(row, headerMap, 'notes') || '';

    const now = new Date();
    const entry: TradeJournalEntry = {
      id: uuidv4(),
      stockSymbol: symbol,
      openDate,
      expirationDate: expirationDate || openDate,
      optionType,
      direction,
      stockPriceDOC: stockPriceDOC || 0,
      dte,
      ditc: dit,
      currentStockPrice: currentStockPrice || undefined,
      breakEvenPrice: breakEvenPrice || 0,
      strikePrice,
      premium: Math.abs(premium),
      contracts: parseInt(getField(row, headerMap, 'contracts')) || 1,
      cashReserve: Math.abs(cashReserve),
      marginCashReserve: marginCashReserve ? Math.abs(marginCashReserve) : undefined,
      fees: Math.abs(fees),
      exitPrice: exitPrice ? Math.abs(exitPrice) : undefined,
      closeDate: closeDate || undefined,
      profitLoss: profitLoss || undefined,
      winLoss,
      daysHeld,
      annualizedROR,
      marginAnnualizedROR,
      tradeStatus: status,
      portfolioId,
      strategyId: strategy,
      planId,
      unrealizedPL: undefined,
      notes: `${account ? `Account: ${account}` : ''}${notes ? `\n${notes}` : ''}`.trim(),
      createdAt: now,
      updatedAt: now,
    };

    entries.push(entry);
  }

  return {
    entries,
    errors,
    skipped,
    total: result.data.length,
  };
}
