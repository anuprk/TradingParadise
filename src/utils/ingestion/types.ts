/**
 * Ingestion source abstraction for Discord trade alerts.
 *
 * Defines the swappable seam between however an alert is submitted (manual
 * paste today; inbound webhook and a future server-admin Discord bot later)
 * and the rest of the feature. Every source normalizes its input into one or
 * more {@link RawSubmission} objects, so the parser, store, repository, and
 * database schema never learn which source produced a given alert.
 *
 * This module contains only type declarations — no runtime logic.
 */

export interface RawSubmission {
  rawContent: string;
  community: string;
  chatRoom: string;
  /** Optional source-provided id (webhook/bot). Manual paste omits this and lets the parser derive one. */
  externalMessageId?: string;
}

export interface AlertIngestionSource {
  readonly kind: 'manual-paste' | 'webhook' | 'discord-bot';
  /** Produce raw submissions. Manual paste yields exactly one per call. */
  toRawSubmissions(input: unknown, source: { community: string; chatRoom: string }): RawSubmission[];
}
