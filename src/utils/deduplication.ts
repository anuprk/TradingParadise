/**
 * De-duplication engine for portfolio transaction imports.
 *
 * Compares new transactions against existing ones using fingerprint matching.
 * Transactions with identical fingerprints are flagged as duplicates and
 * excluded from import by default (users can override individual detections).
 */

import type { PortfolioTransaction, DuplicateReport, DuplicateEntry } from '../types/transaction';
import { computeFingerprint } from './fingerprint';

/**
 * Identifies duplicate transactions by comparing fingerprints of new transactions
 * against existing transactions in the same portfolio.
 *
 * @param newTransactions - Transactions to be imported
 * @param existingTransactions - Transactions already persisted in the portfolio
 * @returns DuplicateReport with `duplicates` (matched) and `unique` (unmatched) arrays
 */
export function findDuplicates(
  newTransactions: PortfolioTransaction[],
  existingTransactions: PortfolioTransaction[],
): DuplicateReport {
  // Build a map from fingerprint → existing transaction id for lookup
  const existingFingerprintMap = new Map<string, string>();
  for (const existing of existingTransactions) {
    const fp = computeFingerprint(existing);
    existingFingerprintMap.set(fp, existing.id);
  }

  const duplicates: DuplicateEntry[] = [];
  const unique: PortfolioTransaction[] = [];

  for (const txn of newTransactions) {
    const fp = computeFingerprint(txn);
    const existingId = existingFingerprintMap.get(fp);

    if (existingId !== undefined) {
      duplicates.push({
        transaction: txn,
        existingId,
        fingerprint: fp,
        overrideInclude: false,
      });
    } else {
      unique.push(txn);
    }
  }

  return { duplicates, unique };
}
