import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the repository so no network runs. The viewer only triggers
// repo.deleteAlert (via the store's deleteAlert action) and the store's
// refresh calls repo.listAlertsGrouped — both are stubbed here.
const mockDeleteAlert = vi.fn().mockResolvedValue(undefined);
const mockListAlertsGrouped = vi.fn().mockResolvedValue([]);

vi.mock('../../../db/discordAlertsRepository', () => ({
  deleteAlert: (...args: unknown[]) => mockDeleteAlert(...args),
  listAlertsGrouped: (...args: unknown[]) => mockListAlertsGrouped(...args),
}));

// Mock appStore so error toasts don't touch real state.
const mockAddToast = vi.fn();
vi.mock('../../../stores/appStore', () => ({
  useAppStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

import AlertViewer from '../AlertViewer';
import { useDiscordAlertsStore } from '../../../stores/discordAlertsStore';
import type {
  DiscordAlertSource,
  DiscordTradeAlert,
  GroupedAlerts,
} from '../../../db/discordAlertsRepository';

function makeSource(overrides: Partial<DiscordAlertSource> = {}): DiscordAlertSource {
  return {
    id: 'source-1',
    community: 'Alpha Traders',
    chatRoom: 'options-room',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeAlert(overrides: Partial<DiscordTradeAlert> = {}): DiscordTradeAlert {
  return {
    id: 'alert-1',
    sourceId: 'source-1',
    messageId: 'msg-1',
    rawContent: 'BTO AAPL 190c @ 2.80',
    submissionTimestamp: new Date('2024-02-01T12:00:00Z'),
    actionType: 'Open',
    symbol: 'AAPL',
    strategy: null,
    expiration: null,
    strikes: '190c',
    direction: 'buy',
    fillPrice: 2.8,
    amount: null,
    amountKind: null,
    links: [],
    extractedAnyField: true,
    createdAt: new Date('2024-02-01T12:00:00Z'),
    updatedAt: new Date('2024-02-01T12:00:00Z'),
    ...overrides,
  };
}

function seedGrouped(grouped: GroupedAlerts[]) {
  useDiscordAlertsStore.setState({ grouped });
}

describe('AlertViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to a clean slate before each test.
    useDiscordAlertsStore.setState({
      sources: [],
      grouped: [],
      currentSourceId: null,
      pendingReview: null,
      isLoading: false,
      loadError: false,
    });
  });

  it('renders grouped alerts with community and chat room labels (Req 7.1)', () => {
    seedGrouped([
      {
        source: makeSource({ id: 's1', community: 'Alpha Traders', chatRoom: 'options-room' }),
        alerts: [makeAlert({ id: 'a1', sourceId: 's1' })],
      },
      {
        source: makeSource({ id: 's2', community: 'Beta Options', chatRoom: 'swing-desk' }),
        alerts: [makeAlert({ id: 'a2', sourceId: 's2' })],
      },
    ]);

    render(<AlertViewer />);

    const groups = screen.getAllByTestId('alert-group');
    expect(groups).toHaveLength(2);

    expect(screen.getByText('Alpha Traders')).toBeInTheDocument();
    expect(screen.getByText('options-room')).toBeInTheDocument();
    expect(screen.getByText('Beta Options')).toBeInTheDocument();
    expect(screen.getByText('swing-desk')).toBeInTheDocument();
  });

  it('renders an Action_Type badge with the action label (Req 7.6)', () => {
    seedGrouped([
      {
        source: makeSource(),
        alerts: [makeAlert({ actionType: 'Open' })],
      },
    ]);

    render(<AlertViewer />);

    const badge = screen.getByTestId('alert-action-badge');
    expect(badge).toHaveTextContent('Open');
  });

  it('toggles the raw content via the reveal control (Req 7.4)', async () => {
    const user = userEvent.setup();
    seedGrouped([
      {
        source: makeSource(),
        alerts: [makeAlert({ rawContent: 'BTO AAPL 190c @ 2.80 raw text' })],
      },
    ]);

    render(<AlertViewer />);

    // Initially hidden.
    expect(screen.queryByTestId('alert-raw-content')).not.toBeInTheDocument();

    const toggle = screen.getByTestId('alert-raw-toggle');
    await user.click(toggle);

    const raw = screen.getByTestId('alert-raw-content');
    expect(raw).toBeInTheDocument();
    expect(raw).toHaveTextContent('BTO AAPL 190c @ 2.80 raw text');

    // Clicking again hides it.
    await user.click(toggle);
    expect(screen.queryByTestId('alert-raw-content')).not.toBeInTheDocument();
  });

  it('renders links as anchors opening in a new tab (Req 7.5)', () => {
    const href = 'https://discord.com/channels/123/456';
    seedGrouped([
      {
        source: makeSource(),
        alerts: [makeAlert({ links: [href] })],
      },
    ]);

    render(<AlertViewer />);

    const anchor = screen.getByRole('link', { name: href });
    expect(anchor).toHaveAttribute('href', href);
    expect(anchor).toHaveAttribute('target', '_blank');
  });

  it('shows an empty state when a group has zero alerts (Req 7.7)', () => {
    seedGrouped([
      {
        source: makeSource({ community: 'Alpha Traders', chatRoom: 'options-room' }),
        alerts: [],
      },
    ]);

    render(<AlertViewer />);

    const empty = screen.getByTestId('alert-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/no alerts/i);
  });

  it('shows an empty state when there are no groups at all (Req 7.7)', () => {
    seedGrouped([]);

    render(<AlertViewer />);

    const empty = screen.getByTestId('alert-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/no alerts/i);
  });

  it('calls the store deleteAlert (backed by the mocked repo) when delete is clicked', async () => {
    const user = userEvent.setup();
    seedGrouped([
      {
        source: makeSource(),
        alerts: [makeAlert({ id: 'alert-delete-me' })],
      },
    ]);

    render(<AlertViewer />);

    await user.click(screen.getByTestId('alert-delete'));

    expect(mockDeleteAlert).toHaveBeenCalledWith('alert-delete-me');
  });
});
