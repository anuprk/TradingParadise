/**
 * Property-based tests for the pure store-side helpers in
 * `../discordAlertsHelpers` (`isValidSourceName`, `isDuplicateSource`,
 * `isPersistableInInitialBuild`).
 *
 * These helpers are pure and touch no I/O, so no Supabase mock is needed. Each
 * property is a single fast-check assertion run for at least 100 iterations and
 * tagged with a `// Feature: discord-trade-alerts, Property N: <name>` comment.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  isValidSourceName,
  isDuplicateSource,
  isPersistableInInitialBuild,
} from '../discordAlertsHelpers';
import type { AlertActionType } from '../../utils/parsers/discordAlertParser';

const ACTION_TYPES: AlertActionType[] = ['Open', 'Adjust', 'Close', 'Unclassified'];

describe('discordAlertsHelpers (store-side)', () => {
  // Feature: discord-trade-alerts, Property 7: Source-name validation respects length bounds
  it('Property 7: Source-name validation respects length bounds', () => {
    // Generate names that straddle the [1, 100] trimmed-length boundary:
    // empty, whitespace-only, exactly 1, exactly 100, 101, and variants padded
    // with leading/trailing whitespace so the trim step is exercised.
    const whitespaceUnit = fc.constantFrom(' ', '\t', '\n');
    const boundaryName = fc
      .oneof(
        fc.constant(''),
        // whitespace-only strings (trim to length 0)
        fc.string({ unit: whitespaceUnit, minLength: 1, maxLength: 10 }),
        // content of a chosen length near the boundary
        fc
          .integer({ min: 1, max: 101 })
          .chain((len) =>
            fc.string({ unit: fc.constantFrom('a', 'b', 'c'), minLength: len, maxLength: len }),
          ),
        // exact boundary lengths
        fc.constant('x'.repeat(1)),
        fc.constant('x'.repeat(100)),
        fc.constant('x'.repeat(101)),
      )
      .chain((core) =>
        // Optionally wrap the core with leading/trailing whitespace.
        fc
          .tuple(
            fc.string({ unit: whitespaceUnit, maxLength: 5 }),
            fc.string({ unit: whitespaceUnit, maxLength: 5 }),
          )
          .map(([lead, trail]) => `${lead}${core}${trail}`),
      );

    fc.assert(
      fc.property(boundaryName, (name) => {
        const trimmedLength = name.trim().length;
        const expected = trimmedLength >= 1 && trimmedLength <= 100;
        expect(isValidSourceName(name)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 8: Duplicate-source detection is case-insensitive and trim-insensitive
  it('Property 8: Duplicate-source detection is case-insensitive and trim-insensitive', () => {
    // Non-empty base names so that case/whitespace variants remain meaningful.
    const nameArb = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0);

    // Randomly flip letter case and add leading/trailing whitespace to a value.
    const deriveVariant = (
      value: string,
      flags: boolean[],
      lead: string,
      trail: string,
    ): string => {
      let out = '';
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        const flip = flags[i % flags.length];
        out += flip ? (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()) : ch;
      }
      return `${lead}${out}${trail}`;
    };

    const whitespace = fc.string({ unit: fc.constantFrom(' ', '\t', '\n'), maxLength: 4 });
    const caseFlags = fc.array(fc.boolean(), { minLength: 1, maxLength: 8 });

    fc.assert(
      fc.property(
        nameArb,
        nameArb,
        caseFlags,
        whitespace,
        whitespace,
        caseFlags,
        whitespace,
        whitespace,
        (community, chatRoom, cFlags, cLead, cTrail, rFlags, rLead, rTrail) => {
          const existing = [{ community, chatRoom }];

          // A variant that differs from the base only by case and whitespace
          // must be detected as a duplicate.
          const variant = {
            community: deriveVariant(community, cFlags, cLead, cTrail),
            chatRoom: deriveVariant(chatRoom, rFlags, rLead, rTrail),
          };
          expect(isDuplicateSource(variant, existing)).toBe(true);

          // A genuinely different name (normalized) must not match. Prefix with
          // a sentinel guaranteed to change the normalized value.
          const different = {
            community: `zzz-${community}-different`,
            chatRoom,
          };
          const normalize = (v: string): string => v.trim().toLowerCase();
          const isActuallyDifferent =
            normalize(different.community) !== normalize(community) ||
            normalize(different.chatRoom) !== normalize(chatRoom);
          if (isActuallyDifferent) {
            expect(isDuplicateSource(different, existing)).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 10: Initial-build gate persists only Open alerts
  it('Property 10: Initial-build gate persists only Open alerts', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ACTION_TYPES), (actionType) => {
        expect(isPersistableInInitialBuild({ actionType })).toBe(actionType === 'Open');
      }),
      { numRuns: 100 },
    );
  });
});
