/**
 * Component tests for AlertSubmissionForm (task 8.4).
 *
 * These tests exercise the parse-then-review submission flow through the REAL
 * `useDiscordAlertsStore` (seeded via `setState`) and the REAL parser used by
 * `submitAlert`. Only the repository (`../../../db/discordAlertsRepository`)
 * and the app store (`../../../stores/appStore`) are mocked so no network or
 * toast side-effects run.
 *
 * Covers Requirements 3.3, 3.5, 4.5.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DISCORD_ALERT_EXAMPLES } from '../../../utils/parsers/__fixtures__/discordAlertExamples';

// Mock the repository so no real Supabase calls happen. Individual tests set
// per-test implementations for createAlert / listAlertsGrouped as needed.
vi.mock('../../../db/discordAlertsRepository', () => ({
  listSources: vi.fn().mockResolvedValue([]),
  listAlertsGrouped: vi.fn().mockResolvedValue([]),
  createAlert: vi.fn(),
  createSource: vi.fn(),
  updateSource: vi.fn(),
  deleteSource: vi.fn(),
  deleteAlert: vi.fn(),
}));

// Mock the app store so useAppStore.getState().addToast is a no-op spy.
const addToast = vi.fn();
vi.mock('../../../stores/appStore', () => ({
  useAppStore: {
    getState: () => ({ addToast }),
  },
}));

import AlertSubmissionForm from '../AlertSubmissionForm';
import { useDiscordAlertsStore } from '../../../stores/discordAlertsStore';
import * as repo from '../../../db/discordAlertsRepository';

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

describe('AlertSubmissionForm', () => {
  it('shows the invalid outcome and no review form on empty submission', async () => {
    const user = userEvent.setup();
    render(<AlertSubmissionForm />);

    // Source is selected, so no source hint is shown and submit is enabled.
    expect(screen.queryByTestId('alert-source-hint')).not.toBeInTheDocument();

    // Submit with an empty paste box.
    await user.click(screen.getByTestId('alert-submit'));

    const outcome = screen.getByTestId('alert-outcome');
    expect(outcome).toBeInTheDocument();
    expect(outcome).toHaveTextContent(/empty/i);

    // No review form should appear for an invalid submission.
    expect(screen.queryByTestId('alert-review')).not.toBeInTheDocument();
  });

  it('renders the review form with parsed fields for the NVDA Open alert', async () => {
    const user = userEvent.setup();
    render(<AlertSubmissionForm />);

    await user.type(
      screen.getByTestId('alert-paste-box'),
      NVDA_EXAMPLE.rawContent,
    );
    await user.click(screen.getByTestId('alert-submit'));

    // Review form appears with the parsed symbol pre-filled and Open action.
    const review = await screen.findByTestId('alert-review');
    expect(review).toBeInTheDocument();

    const symbolField = screen.getByTestId('alert-field-symbol') as HTMLInputElement;
    expect(symbolField.value).toBe('NVDA');

    const actionTypeField = screen.getByTestId(
      'alert-field-actionType',
    ) as HTMLSelectElement;
    expect(actionTypeField.value).toBe('Open');
  });

  it('persists edited values on confirm and shows the saved outcome', async () => {
    const user = userEvent.setup();

    mockRepo.createAlert.mockResolvedValue({
      status: 'stored',
      alert: {
        id: 'alert-1',
        sourceId: SOURCE.id,
        messageId: 'msg-abc',
        rawContent: NVDA_EXAMPLE.rawContent,
        submissionTimestamp: new Date(),
        actionType: 'Open',
        symbol: 'AMD',
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
    mockRepo.listAlertsGrouped.mockResolvedValue([]);

    render(<AlertSubmissionForm />);

    await user.type(
      screen.getByTestId('alert-paste-box'),
      NVDA_EXAMPLE.rawContent,
    );
    await user.click(screen.getByTestId('alert-submit'));

    await screen.findByTestId('alert-review');

    // Edit the symbol field before confirming.
    const symbolField = screen.getByTestId('alert-field-symbol');
    await user.clear(symbolField);
    await user.type(symbolField, 'AMD');

    await user.click(screen.getByTestId('alert-confirm'));

    // The repository was called and the outcome reports success.
    await waitFor(() => {
      expect(mockRepo.createAlert).toHaveBeenCalledTimes(1);
    });

    // The edited symbol is reflected in the createAlert call args.
    const [passedRow, passedSourceId] = mockRepo.createAlert.mock.calls[0];
    expect(passedRow.symbol).toBe('AMD');
    expect(passedSourceId).toBe(SOURCE.id);

    const outcome = await screen.findByTestId('alert-outcome');
    expect(outcome).toHaveTextContent(/saved/i);
  });

  it('shows the not-open outcome and does not persist when action type is Close', async () => {
    const user = userEvent.setup();
    render(<AlertSubmissionForm />);

    await user.type(
      screen.getByTestId('alert-paste-box'),
      NVDA_EXAMPLE.rawContent,
    );
    await user.click(screen.getByTestId('alert-submit'));

    await screen.findByTestId('alert-review');

    // Change the action type to Close, then confirm.
    await user.selectOptions(screen.getByTestId('alert-field-actionType'), 'Close');
    await user.click(screen.getByTestId('alert-confirm'));

    const outcome = await screen.findByTestId('alert-outcome');
    expect(outcome).toHaveTextContent(/only open/i);

    expect(mockRepo.createAlert).not.toHaveBeenCalled();
  });
});
