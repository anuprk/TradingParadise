/**
 * Component tests for DiscordAlertsPage — the Discord Alerts section container.
 *
 * Uses the REAL `useDiscordAlertsStore`; mocks the repository so no network
 * runs, mocks `appStore` so toasts don't touch other state, and stubs the three
 * child components (AlertSourceManager, AlertSubmissionForm, AlertViewer) to
 * keep the test focused on the page container: heading, source selector,
 * load-failure error indication, and source selection updating the store.
 *
 * Requirements: 1.1, 1.3, 1.5
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DiscordAlertsPage from '../DiscordAlertsPage';
import { useDiscordAlertsStore } from '../../stores/discordAlertsStore';
import type { DiscordAlertSource } from '../../db/discordAlertsRepository';

// --- Repository mock: keep the page's mount-time loaders from throwing. ---
const mockListSources = vi.fn().mockResolvedValue([]);
const mockListAlertsGrouped = vi.fn().mockResolvedValue([]);

vi.mock('../../db/discordAlertsRepository', () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
  listAlertsGrouped: (...args: unknown[]) => mockListAlertsGrouped(...args),
  createSource: vi.fn().mockResolvedValue(undefined),
  updateSource: vi.fn().mockResolvedValue(undefined),
  deleteSource: vi.fn().mockResolvedValue(undefined),
  listAlertsBySource: vi.fn().mockResolvedValue([]),
  createAlert: vi.fn().mockResolvedValue({ status: 'stored' }),
  deleteAlert: vi.fn().mockResolvedValue(undefined),
}));

// --- appStore mock: silence toasts. ---
vi.mock('../../stores/appStore', () => ({
  useAppStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

// --- Child component stubs: focus this test on the page container. ---
vi.mock('../../components/discordAlerts/AlertSourceManager', () => ({
  default: () => <div data-testid="stub-source-manager" />,
}));
vi.mock('../../components/discordAlerts/AlertSubmissionForm', () => ({
  default: () => <div data-testid="stub-submission-form" />,
}));
vi.mock('../../components/discordAlerts/AlertViewer', () => ({
  default: () => <div data-testid="stub-viewer" />,
}));

function buildSource(overrides: Partial<DiscordAlertSource> = {}): DiscordAlertSource {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'source-1',
    community: "Mak's Money Maker Club",
    chatRoom: 'elite-trade-alerts',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListSources.mockResolvedValue([]);
  mockListAlertsGrouped.mockResolvedValue([]);
  // Reset the real store to a clean slice for each test.
  useDiscordAlertsStore.setState({
    sources: [],
    grouped: [],
    currentSourceId: null,
    pendingReview: null,
    isLoading: false,
    loadError: false,
  });
});

describe('DiscordAlertsPage', () => {
  it('renders the page container, heading, and source selector', async () => {
    render(<DiscordAlertsPage />);

    // Let the mount-time loaders settle.
    await waitFor(() => expect(mockListSources).toHaveBeenCalled());

    expect(screen.getByTestId('discord-alerts-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discord Alerts' })).toBeInTheDocument();
    expect(screen.getByTestId('source-selector')).toBeInTheDocument();
  });

  it('lists seeded sources as options labeled "community / chatRoom"', async () => {
    const sourceA = buildSource({ id: 's-a', community: 'Alpha', chatRoom: 'room-a' });
    const sourceB = buildSource({ id: 's-b', community: 'Beta', chatRoom: 'room-b' });
    // Seed via the repo so the page's mount-time loadSources() populates them.
    mockListSources.mockResolvedValue([sourceA, sourceB]);

    render(<DiscordAlertsPage />);

    expect(await screen.findByRole('option', { name: 'Alpha / room-a' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta / room-b' })).toBeInTheDocument();
  });

  it('shows the load-error banner when the store reports a load failure', async () => {
    render(<DiscordAlertsPage />);
    await waitFor(() => expect(mockListAlertsGrouped).toHaveBeenCalled());

    // Simulate a load failure after mount (Requirement 1.5).
    useDiscordAlertsStore.setState({ loadError: true });

    await waitFor(() => {
      expect(screen.getByTestId('load-error')).toBeInTheDocument();
    });
  });

  it('does not show the load-error banner on a successful load', async () => {
    render(<DiscordAlertsPage />);
    await waitFor(() => expect(mockListAlertsGrouped).toHaveBeenCalled());

    expect(screen.queryByTestId('load-error')).not.toBeInTheDocument();
  });

  it('updates the store currentSourceId when a source is selected', async () => {
    const user = userEvent.setup();
    const source = buildSource({ id: 's-a', community: 'Alpha', chatRoom: 'room-a' });
    // Seed via the repo so the page's mount-time loadSources() populates them.
    mockListSources.mockResolvedValue([source]);

    render(<DiscordAlertsPage />);
    // Wait for the seeded option to render before selecting it.
    await screen.findByRole('option', { name: 'Alpha / room-a' });

    await user.selectOptions(screen.getByTestId('source-selector'), 's-a');

    expect(useDiscordAlertsStore.getState().currentSourceId).toBe('s-a');
  });
});
