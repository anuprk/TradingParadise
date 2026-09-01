/**
 * Pure grouping and sorting helpers for Discord trade alerts.
 *
 * These functions contain no I/O and do not touch Supabase; they operate purely
 * over in-memory {@link DiscordTradeAlert} / {@link DiscordAlertSource} values so
 * the store and viewer can re-derive display order and grouping without a full
 * reload. All functions are deterministic and never mutate their inputs.
 *
 * The row interfaces are owned by `./discordAlertsRepository` (created in a
 * separate task); this module only imports the types.
 */

import type {
  DiscordAlertSource,
  DiscordTradeAlert,
  GroupedAlerts,
} from './discordAlertsRepository';

/**
 * Sort alerts by `submissionTimestamp` descending (most recent first), breaking
 * ties with `id` ascending as a deterministic secondary key.
 *
 * Returns a new array; the input is never mutated. The ordering is total and
 * deterministic, so the function is idempotent: sorting an already-sorted array
 * yields the same order.
 *
 * @param alerts - The alerts to sort.
 * @returns A new, sorted array of alerts.
 */
export function sortAlerts(alerts: DiscordTradeAlert[]): DiscordTradeAlert[] {
  return [...alerts].sort((a, b) => {
    const diff = b.submissionTimestamp.getTime() - a.submissionTimestamp.getTime();
    if (diff !== 0) return diff;
    // Deterministic secondary key: id ascending.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/**
 * Group alerts by their originating source.
 *
 * Produces one {@link GroupedAlerts} entry per source, in the order the sources
 * are given. Each group contains the alerts whose `sourceId` equals that
 * source's `id`, passed through {@link sortAlerts}. Every alert is placed under
 * exactly one group keyed by its own `sourceId`, so groups are pairwise disjoint.
 * Alerts whose `sourceId` has no matching source are omitted.
 *
 * @param alerts - The alerts to group.
 * @param sources - The sources defining the groups and their order.
 * @returns One grouped entry per source, each with its sorted alerts.
 */
export function groupBySource(
  alerts: DiscordTradeAlert[],
  sources: DiscordAlertSource[],
): GroupedAlerts[] {
  const bySourceId = new Map<string, DiscordTradeAlert[]>();
  for (const alert of alerts) {
    const bucket = bySourceId.get(alert.sourceId);
    if (bucket) {
      bucket.push(alert);
    } else {
      bySourceId.set(alert.sourceId, [alert]);
    }
  }

  return sources.map((source) => ({
    source,
    alerts: sortAlerts(bySourceId.get(source.id) ?? []),
  }));
}
