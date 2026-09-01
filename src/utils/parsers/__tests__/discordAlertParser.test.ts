/**
 * Unit tests for the Discord trade-alert parser POC.
 *
 * Assertions are strict for symbol/direction/amount/actionType and tolerant
 * (toContain/toMatch) for the fuzzier fields (strategy/expiration/strikes),
 * reflecting the best-effort nature of the parser.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseDiscordAlert } from '../discordAlertParser';
import { DISCORD_ALERT_EXAMPLES } from '../__fixtures__/discordAlertExamples';

const [EXAMPLE_1, EXAMPLE_2, EXAMPLE_3] = DISCORD_ALERT_EXAMPLES;

function parseExample(example: (typeof DISCORD_ALERT_EXAMPLES)[number]) {
  return parseDiscordAlert(example.rawContent, {
    community: example.community,
    chatRoom: example.chatRoom,
  });
}

describe('parseDiscordAlert', () => {
  it('classifies all three examples as Open', () => {
    for (const example of DISCORD_ALERT_EXAMPLES) {
      expect(parseExample(example).actionType).toBe('Open');
    }
  });

  describe('Example 1 (OptionsKit / income-trades)', () => {
    const parsed = parseExample(EXAMPLE_1);

    it('extracts symbol TSM', () => {
      expect(parsed.symbol).toBe('TSM');
    });

    it('extracts direction buy', () => {
      expect(parsed.direction).toBe('buy');
    });

    it('extracts fillPrice 2.8', () => {
      expect(parsed.fillPrice).toBeCloseTo(2.8, 5);
    });

    it('extracts strikes containing 450/460', () => {
      expect(parsed.strikes).toContain('450/460');
    });

    it('extracts a Call Spread strategy', () => {
      expect(parsed.strategy).toMatch(/Call Spread/i);
    });

    it('extracts one optionstrat.com link', () => {
      expect(parsed.links).toHaveLength(1);
      expect(parsed.links[0]).toContain('optionstrat.com');
    });
  });

  describe('Example 2 (Mak\'s Money Maker Club / elite-trade-alerts)', () => {
    const parsed = parseExample(EXAMPLE_2);

    it('extracts symbol NVDA', () => {
      expect(parsed.symbol).toBe('NVDA');
    });

    it('extracts direction sell', () => {
      expect(parsed.direction).toBe('sell');
    });

    it('extracts amount 890 with amountKind credit', () => {
      expect(parsed.amount).toBe(890);
      expect(parsed.amountKind).toBe('credit');
    });

    it('extracts a Secured Put strategy', () => {
      expect(parsed.strategy).toMatch(/Secured Put/i);
    });
  });

  describe('Example 3 (MRTOPTICK / igor-in-trades)', () => {
    const parsed = parseExample(EXAMPLE_3);

    it('classifies as Open', () => {
      expect(parsed.actionType).toBe('Open');
    });

    it('extracts amount 8.75 with amountKind credit', () => {
      expect(parsed.amount).toBe(8.75);
      expect(parsed.amountKind).toBe('credit');
    });

    it('extracts an Iron Condor strategy', () => {
      expect(parsed.strategy).toMatch(/Iron Condor/i);
    });
  });

  describe('empty input', () => {
    const parsed = parseDiscordAlert('   \n  \t ', {
      community: 'X',
      chatRoom: 'Y',
    });

    it('classifies as Unclassified with no extracted fields', () => {
      expect(parsed.actionType).toBe('Unclassified');
      expect(parsed.extractedAnyField).toBe(false);
      expect(parsed.symbol).toBeNull();
      expect(parsed.strategy).toBeNull();
      expect(parsed.direction).toBeNull();
      expect(parsed.amount).toBeNull();
      expect(parsed.amountKind).toBeNull();
      expect(parsed.fillPrice).toBeNull();
      expect(parsed.links).toEqual([]);
    });
  });

  describe('determinism', () => {
    it('yields deeply equal results (including messageId) for repeated parses', () => {
      const first = parseExample(EXAMPLE_2);
      const second = parseExample(EXAMPLE_2);
      expect(second).toEqual(first);
      expect(second.messageId).toBe(first.messageId);
    });

    it('produces distinct messageIds for distinct source/content', () => {
      const a = parseExample(EXAMPLE_1);
      const b = parseExample(EXAMPLE_2);
      expect(a.messageId).not.toBe(b.messageId);
    });
  });

  describe('links', () => {
    it('dedupes repeated URLs', () => {
      const url = 'https://example.com/a';
      const parsed = parseDiscordAlert(`BTO XYZ ${url} and again ${url}`, {
        community: 'C',
        chatRoom: 'R',
      });
      expect(parsed.links).toEqual([url]);
    });

    it('caps the number of links at 50', () => {
      const urls = Array.from({ length: 60 }, (_, i) => `https://example.com/${i}`);
      const parsed = parseDiscordAlert(urls.join(' '), {
        community: 'C',
        chatRoom: 'R',
      });
      expect(parsed.links).toHaveLength(50);
    });
  });
});

/**
 * Property-based tests (fast-check) for the reused Discord trade-alert parser.
 * Each property is a single fast-check assertion run for a minimum of 100
 * iterations, tagged per the discord-trade-alerts design.
 */
