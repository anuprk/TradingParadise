/**
 * Discord trade-alert repository.
 *
 * Follows `holdingsRepository.ts` conventions: exported camelCase row
 * interfaces, `fromRow` mappers translating snake_case Supabase columns to
 * camelCase, and (later) CRUD/query functions over the shared `supabase`
 * client. Backed by the `discord_alert_sources` and `discord_trade_alerts`
 * tables (see migration `012_discord_trade_alerts.sql`).
 *
 * This slice contains only the row interfaces and the two `fromRow` mappers.
 * The CRUD/query/createAlert functions are added in later tasks (4.4-4.6),
 * which reintroduce the `supabase` import.
 */

import { supabase } from '../lib/supabase';
import type { ParsedTradeAlert } from '../utils/parsers/discordAlertParser';
import { groupBySource, sortAlerts } from './discordAlertsHelpers';

export interface DiscordAlertSource {
  id: string;
  community: string;
  chatRoom: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordTradeAlert {
  id: string;
  sourceId: string;
  messageId: string;
  rawContent: string;
  submissionTimestamp: Date;
  actionType: ParsedTradeAlert['actionType'];
  symbol: string | null;
  strategy: string | null;
  expiration: string | null;
  strikes: string | null;
  direction: ParsedTradeAlert['direction'];
  fillPrice: number | null;
  amount: number | null;
  amountKind: ParsedTradeAlert['amountKind'];
  links: string[];
  extractedAnyField: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Grouped shape for the viewer (Requirement 6.5 / 7.1). */
export interface GroupedAlerts {
  source: DiscordAlertSource;
  alerts: DiscordTradeAlert[];
}

/** Map a `discord_alert_sources` row (snake_case) to {@link DiscordAlertSource}. */
export function fromSourceRow(row: Record<string, unknown>): DiscordAlertSource {
  return {
    id: row.id as string,
    community: row.community as string,
    chatRoom: row.chat_room as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * Coerce a JSONB `links` column into a `string[]`.
 *
 * The column is JSONB so the client may hand back an already-parsed array, but
 * we defend against non-array shapes by returning an empty array and drop any
 * non-string entries.
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

/** Map a `discord_trade_alerts` row (snake_case) to {@link DiscordTradeAlert}. */
export function fromAlertRow(row: Record<string, unknown>): DiscordTradeAlert {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    messageId: row.message_id as string,
    rawContent: row.raw_content as string,
    submissionTimestamp: new Date(row.submission_timestamp as string),
    actionType: row.action_type as ParsedTradeAlert['actionType'],
    symbol: row.symbol != null ? (row.symbol as string) : null,
    strategy: row.strategy != null ? (row.strategy as string) : null,
    expiration: row.expiration != null ? (row.expiration as string) : null,
    strikes: row.strikes != null ? (row.strikes as string) : null,
    direction: row.direction != null ? (row.direction as ParsedTradeAlert['direction']) : null,
    fillPrice: row.fill_price != null ? Number(row.fill_price) : null,
    amount: row.amount != null ? Number(row.amount) : null,
    amountKind: row.amount_kind != null ? (row.amount_kind as ParsedTradeAlert['amountKind']) : null,
    links: toStringArray(row.links),
    extractedAnyField: Boolean(row.extracted_any_field),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

/**
 * List all configured alert sources, ordered by community then chat room.
 */
export async function listSources(): Promise<DiscordAlertSource[]> {
  const { data, error } = await supabase
    .from('discord_alert_sources')
    .select('*')
    .order('community')
    .order('chat_room');

  if (error) throw new Error(`Failed to load sources: ${error.message}`);
  return (data ?? []).map(fromSourceRow);
}

/**
 * Create a new alert source (community + chat room) for the current user.
 */
export async function createSource(community: string, chatRoom: string): Promise<DiscordAlertSource> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('discord_alert_sources')
    .insert({
      user_id: userId,
      community: community.trim(),
      chat_room: chatRoom.trim(),
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create source: ${error.message}`);
  return fromSourceRow(data);
}

/**
 * Update a source's community and/or chat room.
 */
export async function updateSource(
  id: string,
  changes: Partial<Pick<DiscordAlertSource, 'community' | 'chatRoom'>>,
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.community !== undefined) update.community = changes.community;
  if (changes.chatRoom !== undefined) update.chat_room = changes.chatRoom;

  const { error } = await supabase
    .from('discord_alert_sources')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(`Failed to update source: ${error.message}`);
}

/**
 * Delete a source. The DB cascade removes the source's alerts (Requirement 2.7).
 */
export async function deleteSource(id: string): Promise<void> {
  const { error } = await supabase
    .from('discord_alert_sources')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete source: ${error.message}`);
}

/**
 * List all alerts for a single source, most recent first.
 *
 * Orders by `submission_timestamp` descending with `id` ascending as the
 * deterministic secondary key. The in-memory {@link sortAlerts} pass mirrors the
 * DB order-by to guarantee stable ordering regardless of the client's result
 * shape (Requirements 7.1, 7.2, 7.3).
 */
export async function listAlertsBySource(sourceId: string): Promise<DiscordTradeAlert[]> {
  const { data, error } = await supabase
    .from('discord_trade_alerts')
    .select('*')
    .eq('source_id', sourceId)
    .order('submission_timestamp', { ascending: false })
    .order('id', { ascending: true });

  if (error) throw new Error(`Failed to load alerts: ${error.message}`);
  return sortAlerts((data ?? []).map(fromAlertRow));
}

/**
 * Load every source and its alerts, grouped for the viewer (Requirements 6.5,
 * 7.1). Reuses {@link listSources} for the source list and delegates grouping
 * and ordering to the pure {@link groupBySource} helper.
 */
export async function listAlertsGrouped(): Promise<GroupedAlerts[]> {
  const sources = await listSources();

  const { data, error } = await supabase
    .from('discord_trade_alerts')
    .select('*');

  if (error) throw new Error(`Failed to load alerts: ${error.message}`);
  const alerts = (data ?? []).map(fromAlertRow);

  return groupBySource(alerts, sources);
}
/**
 * Detect a Postgres unique-violation. Supabase/PostgREST surfaces the SQLSTATE
 * `23505` on the error object; some transports only expose it in the message,
 * so we check both the code and the canonical message fragments.
 */
function isUniqueViolation(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === '23505') return true;
  const message = typeof e.message === 'string' ? e.message : '';
  return (
    message.includes('duplicate key value') ||
    message.includes('violates unique constraint')
  );
}

/**
 * Run `op` up to `attempts` times (Requirement 6.2). A unique-violation is a
 * deterministic duplicate, so it is rethrown immediately rather than retried;
 * any other error is retained and retried until attempts are exhausted, then
 * thrown.
 */
async function withRetry<T>(op: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (isUniqueViolation(err)) throw err; // duplicates are not retried
    }
  }
  throw lastErr;
}

/**
 * Persist a reviewed alert for the current user (Requirements 2.4, 6.1, 6.3).
 *
 * Maps the (possibly user-edited) {@link ParsedTradeAlert} to a row and inserts
 * it through {@link withRetry} (up to 3 attempts, Requirement 6.2). A
 * unique-violation on `(user_id, source_id, message_id)` is treated as a
 * de-duplication hit (Requirements 3.4, 6.3) and reported as
 * `{ status: 'duplicate' }` rather than thrown. Any other failure after retries
 * throws a `Failed to save alert` error.
 */
export async function createAlert(
  parsed: ParsedTradeAlert,
  sourceId: string,
): Promise<{ status: 'stored'; alert: DiscordTradeAlert } | { status: 'duplicate' }> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const row = {
    user_id: userId,
    source_id: sourceId,
    message_id: parsed.messageId,
    raw_content: parsed.rawContent,
    submission_timestamp: new Date().toISOString(),
    action_type: parsed.actionType,
    symbol: parsed.symbol,
    strategy: parsed.strategy,
    expiration: parsed.expiration,
    strikes: parsed.strikes,
    direction: parsed.direction,
    fill_price: parsed.fillPrice,
    amount: parsed.amount,
    amount_kind: parsed.amountKind,
    links: parsed.links,
    extracted_any_field: parsed.extractedAnyField,
  };

  try {
    const data = await withRetry(async () => {
      const { data, error } = await supabase
        .from('discord_trade_alerts')
        .insert(row)
        .select('*')
        .single();

      if (error) throw error;
      return data;
    });

    return { status: 'stored', alert: fromAlertRow(data) };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: 'duplicate' };
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('Failed to save alert: ' + message);
  }
}

/**
 * Delete an alert by id. Cross-user deletes are prevented by RLS — a mismatched
 * row simply matches nothing, so no special handling is needed (Requirement 6.7).
 */
export async function deleteAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from('discord_trade_alerts')
    .delete()
    .eq('id', id);

  if (error) throw new Error('Failed to delete alert: ' + error.message);
}
