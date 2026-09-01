/**
 * Property-based tests (fast-check) for the manual-paste ingestion source.
 *
 * Covers the raw-content cap (Requirement 3.1) against both the exported pure
 * helper `capRawContent` and the `ManualPasteSource.toRawSubmissions(...)`
 * output. Each property is a single fast-check assertion run for a minimum of
 * 100 iterations, tagged per the discord-trade-alerts design.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { capRawContent, ManualPasteSource } from '../manualPasteSource';

const MAX = 10000;

describe('ManualPasteSource raw-content cap (properties)', () => {
  const source = fc.record({
    community: fc.string(),
    chatRoom: fc.string(),
  });

  // fast-check string arbitrary that can exceed the 10,000-char cap. Combines
  // ordinary strings with large repeated-character strings that straddle the
  // boundary (below, at, and above 10,000 chars).
  const anyInput = fc.oneof(
    fc.string({ maxLength: 12000 }),
    fc
      .tuple(fc.string({ minLength: 1, maxLength: 1 }), fc.integer({ min: 9990, max: 10020 }))
      .map(([ch, len]) => ch.repeat(len)),
  );

  // Feature: discord-trade-alerts, Property 9: Raw content capture is capped at 10,000 characters
  it('Property 9: Raw content capture is capped at 10,000 characters', () => {
    fc.assert(
      fc.property(anyInput, source, (input, src) => {
        // Pure helper: equals the first 10,000 characters, unchanged when short.
        const capped = capRawContent(input);
        expect(capped).toBe(input.slice(0, MAX));
        expect(capped.length).toBeLessThanOrEqual(MAX);
        if (input.length <= MAX) {
          expect(capped).toBe(input);
        }

        // ManualPasteSource: single element with capped rawContent + matching source.
        const submissions = new ManualPasteSource().toRawSubmissions(input, {
          community: src.community,
          chatRoom: src.chatRoom,
        });
        expect(submissions).toHaveLength(1);
        expect(submissions[0].rawContent).toBe(capped);
        expect(submissions[0].community).toBe(src.community);
        expect(submissions[0].chatRoom).toBe(src.chatRoom);
      }),
      { numRuns: 100 },
    );
  });

  // Explicit boundary examples for clarity alongside the property above.
  it('caps at exactly 10,000 characters (unchanged) and truncates 10,001', () => {
    const exactly = 'a'.repeat(MAX);
    const overBy1 = 'a'.repeat(MAX + 1);

    // Exactly 10,000: unchanged.
    expect(capRawContent(exactly)).toBe(exactly);
    expect(capRawContent(exactly).length).toBe(MAX);

    // 10,001: truncated to the first 10,000.
    expect(capRawContent(overBy1)).toBe(exactly);
    expect(capRawContent(overBy1).length).toBe(MAX);

    const src = { community: 'Mak', chatRoom: 'elite-trade-alerts' };
    expect(new ManualPasteSource().toRawSubmissions(exactly, src)[0].rawContent).toBe(exactly);
    expect(new ManualPasteSource().toRawSubmissions(overBy1, src)[0].rawContent).toBe(exactly);
  });
});
