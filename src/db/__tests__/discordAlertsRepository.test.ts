/**
 * Repository tests for `discordAlertsRepository` against a MOCKED Supabase
 * client. The mock mirrors the style used in `userIdOnCreate.property.test.ts`:
 * a chainable object exposing `from`, `insert`, `select().single()`, `eq`,
 * `order`, `update`, `delete`, and `auth.getUser()`.
 *
 * This file holds the fast-check property tests (Properties 11 and 12) for the
 * insert payload and de-duplication behavior. Example-based CRUD/retry unit
 * tests (task 4.8) are added to this same file later, so the mock is written to
 * be reconfigurable per-test via the module-scoped `mockState`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// --- Mock control surface (reconfigured per test/property run) ---

/** Fixed authenticated user id returned by `auth.getUser()`. */
const MOCK_USER_ID = 'user-00000000-0000-4000-8000-000000000000';

interface MockState {
  /** Payloads passed to `.insert(...)`, in call order, per table. */
  capturedInserts: Map<string, Record<string, unknown>[]>;
  /**
   * Optional hook invoked when `.select().single()` resolves after an insert.
   * Receives the captured row and returns the `{ data, error }` the client
   * should resolve with. Defaults to echoing the row with generated
   * id/timestamps and a null error.
   *
   * For `createAlert`, each retry attempt creates a fresh chain (a new
   * `from(...)` call) and pushes its row into `capturedInserts`, so the number
   * of invocations of this hook equals the number of insert attempts — which is
   * exactly what the retry-count assertions check.
   */
  insertResult?: (
    table: string,
    row: Record<string, unknown>,
  ) => { data: Record<string, unknown> | null; error: unknown };
  /**
   * Optional hook resolving a bare `.select('*')...` list query (no `.single()`),
   * per table. Used by list assertions (`listSources`, `listAlertsGrouped`).
   * Defaults to an empty result set.
   */
  selectResult?: (table: string) => { data: Record<string, unknown>[] | null; error: unknown };
  /** Optional hook resolving a `.delete().eq(...)` terminal, per table. */
  deleteResult?: (table: string) => { error: unknown };
  /** Optional hook resolving an `.update(...).eq(...)` terminal, per table. */
  updateResult?: (table: string) => { error: unknown };
}

let mockState: MockState;

function resetMockState(): void {
  mockState = { capturedInserts: new Map() };
}

/** Default insert resolution: echo the row back with server-populated columns. */
function defaultInsertResult(
  _table: string,
  row: Record<string, unknown>,
): { data: Record<string, unknown>; error: null } {
  const now = new Date().toISOString();
  return {
    data: {
      id: (row.message_id as string) ?? 'generated-id',
      created_at: now,
      updated_at: now,
      ...row,
    },
    error: null,
  };
}

