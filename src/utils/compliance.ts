/**
 * Plan compliance checking utilities for the TradingParadise application.
 *
 * Compares trade journal entry parameters against strategy entry criteria
 * to detect deviations from the trading plan.
 *
 * Requirements: 15.1, 15.2, 15.3
 */

import type { TradeJournalEntry } from '../types/journal';
import type { EntryCriterion, Strategy } from '../types/tradingPlan';

export interface ComplianceDeviation {
  field: string;
  expected: string;
  actual: string;
  severity: 'warning' | 'violation';
}

export interface ComplianceResult {
  isCompliant: boolean;
  deviations: ComplianceDeviation[];
}

/**
 * Attempts to parse a criterion value as a numeric range (e.g. "30-45", "30 - 45").
 * Returns null if the value is not a valid range.
 */
export function parseRange(value: string): { min: number; max: number } | null {
  const trimmed = value.trim();
  // Match patterns like "30-45", "0.20-0.35", "30 - 45"
  const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)$/);
  if (!rangeMatch) return null;
  const min = parseFloat(rangeMatch[1]);
  const max = parseFloat(rangeMatch[2]);
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
}

/**
 * Attempts to parse a criterion value as a single number.
 * Strips common suffixes like "DTE", "%", "$" before parsing.
 */
export function parseSingleNumber(value: string): number | null {
  const cleaned = value.trim().replace(/\s*(dte|%|\$|days|delta)/gi, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Maps a criterion's parameterName (free-text) to the corresponding
 * numeric field on a TradeJournalEntry. Uses case-insensitive keyword matching.
 */
function resolveEntryField(
  parameterName: string,
  entry: TradeJournalEntry,
): { value: number; fieldName: string } | null {
  const name = parameterName.toLowerCase();

  if (name.includes('dte') || name.includes('days to expiration')) {
    return { value: entry.dte, fieldName: 'DTE' };
  }
  if (name.includes('delta')) {
    // Delta is not stored directly on the entry; skip if not available
    return null;
  }
  if (name.includes('strike') && name.includes('price')) {
    return { value: entry.strikePrice, fieldName: 'Strike Price' };
  }
  if (name.includes('strike')) {
    return { value: entry.strikePrice, fieldName: 'Strike Price' };
  }
  if (name.includes('premium')) {
    return { value: entry.premium, fieldName: 'Premium' };
  }
  if (name.includes('cash reserve') || name.includes('cash_reserve')) {
    return { value: entry.cashReserve, fieldName: 'Cash Reserve' };
  }
  if (name.includes('option') && name.includes('type')) {
    // Option type is a string field, handled separately
    return null;
  }
  if (name.includes('direction')) {
    // Direction is a string field, handled separately
    return null;
  }

  return null;
}

/**
 * Resolves a criterion's parameterName to a string field on the entry
 * for non-numeric comparisons (option type, direction).
 */
function resolveStringField(
  parameterName: string,
  entry: TradeJournalEntry,
): { value: string; fieldName: string } | null {
  const name = parameterName.toLowerCase();

  if (name.includes('option') && name.includes('type')) {
    return { value: entry.optionType, fieldName: 'Option Type' };
  }
  if (name.includes('direction')) {
    return { value: entry.direction, fieldName: 'Direction' };
  }

  return null;
}

/**
 * Compares a single entry criterion against the journal entry.
 * Returns a ComplianceDeviation if the entry does not match, or null if compliant.
 */
function compareEntryCriterion(
  entry: TradeJournalEntry,
  criterion: EntryCriterion,
): ComplianceDeviation | null {
  // Try string field match first (option type, direction)
  const stringField = resolveStringField(criterion.parameterName, entry);
  if (stringField) {
    const expected = criterion.value.trim().toLowerCase();
    const actual = stringField.value.toLowerCase();
    if (expected !== actual) {
      return {
        field: stringField.fieldName,
        expected: criterion.value,
        actual: stringField.value,
        severity: 'violation',
      };
    }
    return null;
  }

  // Try numeric field match
  const numericField = resolveEntryField(criterion.parameterName, entry);
  if (!numericField) {
    // Criterion references a field we can't resolve — skip (no deviation)
    return null;
  }

  const range = parseRange(criterion.value);
  if (range) {
    if (numericField.value < range.min || numericField.value > range.max) {
      return {
        field: numericField.fieldName,
        expected: `${range.min} - ${range.max}`,
        actual: String(numericField.value),
        severity: numericField.value < range.min * 0.9 || numericField.value > range.max * 1.1
          ? 'violation'
          : 'warning',
      };
    }
    return null;
  }

  const singleValue = parseSingleNumber(criterion.value);
  if (singleValue !== null) {
    // Allow 10% tolerance for single numeric values
    const tolerance = Math.abs(singleValue) * 0.1;
    if (Math.abs(numericField.value - singleValue) > tolerance) {
      return {
        field: numericField.fieldName,
        expected: criterion.value,
        actual: String(numericField.value),
        severity: Math.abs(numericField.value - singleValue) > Math.abs(singleValue) * 0.25
          ? 'violation'
          : 'warning',
      };
    }
    return null;
  }

  // Value is non-numeric text we can't compare against a numeric field — skip
  return null;
}

/**
 * Checks a trade journal entry against a strategy's entry criteria.
 * Returns a ComplianceResult indicating whether the trade is compliant
 * and listing any deviations found.
 *
 * Requirement 15.1: Compare entry parameters against strategy entry criteria and flag deviations.
 * Requirement 15.2: Visually indicate entries that deviate from plan parameters.
 */
export function checkTradeCompliance(
  entry: TradeJournalEntry,
  strategy: Strategy,
): ComplianceResult {
  const deviations: ComplianceDeviation[] = [];

  for (const criterion of strategy.entryCriteria) {
    const deviation = compareEntryCriterion(entry, criterion);
    if (deviation) {
      deviations.push(deviation);
    }
  }

  return {
    isCompliant: deviations.length === 0,
    deviations,
  };
}

/**
 * Calculates the compliance percentage across a set of journal entries.
 * For each entry, finds its linked strategy and checks compliance.
 * Returns (compliant count / total count) * 100.
 * Returns 100 if there are no entries.
 *
 * Requirement 15.3: Display plan compliance percentage.
 */
export function calculateCompliancePercentage(
  entries: TradeJournalEntry[],
  strategies: Strategy[],
): number {
  if (entries.length === 0) return 100;

  const compliantCount = entries.filter((entry) => {
    const strategy = strategies.find((s) => s.id === entry.strategyId);
    if (!strategy) return false;
    return checkTradeCompliance(entry, strategy).isCompliant;
  }).length;

  return (compliantCount / entries.length) * 100;
}
