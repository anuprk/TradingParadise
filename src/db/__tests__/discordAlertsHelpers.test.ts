/**
 * Property-based tests for the pure grouping and sorting helpers in
 * `../discordAlertsHelpers` (`groupBySource`, `sortAlerts`).
 *
 * These helpers are pure and touch no I/O, so no Supabase mock is needed. We
 * build fast-check arbitraries for {@link DiscordTradeAlert} and
 * {@link DiscordAlertSource} that focus on the fields the helpers actually use
 * (`id`, `sourceId`, `submissionTimestamp` for alerts; `id` for sources) and
 * fill the remaining fields with simple constants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import { groupBySource, sortAlerts } from '../discordAlertsHelpers';
import type {
  DiscordAlertSource,
  DiscordTradeAlert,
} from '../discordAlertsRepository';

// --- Generators ---

const arbDate = fc.date({
  min: new Date(2000, 0, 1),
  max: new Date(2099, 11, 31),
  noInvalidDate: true,
});

/** A source whose only relevant field is `id`; the rest are simple constants. */
function arbSource(id: string): DiscordAlertSource {
  return {
    id,
    community: 'community',
    chatRoom: 'chat-room',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

/**
 * Build a {@link DiscordTradeAlert} arbitrary. Only `id`, `sourceId`, and
 * `submissionTimestamp` matter to the helpers; everything else is a constant.
 */
function arbAlert(sourceIdArb: fc.Arbitrary<string>): fc.Arbitrary<DiscordTradeAlert> {
  return fc.record({
    id: fc.uuid(),
    sourceId: sourceIdArb,
    submissionTimestamp: arbDate,
  }).map((partial) => ({
    ...partial,
    messageId: 'msg',
    rawContent: 'raw',
    actionType: 'Open',
    symbol: null,
    strategy: null,
    expiration: null,
    strikes: null,
    direction: null,
    fillPrice: null,
    amount: null,
    amountKind: null,
    links: [],
    extractedAnyField: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as DiscordTradeAlert));
}

/**
 * Generate a small distinct set of source ids plus one extra "unmatched" id
 * that is NOT among the sources. Alerts draw their `sourceId` from the union so
 * that some alerts land in groups and some (the unmatched ones) are omitted.
 */
const arbScenario = fc
  .uniqueArray(fc.uuid(), { minLength: 1, maxLength: 5 })
  .chain((sourceIds) =>
    // A distinct unmatched id, guaranteed not to be one of the source ids.
    fc
      .uuid()
      .filter((extra) => !sourceIds.includes(extra))
      .chain((unmatchedId) => {
        const drawableIds = [...sourceIds, unmatchedId];
        return fc
          .array(arbAlert(fc.constantFrom(...drawableIds)), { maxLength: 30 })
          .map((alerts) => ({
            sources: sourceIds.map(arbSource),
            sourceIds,
            alerts,
          }));
      }),
  );

describe('discordAlertsHelpers', () => {
  // Feature: discord-trade-alerts, Property 13: Grouping partitions alerts by source
  it('groupBySource partitions matched alerts into one disjoint group per source, in source order', () => {
    fc.assert(
      fc.property(arbScenario, ({ sources, sourceIds, alerts }) => {
        const groups = groupBySource(alerts, sources);

        // One group per source, in the same order as the provided sources.
        expect(groups.map((g) => g.source.id)).toEqual(sourceIds);

        const sourceIdSet = new Set(sourceIds);

        // Every alert in a group belongs to that group's source.
        for (const group of groups) {
          for (const alert of group.alerts) {
            expect(alert.sourceId).toBe(group.source.id);
          }
        }

        // Groups are pairwise disjoint (no alert id appears in two groups).
        const seen = new Set<string>();
        for (const group of groups) {
          for (const alert of group.alerts) {
            expect(seen.has(alert.id)).toBe(false);
            seen.add(alert.id);
          }
        }

        // The union of all grouped alerts equals the set of input alerts whose
        // sourceId is among the provided sources (unmatched alerts are omitted).
        const expectedMatched = alerts.filter((a) => sourceIdSet.has(a.sourceId));
        const groupedIds = new Set(
          groups.flatMap((g) => g.alerts).map((a) => a.id),
        );
        const expectedIds = new Set(expectedMatched.map((a) => a.id));
        expect(groupedIds).toEqual(expectedIds);
        expect(groupedIds.size).toBe(expectedMatched.length);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 14: Sorting yields a descending permutation with a deterministic tie-break
  it('sortAlerts is a non-mutating, idempotent descending sort with id-ascending tie-break', () => {
    fc.assert(
      fc.property(fc.array(arbAlert(fc.uuid()), { maxLength: 40 }), (alerts) => {
        const snapshot = alerts.map((a) => a.id);
        const sorted = sortAlerts(alerts);

        // Input is not mutated (same order and same references).
        expect(alerts.map((a) => a.id)).toEqual(snapshot);

        // Permutation: same multiset of ids.
        expect([...sorted].map((a) => a.id).sort()).toEqual(
          [...alerts].map((a) => a.id).sort(),
        );
        expect(sorted).toHaveLength(alerts.length);

        // Ordered by submissionTimestamp descending, ties broken by id ascending.
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];
          const prevT = prev.submissionTimestamp.getTime();
          const currT = curr.submissionTimestamp.getTime();
          expect(prevT).toBeGreaterThanOrEqual(currT);
          if (prevT === currT) {
            expect(prev.id <= curr.id).toBe(true);
          }
        }

        // Idempotent: sorting an already-sorted array yields the same order.
        const resorted = sortAlerts(sorted);
        expect(resorted.map((a) => a.id)).toEqual(sorted.map((a) => a.id));
      }),
      { numRuns: 100 },
    );
  });
});
