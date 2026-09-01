/**
 * Unit tests for the Discord alerts store submission flow (task 6.5).
 *
 * Exercises the parse-then-review actions `submitAlert` and `confirmSaveAlert`
 * on `useDiscordAlertsStore`. The repository module is mocked so no real
 * Supabase calls happen, and `../appStore` is mocked so error toasts can be
 * asserted. The REAL parser is used (not mocked) so `submitAlert` produces a
 * genuine `ParsedTradeAlert` from example alert text.
 *
 * Covers Requirements 3.3, 3.5, 4.4, 4.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParsedTradeAlert } from '../../utils/parsers/discordAlertParser';
import { DISCORD_ALERT_EXAMPLES } from '../../utils/parsers/__fixtures__/discordAlertExamples';

// Mock the repository so no real Supabase calls happen. Individual tests set
// per-test implementations for createAlert / listAlertsGrouped as needed.
vi.mock('../../db/discordAlertsRepository', () => ({
  listSources: vi.fn().mockResolvedValue([]),
  listAlertsGrouped: vi.fn().mockResolvedValue([]),
  createAlert: vi.fn(),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  deleteAlert: vi.fn(),
}));

// Mock the app store so useAppStore.getState().addToast is a spy.
const addToast = vi.fn();
vi.mock('../appStore', () => ({
  useAppStore: {
    getState: () => ({ addToast }),
  },
}));

import { useDiscordAlertsStore } from '../discordAlertsStore';
import * as repo from '../../db/discordAlertsRepository';

const mockRepo = vi.mocked(repo);

// The NVDA "NEW OPEN TRADE" example is index 1 in the fixtures.
const NVDA_EXAMPLE = DISCORD_ALERT_EXAMPLES[1];

const SOURCE = {
  id: 'source-1',
  community: NVDA_EXAMPLE.community,
  chatRoom: NVDA_EXAMPLE.chatRoom,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

/** Reset store state and mocks to a known baseline before each test. */
beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.listAlertsGrouped.mockResolvedValue([]);
  useDiscordAlertsStore.setState({
    sources: [SOURCE],
    grouped: [],
    currentSourceId: SOURCE.id,
    pendingReview: null,
    isLoading: false,
    loadError: false,
  });
});

describe('submitAlert', () => {
  it("returns { status: 'invalid' } when no source is selected", () => {
    useDiscordAlertsStore.setState({ currentSourceId: null });

    const outcome = useDiscordAlertsStore.getState().submitAlert('some text');

    expect(outcome.status).toBe('invalid');
    expect(useDiscordAlertsStore.getState().pendingReview).toBeNull();
  });

  it("returns { status: 'invalid' } for empty text and does not set pendingReview", () => {
    const outcome = useDiscordAlertsStore.getState().submitAlert('');

    expect(outcome.status).toBe('invalid');
    expect(useDiscordAlertsStore.getState().pendingReview).toBeNull();
  });

  it("returns { status: 'invalid' } for whitespace-only text and does not set pendingReview", () => {
    const outcome = useDiscordAlertsStore.getState().submitAlert('   \n\t  ');

    expect(outcome.status).toBe('invalid');
    expect(useDiscordAlertsStore.getState().pendingReview).toBeNull();
  });

  it("returns { status: 'review' } and sets a parsed pendingReview for a real Open alert", () => {
    const outcome = useDiscordAlertsStore
      .getState()
      .submitAlert(NVDA_EXAMPLE.rawContent);

    expect(outcome.status).toBe('review');

    const pending = useDiscordAlertsStore.getState().pendingReview;
    expect(pending).not.toBeNull();
    expect(pending?.actionType).toBe('Open');
    expect(pending?.symbol).toBe('NVDA');
    // The real parser preserves raw content exactly.
    expect(pending?.rawContent).toBe(NVDA_EXAMPLE.rawContent);
  });
});