describe('parseDiscordAlert (properties)', () => {
  const source = fc.record({
    community: fc.string(),
    chatRoom: fc.string(),
  });

  const ACTION_TYPES = ['Open', 'Adjust', 'Close', 'Unclassified'];

  // Feature: discord-trade-alerts, Property 1: Parser determinism
  it('Property 1: Parser determinism', () => {
    fc.assert(
      fc.property(fc.string(), source, (rawContent, src) => {
        const first = parseDiscordAlert(rawContent, src);
        const second = parseDiscordAlert(rawContent, src);
        expect(second).toEqual(first);
        expect(second.messageId).toBe(first.messageId);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 2: Action type is always in the fixed set
  it('Property 2: Action type is always in the fixed set', () => {
    fc.assert(
      fc.property(fc.string(), source, (rawContent, src) => {
        const { actionType } = parseDiscordAlert(rawContent, src);
        expect(ACTION_TYPES).toContain(actionType);
        if (rawContent.trim() === '') {
          expect(actionType).toBe('Unclassified');
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 3: Parser preserves raw content exactly
  it('Property 3: Parser preserves raw content exactly', () => {
    fc.assert(
      fc.property(fc.string(), source, (rawContent, src) => {
        expect(parseDiscordAlert(rawContent, src).rawContent).toBe(rawContent);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 4: Parser output fields lie in their declared domains
  it('Property 4: Parser output fields lie in their declared domains', () => {
    fc.assert(
      fc.property(fc.string(), source, (rawContent, src) => {
        const result = parseDiscordAlert(rawContent, src);
        expect([null, 'buy', 'sell']).toContain(result.direction);
        expect([null, 'credit', 'debit']).toContain(result.amountKind);
        expect(result.amount === null || typeof result.amount === 'number').toBe(true);
        expect(result.fillPrice === null || typeof result.fillPrice === 'number').toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 5: extractedAnyField reflects extraction
  it('Property 5: extractedAnyField reflects extraction', () => {
    fc.assert(
      fc.property(fc.string(), source, (rawContent, src) => {
        const r = parseDiscordAlert(rawContent, src);
        const expected =
          r.actionType !== 'Unclassified' ||
          r.symbol !== null ||
          r.strategy !== null ||
          r.expiration !== null ||
          r.strikes !== null ||
          r.direction !== null ||
          r.fillPrice !== null ||
          r.amount !== null ||
          r.amountKind !== null ||
          r.links.length > 0;
        expect(r.extractedAnyField).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 6: Link extraction is bounded, deduped, and order-preserving
  it('Property 6: Link extraction is bounded, deduped, and order-preserving', () => {
    // A URL arbitrary that produces links matching the parser's /https?:\/\/[^\s<>"')]+/ pattern.
    const url = fc
      .webUrl({ withQueryParameters: true, withFragments: true })
      .filter((u) => /^https?:\/\/[^\s<>"')]+$/.test(u));

    fc.assert(
      fc.property(
        fc.array(url, { maxLength: 120 }),
        source,
        (urls, src) => {
          // Interpolate the URLs into free text separated by whitespace so the
          // parser's link regex picks them up in order.
          const rawContent = urls.map((u) => `see ${u} now`).join('\n');
          const { links } = parseDiscordAlert(rawContent, src);

          // Bounded at 50.
          expect(links.length).toBeLessThanOrEqual(50);

          // No duplicates.
          expect(new Set(links).size).toBe(links.length);

          // First-occurrence order preserved: links must be the first-seen
          // unique URLs (capped at 50) in the exact order they appear.
          const seen = new Set<string>();
          const expected: string[] = [];
          for (const u of urls) {
            if (!seen.has(u)) {
              seen.add(u);
              expected.push(u);
              if (expected.length >= 50) break;
            }
          }
          expect(links).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