vi.mock('../../lib/supabase', () => {
  const createMockChain = (table: string) => {
    const chain: Record<string, any> = {};
    // The most recent insert payload for this chain, used by select().single().
    let lastInsert: Record<string, unknown> | undefined;

    chain.insert = vi.fn((row: Record<string, unknown>) => {
      const list = mockState.capturedInserts.get(table) ?? [];
      list.push(row);
      mockState.capturedInserts.set(table, list);
      lastInsert = row;
      return chain;
    });

    // A `select` builder that is BOTH chainable (`.eq`/`.order`) and awaitable
    // (thenable), and additionally exposes `.single()` for the insert path.
    //
    // - `insert(...).select(...).single()` resolves via `insertResult`
    //   (preserving Properties 11/12 and driving the retry unit tests).
    // - `select(...).order(...)` / `select(...).eq(...).order(...)` awaited
    //   directly resolves via `selectResult` (list queries).
    chain.select = vi.fn((_columns?: string) => {
      const listResolver = () => {
        const resolver =
          mockState.selectResult ?? (() => ({ data: [] as Record<string, unknown>[], error: null }));
        return Promise.resolve(resolver(table));
      };
      const selectBuilder: Record<string, any> = {
        single: vi.fn().mockImplementation(() => {
          const resolver = mockState.insertResult ?? defaultInsertResult;
          return Promise.resolve(resolver(table, lastInsert ?? {}));
        }),
        // Awaiting the builder (a list query) resolves via `selectResult`.
        then: (
          onFulfilled: (value: { data: Record<string, unknown>[] | null; error: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => listResolver().then(onFulfilled, onRejected),
      };
      selectBuilder.eq = vi.fn().mockReturnValue(selectBuilder);
      selectBuilder.order = vi.fn().mockReturnValue(selectBuilder);
      return selectBuilder;
    });

    // A terminal builder for delete/update: chainable via `.eq(...)` and
    // awaitable to a `{ error }` result via the corresponding hook.
    const makeTerminal = (
      resultKey: 'deleteResult' | 'updateResult',
    ): Record<string, any> => {
      const resolve = () => {
        const resolver = mockState[resultKey] ?? (() => ({ error: null }));
        return Promise.resolve(resolver(table));
      };
      const terminal: Record<string, any> = {
        then: (
          onFulfilled: (value: { error: unknown }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => resolve().then(onFulfilled, onRejected),
      };
      terminal.eq = vi.fn().mockReturnValue(terminal);
      return terminal;
    };

    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn(() => makeTerminal('updateResult'));
    chain.delete = vi.fn(() => makeTerminal('deleteResult'));

    return chain;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createMockChain(table)),
      auth: {
        getUser: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { user: { id: MOCK_USER_ID } }, error: null }),
        ),
      },
    },
  };
});

import {
  createAlert,
  createSource,
  deleteAlert,
  deleteSource,
  listAlertsGrouped,
  listSources,
  updateSource,
} from '../discordAlertsRepository';
import type { ParsedTradeAlert } from '../../utils/parsers/discordAlertParser';
import { supabase } from '../../lib/supabase';

/** Handle to the mocked `auth.getUser`, for per-test reconfiguration. */
const mockGetUser = supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>;

/** Restore the default authenticated-user resolution for `auth.getUser()`. */
function setAuthedUser(): void {
  mockGetUser.mockImplementation(() =>
    Promise.resolve({ data: { user: { id: MOCK_USER_ID } }, error: null }),
  );
}

/** Build a minimal `ParsedTradeAlert` for example-based tests. */
function makeParsed(overrides: Partial<ParsedTradeAlert> = {}): ParsedTradeAlert {
  return {
    actionType: 'Open',
    symbol: 'AAPL',
    strategy: 'Iron Condor',
    expiration: '2025-01-17',
    strikes: '150/155',
    direction: 'sell',
    fillPrice: 1.25,
    amount: 125,
    amountKind: 'credit',
    links: [],
    rawContent: 'raw alert text',
    messageId: 'msg-1',
    extractedAnyField: true,
    ...overrides,
  };
}

// --- Arbitraries ---

const arbActionType = fc.constantFrom<ParsedTradeAlert['actionType']>(
  'Open',
  'Adjust',
  'Close',
  'Unclassified',
);
const arbDirection = fc.constantFrom<ParsedTradeAlert['direction']>('buy', 'sell', null);
const arbAmountKind = fc.constantFrom<ParsedTradeAlert['amountKind']>('credit', 'debit', null);

const arbNullableString = fc.option(fc.string({ maxLength: 40 }), { nil: null });
const arbNullableNumber = fc.option(
  fc.double({ min: -100000, max: 100000, noNaN: true, noDefaultInfinity: true }),
  { nil: null },
);

/** Build a `ParsedTradeAlert` arbitrary; `messageId` can be overridden. */
function arbParsedTradeAlert(
  messageId: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 16 }),
): fc.Arbitrary<ParsedTradeAlert> {
  return fc.record<ParsedTradeAlert>({
    actionType: arbActionType,
    symbol: arbNullableString,
    strategy: arbNullableString,
    expiration: arbNullableString,
    strikes: arbNullableString,
    direction: arbDirection,
    fillPrice: arbNullableNumber,
    amount: arbNullableNumber,
    amountKind: arbAmountKind,
    links: fc.array(fc.webUrl(), { maxLength: 5 }),
    rawContent: fc.string({ maxLength: 200 }),
    messageId,
    extractedAnyField: fc.boolean(),
  });
}

