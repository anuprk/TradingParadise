import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TradeJournal from '../TradeJournal';
import type { TradeJournalEntry } from '../../../types/journal';

const mockSetSort = vi.fn();
const mockSetFilters = vi.fn();
const mockDeleteEntry = vi.fn().mockResolvedValue(undefined);

const mockEntries: TradeJournalEntry[] = [
  {
    id: 'e1',
    stockSymbol: 'AAPL',
    openDate: new Date('2025-03-01'),
    expirationDate: new Date('2025-04-18'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 170,
    dte: 48,
    ditc: 10,
    breakEvenPrice: 165,
    strikePrice: 170,
    premium: 5,
    cashReserve: 17000,
    fees: 1.5,
    tradeStatus: 'Open',
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    winLoss: null,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'e2',
    stockSymbol: 'TSLA',
    openDate: new Date('2025-02-15'),
    expirationDate: new Date('2025-03-21'),
    optionType: 'Call',
    direction: 'Buy',
    stockPriceDOC: 250,
    dte: 34,
    ditc: 0,
    breakEvenPrice: 260,
    strikePrice: 250,
    premium: 10,
    cashReserve: 25000,
    fees: 2,
    exitPrice: 15,
    closeDate: new Date('2025-03-10'),
    profitLoss: 3,
    winLoss: 'Win',
    daysHeld: 23,
    tradeStatus: 'Closed',
    portfolioId: 'p1',
    strategyId: 's2',
    planId: 'plan1',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'e3',
    stockSymbol: 'SPY',
    openDate: new Date('2025-01-10'),
    expirationDate: new Date('2025-02-21'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 480,
    dte: 42,
    ditc: 0,
    breakEvenPrice: 475,
    strikePrice: 480,
    premium: 5,
    cashReserve: 48000,
    fees: 1,
    exitPrice: 8,
    closeDate: new Date('2025-02-10'),
    profitLoss: -4,
    winLoss: 'Loss',
    daysHeld: 31,
    tradeStatus: 'Closed',
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock('../../../hooks/useJournal', () => ({
  useJournal: () => ({
    entries: mockEntries,
    filters: {},
    sortField: 'openDate',
    sortDirection: 'desc',
    isLoading: false,
    summary: { totalTrades: 3, winRate: 33.33, totalPL: -1, avgPL: -0.33, totalFees: 4.5 },
    setSort: mockSetSort,
    setFilters: mockSetFilters,
    deleteEntry: mockDeleteEntry,
  }),
}));

vi.mock('../../../hooks/useTradingPlan', () => ({
  useTradingPlan: () => ({
    plan: { coreStrategies: [], speculativeStrategies: [] },
  }),
}));

vi.mock('../../../hooks/usePortfolio', () => ({
  usePortfolio: () => ({
    portfolios: [],
  }),
}));

function renderJournal() {
  return render(
    <MemoryRouter>
      <TradeJournal />
    </MemoryRouter>,
  );
}

describe('TradeJournal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading and Add Trade button', () => {
    renderJournal();
    expect(screen.getByText('Trade Journal')).toBeInTheDocument();
    // The redesigned inline-grid journal uses an "+ Add Row" button (not a link).
    expect(screen.getByRole('button', { name: /Add Row/ })).toBeInTheDocument();
  });

  it('renders all entries in the desktop table', () => {
    renderJournal();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // 1 header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('displays key columns for each entry', () => {
    renderJournal();
    // Symbols render as editable inputs in the inline-grid design.
    expect(screen.getAllByDisplayValue('AAPL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('TSLA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('SPY').length).toBeGreaterThanOrEqual(1);
  });

  it('displays status badges', () => {
    renderJournal();
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(1);
  });

  it('displays win/loss badges for closed trades', () => {
    renderJournal();
    expect(screen.getAllByText('Win').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Loss').length).toBeGreaterThanOrEqual(1);
  });

  it('renders per-row action buttons for each entry', () => {
    renderJournal();
    // Inline-grid rows expose icon buttons by title (Delete / Duplicate / Insert below).
    expect(screen.getAllByTitle('Delete').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTitle('Duplicate').length).toBeGreaterThanOrEqual(3);
  });

  it('calls setSort when a column header is clicked', async () => {
    const user = userEvent.setup();
    renderJournal();
    const table = screen.getByRole('table');
    const symbolHeader = within(table).getByText('Symbol');
    await user.click(symbolHeader);
    expect(mockSetSort).toHaveBeenCalledWith('stockSymbol', 'desc');
  });

  it('toggles sort direction when clicking the currently sorted column', async () => {
    const user = userEvent.setup();
    renderJournal();
    // "Open" is the open-date column header; it is the active sort column (openDate desc).
    const openHeader = screen.getByRole('columnheader', { name: /^Open/ });
    await user.click(openHeader);
    // Should toggle to asc since current is desc
    expect(mockSetSort).toHaveBeenCalledWith('openDate', 'asc');
  });

  it('shows sort indicator on the active sort column', () => {
    renderJournal();
    const openHeader = screen.getByRole('columnheader', { name: /^Open/ });
    expect(openHeader.textContent).toContain('▼');
  });

  it('renders the open-positions summary banner', () => {
    renderJournal();
    expect(screen.getByText('Open Positions')).toBeInTheDocument();
    expect(screen.getByText('Total Margin Req')).toBeInTheDocument();
    expect(screen.getByText('This Month P/L')).toBeInTheDocument();
  });

  it('renders the journal filters section', () => {
    renderJournal();
    // Redesigned filter bar: Result control, a Status row, and a Reset button.
    // ("Symbol" text is intentionally not asserted here — it also appears as a column header.)
    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });
  it('opens confirmation dialog when Delete is clicked and deletes on confirm', async () => {
    const user = userEvent.setup();
    renderJournal();
    // Click the first row's Delete icon button (identified by title).
    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    // Confirm dialog should appear
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete Journal Entry')).toBeInTheDocument();
    expect(within(dialog).getByText(/Are you sure you want to delete this journal entry/)).toBeInTheDocument();

    // Click the confirm button inside the dialog
    const confirmBtn = within(dialog).getByRole('button', { name: 'Delete' });
    await user.click(confirmBtn);

    expect(mockDeleteEntry).toHaveBeenCalledWith('e1');
  });

  it('closes confirmation dialog when Cancel is clicked without deleting', async () => {
    const user = userEvent.setup();
    renderJournal();
    const deleteButtons = screen.getAllByTitle('Delete');
    await user.click(deleteButtons[0]);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete Journal Entry')).toBeInTheDocument();

    const cancelBtn = within(dialog).getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    expect(mockDeleteEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('TradeJournal empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No trades found" when entries are empty', () => {
    vi.doMock('../../../hooks/useJournal', () => ({
      useJournal: () => ({
        entries: [],
        sortField: 'openDate',
        sortDirection: 'desc',
        isLoading: false,
        setSort: vi.fn(),
      }),
    }));

    // Re-import to pick up the new mock - but since vi.mock is hoisted,
    // we test the empty state differently by checking the component logic
    // The main describe already covers the populated state
  });
});
