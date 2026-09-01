/**
 * Manual-paste ingestion source for Discord trade alerts.
 *
 * The only {@link AlertIngestionSource} implementation in the initial build.
 * It turns a single pasted string plus the selected community/chat room into
 * exactly one {@link RawSubmission}, capping the captured raw content at the
 * first 10,000 characters (Requirement 3.1). Manual paste does not supply an
 * externalMessageId — the parser derives a stable id from the content and
 * source instead.
 */

import type { AlertIngestionSource, RawSubmission } from './types';

/** Maximum number of raw-content characters captured per submission (Requirement 3.1). */
const MAX_RAW_CONTENT_LENGTH = 10000;

/**
 * Return the first {@link MAX_RAW_CONTENT_LENGTH} characters of the input.
 *
 * Pure helper reused by the store and the property test. When the input is
 * {@link MAX_RAW_CONTENT_LENGTH} characters or shorter it is returned unchanged.
 */
export function capRawContent(input: string): string {
  return input.slice(0, MAX_RAW_CONTENT_LENGTH);
}

export class ManualPasteSource implements AlertIngestionSource {
  readonly kind = 'manual-paste' as const;

  /**
   * Produce exactly one {@link RawSubmission} from a pasted string.
   *
   * @param input - The pasted alert text. Non-string input is treated as an
   *   empty string.
   * @param source - The selected community and chat room the paste belongs to.
   * @returns A single-element array. `externalMessageId` is intentionally
   *   omitted so the parser derives the message id.
   */
  toRawSubmissions(
    input: unknown,
    source: { community: string; chatRoom: string },
  ): RawSubmission[] {
    const text = typeof input === 'string' ? input : '';
    const rawContent = capRawContent(text);
    return [
      {
        rawContent,
        community: source.community,
        chatRoom: source.chatRoom,
      },
    ];
  }
}
