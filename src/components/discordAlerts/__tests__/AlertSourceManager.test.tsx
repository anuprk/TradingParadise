import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the repository so no network runs. The real store calls these on
// create/update/delete and then refreshes via listSources / listAlertsGrouped.
vi.mock('../../../db/discordAlertsRepository', () => ({
  listSources: vi.fn(async () => []),
  listAlertsGrouped: vi.fn(async () => []),
  createSource: vi.fn(async () => ({})),
  updateSource: vi.fn(async () => undefined),
  deleteSource: vi.fn(async () => undefined),
  createAlert: vi.fn(async () => ({ status: 'stored' })),
  deleteAlert: vi.fn(async () => undefined),
}));

// Mock appStore so error toasts don't require the real slice.
vi.mock('../../../stores/appStore', () => ({
  useAppStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

import AlertSourceManager from '../AlertSourceManager';
import { useDiscordAlertsStore } from '../../../stores/discordAlertsStore';
import * as repo from '../../../db/discordAlertsRepository';
import type {
  DiscordAlertSource,
  DiscordTradeAlert,
  GroupedAlerts,
} from '../../../db/discordAlertsRepository';

function makeSource(overrides: Partial<DiscordAlertSource> = {}): DiscordAlertSource {
  return {
    id: 'src-1',
    community: "Mak's Money Maker Club",
    chatRoom: 'elite-trade-alerts',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// Minimal alert stand-in for `grouped` — only the count is exercised by the UI.
function makeAlert(id: string): DiscordTradeAlert {
  return { id } as DiscordTradeAlert;
}

/** Seed the real store deterministically for each test. */
function seedStore(sources: DiscordAlertSource[], grouped: GroupedAlerts[] = []) {
  useDiscordAlertsStore.setState({
    sources,
    grouped,
    currentSourceId: null,
    pendingReview: null,
    isLoading: false,
    loadError: false,
  });
}

describe('AlertSourceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedStore([]);
  });

  describe('duplicate validation (Requirement 2.5)', () => {
    it('rejects a case/whitespace variant of an existing source and does not create', async () => {
      const user = userEvent.setup();
      const existing = makeSource();
      seedStore([existing]);

      render(<AlertSourceManager />);

      await user.click(screen.getByTestId('add-source-button'));
      const form = await screen.findByTestId('source-form');

      // Same names as `existing`, but with different case and surrounding
      // whitespace — must be detected as a duplicate.
      const community = within(form).getByTestId('community-input');
      const chatRoom = within(form).getByTestId('chat-room-input');
      await user.type(community, "  MAK'S money maker club  ");
      await user.type(chatRoom, '  ELITE-Trade-Alerts  ');

      await user.click(screen.getByTestId('save-source-button'));

      // A duplicate validation message appears...
      expect(
        await screen.findByText('That community and chat room already exists'),
      ).toBeInTheDocument();

      // ...and the create action was NOT performed.
      expect(repo.createSource).not.toHaveBeenCalled();
      // Form remains open (not closed on failed submit).
      expect(screen.getByTestId('source-form')).toBeInTheDocument();
    });
  });

  describe('length validation (Requirement 2.3)', () => {
    it('rejects empty community and chat room and does not create', async () => {
      const user = userEvent.setup();
      seedStore([]);

      render(<AlertSourceManager />);

      await user.click(screen.getByTestId('add-source-button'));
      await screen.findByTestId('source-form');

      // Submit with both fields empty.
      await user.click(screen.getByTestId('save-source-button'));

      expect(
        await screen.findByText('Community must be 1-100 characters'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Chat room must be 1-100 characters'),
      ).toBeInTheDocument();

      expect(repo.createSource).not.toHaveBeenCalled();
    });
  });

  describe('delete confirmation with associated alert count (Requirement 2.7)', () => {
    it('shows the associated alert count and only deletes after confirm', async () => {
      const user = userEvent.setup();
      const source = makeSource({ id: 'src-42' });
      // Seed 3 associated alerts for this source.
      const grouped: GroupedAlerts[] = [
        {
          source,
          alerts: [makeAlert('a1'), makeAlert('a2'), makeAlert('a3')],
        },
      ];
      seedStore([source], grouped);

      render(<AlertSourceManager />);

      // Open the delete confirmation for the seeded source.
      await user.click(screen.getByTestId('delete-source-src-42'));

      const confirm = await screen.findByTestId('delete-confirm');
      const count = within(confirm).getByTestId('delete-count');
      expect(count).toHaveTextContent('3');

      // Delete has NOT happened yet — source is retained until confirm.
      expect(repo.deleteSource).not.toHaveBeenCalled();
      expect(screen.getByTestId('source-item-src-42')).toBeInTheDocument();

      // Confirm the deletion.
      await user.click(screen.getByTestId('confirm-delete-button'));

      await waitFor(() => {
        expect(repo.deleteSource).toHaveBeenCalledWith('src-42');
      });
    });
  });
});