describe('confirmSaveAlert', () => {
  /** Build a minimal ParsedTradeAlert for confirmSaveAlert tests. */
  function makeParsed(overrides: Partial<ParsedTradeAlert> = {}): ParsedTradeAlert {
    return {
      actionType: 'Open',
      symbol: 'NVDA',
      strategy: null,
      expiration: null,
      strikes: null,
      direction: null,
      fillPrice: null,
      amount: null,
      amountKind: null,
      links: [],
      rawContent: 'raw',
      messageId: 'msg-abc',
      extractedAnyField: true,
      ...overrides,
    };
  }

  it("returns { status: 'not-open' } and does not call repo.createAlert for a non-Open alert", async () => {
    const edited = makeParsed({ actionType: 'Close' });

    const outcome = await useDiscordAlertsStore.getState().confirmSaveAlert(edited);

    expect(outcome.status).toBe('not-open');
    expect(mockRepo.createAlert).not.toHaveBeenCalled();
  });

  it("calls repo.createAlert and returns { status: 'stored' } on stored, refreshing grouped", async () => {
    const edited = makeParsed({ actionType: 'Open' });
    const groupedAfter = [{ source: SOURCE, alerts: [] }];
    mockRepo.createAlert.mockResolvedValue({
      status: 'stored',
      alert: {
        id: 'alert-1',
        sourceId: SOURCE.id,
        messageId: edited.messageId,
        rawContent: edited.rawContent,
        submissionTimestamp: new Date(),
        actionType: 'Open',
        symbol: edited.symbol,
        strategy: null,
        expiration: null,
        strikes: null,
        direction: null,
        fillPrice: null,
        amount: null,
        amountKind: null,
        links: [],
        extractedAnyField: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    mockRepo.listAlertsGrouped.mockResolvedValue(groupedAfter);

    const outcome = await useDiscordAlertsStore.getState().confirmSaveAlert(edited);

    expect(outcome.status).toBe('stored');
    expect(mockRepo.createAlert).toHaveBeenCalledWith(edited, SOURCE.id);
    expect(mockRepo.listAlertsGrouped).toHaveBeenCalled();
    // On store, grouped is refreshed and pendingReview cleared.
    expect(useDiscordAlertsStore.getState().grouped).toEqual(groupedAfter);
    expect(useDiscordAlertsStore.getState().pendingReview).toBeNull();
  });

  it("returns { status: 'duplicate' } when repo.createAlert reports a duplicate", async () => {
    const edited = makeParsed({ actionType: 'Open' });
    mockRepo.createAlert.mockResolvedValue({ status: 'duplicate' });

    const outcome = await useDiscordAlertsStore.getState().confirmSaveAlert(edited);

    expect(outcome.status).toBe('duplicate');
    expect(mockRepo.createAlert).toHaveBeenCalledWith(edited, SOURCE.id);
  });
});

describe('parse-then-review preserves edited fields while messageId stays fixed', () => {
  it('persists the edited structured field and the unchanged messageId', async () => {
    // Submit a real alert to obtain a genuine pendingReview + messageId.
    const submitOutcome = useDiscordAlertsStore
      .getState()
      .submitAlert(NVDA_EXAMPLE.rawContent);
    expect(submitOutcome.status).toBe('review');

    const pending = useDiscordAlertsStore.getState().pendingReview;
    expect(pending).not.toBeNull();
    const originalMessageId = pending!.messageId;

    mockRepo.createAlert.mockResolvedValue({
      status: 'stored',
      alert: {
        id: 'alert-1',
        sourceId: SOURCE.id,
        messageId: originalMessageId,
        rawContent: pending!.rawContent,
        submissionTimestamp: new Date(),
        actionType: 'Open',
        symbol: 'AMD',
        strategy: pending!.strategy,
        expiration: pending!.expiration,
        strikes: pending!.strikes,
        direction: pending!.direction,
        fillPrice: pending!.fillPrice,
        amount: pending!.amount,
        amountKind: pending!.amountKind,
        links: pending!.links,
        extractedAnyField: pending!.extractedAnyField,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Edit a structured field (symbol) but keep the same messageId.
    const edited: ParsedTradeAlert = { ...pending!, symbol: 'AMD' };
    const outcome = await useDiscordAlertsStore.getState().confirmSaveAlert(edited);

    expect(outcome.status).toBe('stored');
    expect(mockRepo.createAlert).toHaveBeenCalledTimes(1);

    // Inspect the row passed to repo.createAlert: it reflects the edited field
    // and carries the same, unchanged messageId.
    const [passedRow, passedSourceId] = mockRepo.createAlert.mock.calls[0];
    expect(passedRow.symbol).toBe('AMD');
    expect(passedRow.messageId).toBe(originalMessageId);
    expect(passedSourceId).toBe(SOURCE.id);
  });
});