// --- Tests ---

describe('discordAlertsRepository.createAlert', () => {
  beforeEach(() => {
    resetMockState();
    vi.clearAllMocks();
  });

  // Feature: discord-trade-alerts, Property 11: Insert payload is well-formed and always carries the source reference
  it('Property 11: insert payload is well-formed and always carries the source reference', async () => {
    await fc.assert(
      fc.asyncProperty(arbParsedTradeAlert(), fc.uuid(), async (parsed, sourceId) => {
        resetMockState();

        const result = await createAlert(parsed, sourceId);
        expect(result.status).toBe('stored');

        const rows = mockState.capturedInserts.get('discord_trade_alerts');
        expect(rows).toBeDefined();
        expect(rows!.length).toBe(1);
        const row = rows![0];

        // All required columns are present as own properties.
        const requiredColumns = [
          'source_id',
          'message_id',
          'raw_content',
          'submission_timestamp',
          'action_type',
          'symbol',
          'strategy',
          'expiration',
          'strikes',
          'direction',
          'fill_price',
          'amount',
          'amount_kind',
          'links',
          'extracted_any_field',
        ];
        for (const col of requiredColumns) {
          expect(Object.prototype.hasOwnProperty.call(row, col)).toBe(true);
        }

        // Source reference and authenticated user are wired through correctly.
        expect(row.source_id).toBe(sourceId);
        expect(row.user_id).toBe(MOCK_USER_ID);

        // The structured fields echo the parsed alert.
        expect(row.message_id).toBe(parsed.messageId);
        expect(row.raw_content).toBe(parsed.rawContent);
        expect(row.action_type).toBe(parsed.actionType);
        expect(row.symbol).toBe(parsed.symbol);
        expect(row.strategy).toBe(parsed.strategy);
        expect(row.expiration).toBe(parsed.expiration);
        expect(row.strikes).toBe(parsed.strikes);
        expect(row.direction).toBe(parsed.direction);
        expect(row.fill_price).toBe(parsed.fillPrice);
        expect(row.amount).toBe(parsed.amount);
        expect(row.amount_kind).toBe(parsed.amountKind);
        expect(row.links).toEqual(parsed.links);
        expect(row.extracted_any_field).toBe(parsed.extractedAnyField);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: discord-trade-alerts, Property 12: De-duplication persists at most one alert per (source, message id)
  it('Property 12: de-duplication persists at most one alert per (source, message id)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // A single source, and a sequence of submissions. Each submission
        // carries a messageId drawn from a tiny pool so collisions are frequent.
        fc.uuid(),
        fc.array(
          fc.record({
            parsed: arbParsedTradeAlert(fc.constantFrom('m1', 'm2', 'm3')),
          }),
          { minLength: 1, maxLength: 30 },
        ),
        async (sourceId, submissions) => {
          resetMockState();

          // Model the DB unique constraint on (user_id, source_id, message_id):
          // the first insert of a key succeeds; any repeat resolves with the
          // Postgres unique-violation error the repository detects.
          const storedKeys = new Set<string>();
          mockState.insertResult = (_table, row) => {
            const key = `${row.user_id}\u0000${row.source_id}\u0000${row.message_id}`;
            if (storedKeys.has(key)) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint',
                },
              };
            }
            storedKeys.add(key);
            return defaultInsertResult(_table, row);
          };

          const seenMessageIds = new Set<string>();
          for (const { parsed } of submissions) {
            const result = await createAlert(parsed, sourceId);
            const first = !seenMessageIds.has(parsed.messageId);
            if (first) {
              expect(result.status).toBe('stored');
              seenMessageIds.add(parsed.messageId);
            } else {
              expect(result.status).toBe('duplicate');
            }
          }

          // Exactly one stored alert per distinct (source, message id) key.
          expect(storedKeys.size).toBe(seenMessageIds.size);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Example-based CRUD + retry unit tests (task 4.8) ---

describe('discordAlertsRepository CRUD (example-based)', () => {
  beforeEach(() => {
    resetMockState();
    vi.clearAllMocks();
    setAuthedUser();
  });

  describe('listSources', () => {
    it('maps a select result to DiscordAlertSource[]', async () => {
      const now = '2025-01-01T00:00:00.000Z';
      mockState.selectResult = () => ({
        data: [
          { id: 's1', community: 'Alpha', chat_room: 'signals', created_at: now, updated_at: now },
          { id: 's2', community: 'Beta', chat_room: 'general', created_at: now, updated_at: now },
        ],
        error: null,
      });

      const sources = await listSources();

      expect(sources).toHaveLength(2);
      expect(sources[0]).toEqual({
        id: 's1',
        community: 'Alpha',
        chatRoom: 'signals',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
      expect(sources[1].chatRoom).toBe('general');
    });

    it('throws "Failed to load sources: ..." on error', async () => {
      mockState.selectResult = () => ({ data: null, error: { message: 'boom' } });
      await expect(listSources()).rejects.toThrow('Failed to load sources: boom');
    });
  });

  describe('createSource', () => {
    it('inserts trimmed values with user_id and returns the mapped source', async () => {
      const now = '2025-02-02T00:00:00.000Z';
      mockState.insertResult = (_table, row) => ({
        data: { id: 'new-src', created_at: now, updated_at: now, ...row },
        error: null,
      });

      const source = await createSource('  Alpha  ', '  signals  ');

      const rows = mockState.capturedInserts.get('discord_alert_sources');
      expect(rows).toHaveLength(1);
      expect(rows![0]).toEqual({
        user_id: MOCK_USER_ID,
        community: 'Alpha',
        chat_room: 'signals',
      });
      expect(source).toEqual({
        id: 'new-src',
        community: 'Alpha',
        chatRoom: 'signals',
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    });

    it('throws "Not authenticated" when there is no user', async () => {
      mockGetUser.mockImplementation(() =>
        Promise.resolve({ data: { user: null }, error: null }),
      );
      await expect(createSource('Alpha', 'signals')).rejects.toThrow('Not authenticated');
    });

    it('throws "Failed to create source: ..." on supabase error', async () => {
      mockState.insertResult = () => ({ data: null, error: { message: 'insert failed' } });
      await expect(createSource('Alpha', 'signals')).rejects.toThrow(
        'Failed to create source: insert failed',
      );
    });
  });

  describe('updateSource', () => {
    it('sends snake_case column updates', async () => {
      let captured: Record<string, unknown> | undefined;
      // Capture the update payload by intercepting `.update(...)` on the source table.
      const fromSpy = supabase.from as unknown as ReturnType<typeof vi.fn>;
      const original = fromSpy.getMockImplementation()!;
      fromSpy.mockImplementation((table: string) => {
        const chain = original(table);
        const realUpdate = chain.update;
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          captured = payload;
          return realUpdate(payload);
        });
        return chain;
      });

      await updateSource('s1', { community: 'NewName', chatRoom: 'new-room' });

      expect(captured).toBeDefined();
      expect(captured!.community).toBe('NewName');
      expect(captured!.chat_room).toBe('new-room');
      expect(captured).toHaveProperty('updated_at');
      expect(captured).not.toHaveProperty('chatRoom');
    });

    it('throws "Failed to update source: ..." on error', async () => {
      mockState.updateResult = () => ({ error: { message: 'nope' } });
      await expect(updateSource('s1', { community: 'X' })).rejects.toThrow(
        'Failed to update source: nope',
      );
    });
  });

  describe('deleteSource', () => {
    it('resolves when delete succeeds', async () => {
      mockState.deleteResult = () => ({ error: null });
      await expect(deleteSource('s1')).resolves.toBeUndefined();
    });

    it('throws "Failed to delete source: ..." on error', async () => {
      mockState.deleteResult = () => ({ error: { message: 'denied' } });
      await expect(deleteSource('s1')).rejects.toThrow('Failed to delete source: denied');
    });
  });

  describe('listAlertsGrouped', () => {
    it('combines sources + alerts into GroupedAlerts[]', async () => {
      const now = '2025-03-03T00:00:00.000Z';
      // Both list queries flow through the same `selectResult` hook; branch on table.
      mockState.selectResult = (table) => {
        if (table === 'discord_alert_sources') {
          return {
            data: [
              { id: 's1', community: 'Alpha', chat_room: 'signals', created_at: now, updated_at: now },
              { id: 's2', community: 'Beta', chat_room: 'general', created_at: now, updated_at: now },
            ],
            error: null,
          };
        }
        // discord_trade_alerts
        return {
          data: [
            {
              id: 'a1',
              source_id: 's1',
              message_id: 'm1',
              raw_content: 'r1',
              submission_timestamp: now,
              action_type: 'Open',
              symbol: 'AAPL',
              strategy: null,
              expiration: null,
              strikes: null,
              direction: null,
              fill_price: null,
              amount: null,
              amount_kind: null,
              links: [],
              extracted_any_field: true,
              created_at: now,
              updated_at: now,
            },
          ],
          error: null,
        };
      };

      const grouped = await listAlertsGrouped();

      expect(grouped).toHaveLength(2);
      expect(grouped[0].source.id).toBe('s1');
      expect(grouped[0].alerts).toHaveLength(1);
      expect(grouped[0].alerts[0].id).toBe('a1');
      // s2 has no alerts.
      expect(grouped[1].source.id).toBe('s2');
      expect(grouped[1].alerts).toHaveLength(0);
    });
  });

  describe('deleteAlert', () => {
    it('resolves when delete succeeds', async () => {
      mockState.deleteResult = () => ({ error: null });
      await expect(deleteAlert('a1')).resolves.toBeUndefined();
    });

    it('throws "Failed to delete alert: ..." on error', async () => {
      mockState.deleteResult = () => ({ error: { message: 'gone wrong' } });
      await expect(deleteAlert('a1')).rejects.toThrow('Failed to delete alert: gone wrong');
    });
  });
});

describe('discordAlertsRepository.createAlert retry behavior (Requirement 6.2)', () => {
  beforeEach(() => {
    resetMockState();
    vi.clearAllMocks();
    setAuthedUser();
  });

  /** Count insert attempts on the alerts table (one captured row per attempt). */
  function alertInsertAttempts(): number {
    return mockState.capturedInserts.get('discord_trade_alerts')?.length ?? 0;
  }

  it('retries a transient error twice then succeeds on the third attempt', async () => {
    let attempt = 0;
    const now = '2025-04-04T00:00:00.000Z';
    mockState.insertResult = (_table, row) => {
      attempt += 1;
      if (attempt <= 2) {
        return { data: null, error: { code: '08006', message: 'connection error' } };
      }
      return { data: { id: 'ok', created_at: now, updated_at: now, ...row }, error: null };
    };

    const result = await createAlert(makeParsed(), 'src-1');

    expect(result.status).toBe('stored');
    expect(alertInsertAttempts()).toBe(3);
  });

  it('throws after 3 attempts when the transient error always occurs', async () => {
    mockState.insertResult = () => ({
      data: null,
      error: { code: '08006', message: 'connection error' },
    });

    await expect(createAlert(makeParsed(), 'src-1')).rejects.toThrow(/Failed to save alert/);
    expect(alertInsertAttempts()).toBe(3);
  });

  it('does not retry a unique violation and reports a duplicate after one attempt', async () => {
    mockState.insertResult = () => ({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const result = await createAlert(makeParsed(), 'src-1');

    expect(result.status).toBe('duplicate');
    expect(alertInsertAttempts()).toBe(1);
  });
});
