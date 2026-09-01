/**
 * Pure validation and initial-build gate helpers for Discord trade alerts.
 *
 * These functions contain no I/O and do not touch Supabase or the network; they
 * operate purely over their arguments so the store and UI can validate source
 * names, detect duplicate sources, and gate persistence without side effects.
 * All functions are deterministic and never mutate their inputs.
 *
 * This module is store-side and intentionally separate from the db-side
 * `../db/discordAlertsHelpers`, which owns grouping/sorting over repository rows.
 */

import type { ParsedTradeAlert } from '../utils/parsers/discordAlertParser';

/**
 * Validate a source name (community or chat room) by its trimmed length.
 *
 * Accepts the name if and only if its length after trimming leading/trailing
 * whitespace is between 1 and 100 inclusive. Empty or whitespace-only names are
 * rejected, and names longer than 100 characters after trimming are rejected.
 *
 * @param name - The candidate source name.
 * @returns True if the trimmed length is within [1, 100], otherwise false.
 */
export function isValidSourceName(name: string): boolean {
  const length = name.trim().length;
  return length >= 1 && length <= 100;
}

/**
 * Determine whether a candidate source duplicates an existing one.
 *
 * A duplicate is detected when some existing entry matches the candidate on
 * BOTH `community` and `chatRoom`, compared case-insensitively and with
 * leading/trailing whitespace trimmed.
 *
 * @param candidate - The source being added, with `community` and `chatRoom`.
 * @param existing - The already-configured sources to compare against.
 * @returns True if `existing` contains a case- and trim-insensitive match.
 */
export function isDuplicateSource(
  candidate: { community: string; chatRoom: string },
  existing: ReadonlyArray<{ community: string; chatRoom: string }>,
): boolean {
  const normalize = (value: string): string => value.trim().toLowerCase();
  const community = normalize(candidate.community);
  const chatRoom = normalize(candidate.chatRoom);

  return existing.some(
    (entry) =>
      normalize(entry.community) === community &&
      normalize(entry.chatRoom) === chatRoom,
  );
}

/**
 * Gate persistence for the initial build, which stores only Open alerts.
 *
 * Returns true if and only if the parsed alert's `actionType` is `'Open'`.
 * `Adjust`, `Close`, and `Unclassified` alerts are not persisted in the
 * initial build.
 *
 * @param parsed - The parsed alert, needing only its `actionType`.
 * @returns True if the alert should be persisted (Open), otherwise false.
 */
export function isPersistableInInitialBuild(
  parsed: Pick<ParsedTradeAlert, 'actionType'>,
): boolean {
  return parsed.actionType === 'Open';
}
