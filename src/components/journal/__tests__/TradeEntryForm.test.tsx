import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TradeEntryForm from '../TradeEntryForm';
import type { Strategy } from '../../../types/tradingPlan';
import type { Portfolio } from '../../../types/portfolio';
import type { TradeJournalEntry } from '../../../types/journal';

// Mock NotesEditor since TipTap doesn't work in jsdom
vi.mock('../../notes/NotesEditor', () => ({
  default: ({ content, onChange, placeholder }: { content: string; onChange: (v: string) => void; placeholder?: string }) => (
    <textarea
      data-testid="mock-notes-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}));

// Mock useJournal to provide autoCalculate
vi.mock('../../../hooks/useJournal', () => ({
  useJournal: () => ({
    entries: [],
    filters: {},
    sortField: 'openDate',
    sortDirection: 'desc',
    isLoading: false,
    summary: { totalTrades: 0, winRate: 0, totalPL: 0, avgPL: 0, totalFees: 0 },
    addEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    setFilters: vi.fn(),
    setSort: vi.fn(),
    autoCalculate: (entry: Partial<TradeJournalEntry>) => {
      const computed: Partial<TradeJournalEntry> = {};
      if (entry.openDate && entry.expirationDate) {
        const diff = Math.floor(
          (new Date(entry.expirationDate).getTime() - new Date(entry.openDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        computed.dte = diff;
      }
      if (entry.strikePrice != null && entry.premium != null && entry.optionType) {
        computed.breakEvenPrice =
          entry.optionType === 'Put'
            ? entry.strikePrice - entry.premium
            : entry.strikePrice + entry.premium;
      }
      if (entry.exitPrice != null && entry.premium != null && entry.direction && entry.fees != null) {
        const gross =
          entry.direction === 'Sell'
            ? entry.premium - entry.exitPrice
            : entry.exitPrice - entry.premium;
        computed.profitLoss = gross - entry.fees;
        computed.winLoss = computed.profitLoss > 0 ? 'Win' : 'Loss';
      }
      if (entry.openDate && entry.closeDate) {
        computed.daysHeld = Math.floor(
          (new Date(entry.closeDate).getTime() - new Date(entry.openDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
      }
      return computed;
    },
  }),
}));

const mockStrategies: Strategy[] = [
  {
    id: 'strat-1',
    name: 'Iron Condor',
    classification: 'Core',
    description: 'Sell iron condors',
    entryCriteria: [{ id: 'ec1', parameterName: 'DTE', value: '45' }],
    managementRules: [{ id: 'mr1', triggerCondition: '50% profit', actionDescription: 'Close' }],
    profitTargets: [],
    stopLosses: [],
  },
  {
    id: 'strat-2',
    name: 'PMCC',
    classification: 'Speculative',
    description: 'Poor mans covered call',
    entryCriteria: [{ id: 'ec2', parameterName: 'Delta', value: '0.70' }],
    managementRules: [{ id: 'mr2', triggerCondition: 'Roll', actionDescription: 'Roll short call' }],
    profitTargets: [],
    stopLosses: [],
  },
];

const mockPortfolios: Portfolio[] = [
  {
    id: 'port-1',
    name: 'Main Account',
    description: 'Primary trading account',
    initialBalance: 100000,
    planId: 'plan-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultProps = {
  strategies: mockStrategies,
  portfolios: mockPortfolios,
  planId: 'plan-1',
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe('TradeEntryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all field groups', () => {
    render(<TradeEntryForm {...defaultProps} />);
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Dates')).toBeInTheDocument();
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText(/Reserves/)).toBeInTheDocument();
    expect(screen.getByText('Linking')).toBeInTheDocument();
    expect(screen.getByText('Auto-Calculated')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders Save Trade button in create mode', () => {
    render(<TradeEntryForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Save Trade' })).toBeInTheDocument();
  });

  it('renders Update Trade button in edit mode', () => {
    const entry: TradeJournalEntry = {
      id: 'entry-1',
      stockSymbol: 'AAPL',
      openDate: new Date('2025-01-15'),
      expirationDate: new Date('2025-03-21'),
      optionType: 'Put',
      direction: 'Sell',
      stockPriceDOC: 150,
      dte: 65,
      ditc: 10,
      breakEvenPrice: 145,
      strikePrice: 150,
      premium: 5,
      cashReserve: 15000,
      fees: 1.5,
      tradeStatus: 'Open',
      portfolioId: 'port-1',
      strategyId: 'strat-1',
      planId: 'plan-1',
      winLoss: null,
      notes: 'Test note',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<TradeEntryForm {...defaultProps} entry={entry} />);
    expect(screen.getByRole('button', { name: 'Update Trade' })).toBeInTheDocument();
  });

  it('shows validation errors for required fields on empty submit', async () => {
    const user = userEvent.setup();
    render(<TradeEntryForm {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Save Trade' }));
    expect(screen.getByText('Stock symbol is required')).toBeInTheDocument();
    expect(screen.getByText('Open date is required')).toBeInTheDocument();
    expect(screen.getByText('Strategy is required')).toBeInTheDocument();
    expect(screen.getByText('Portfolio is required')).toBeInTheDocument();
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<TradeEntryForm {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('displays strategy and portfolio options', () => {
    render(<TradeEntryForm {...defaultProps} />);
    expect(screen.getByText('Iron Condor (Core)')).toBeInTheDocument();
    expect(screen.getByText('PMCC (Speculative)')).toBeInTheDocument();
    expect(screen.getByText('Main Account')).toBeInTheDocument();
  });

  it('displays auto-calculated DTE when dates are entered', async () => {
    const user = userEvent.setup();
    render(<TradeEntryForm {...defaultProps} />);

    const openDateInput = screen.getByLabelText('Open Date');
    const expDateInput = screen.getByLabelText('Expiration Date');

    await user.clear(openDateInput);
    fireEvent.change(openDateInput, { target: { name: 'openDate', value: '2025-01-15' } });
    await user.clear(expDateInput);
    fireEvent.change(expDateInput, { target: { name: 'expirationDate', value: '2025-03-21' } });

    const dteEl = screen.getByTestId('calc-dte');
    expect(dteEl.textContent).toBe('65');
  });

  it('displays auto-calculated break-even price for Put', async () => {
    render(<TradeEntryForm {...defaultProps} />);

    fireEvent.change(screen.getByLabelText('Strike Price'), {
      target: { name: 'strikePrice', value: '150' },
    });
    fireEvent.change(screen.getByLabelText('Premium'), {
      target: { name: 'premium', value: '5' },
    });

    // Default option type is Put
    const beEl = screen.getByTestId('calc-breakeven');
    expect(beEl.textContent).toBe('145.00');
  });

  it('displays auto-calculated P/L and Win/Loss for closed trade', async () => {
    render(<TradeEntryForm {...defaultProps} />);

    // Direction defaults to Sell
    fireEvent.change(screen.getByLabelText('Premium'), {
      target: { name: 'premium', value: '5' },
    });
    fireEvent.change(screen.getByLabelText('Exit Price'), {
      target: { name: 'exitPrice', value: '2' },
    });
    fireEvent.change(screen.getByLabelText('Fees'), {
      target: { name: 'fees', value: '1' },
    });

    const plEl = screen.getByTestId('calc-pl');
    // Sell: 5 - 2 - 1 = 2
    expect(plEl.textContent).toBe('2.00');

    const wlEl = screen.getByTestId('calc-winloss');
    expect(wlEl.textContent).toBe('Win');
  });

  it('calls onSave with complete entry when form is valid', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TradeEntryForm {...defaultProps} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Stock Symbol'), {
      target: { name: 'stockSymbol', value: 'AAPL' },
    });
    fireEvent.change(screen.getByLabelText('Open Date'), {
      target: { name: 'openDate', value: '2025-01-15' },
    });
    fireEvent.change(screen.getByLabelText('Expiration Date'), {
      target: { name: 'expirationDate', value: '2025-03-21' },
    });
    fireEvent.change(screen.getByLabelText('Strike Price'), {
      target: { name: 'strikePrice', value: '150' },
    });
    fireEvent.change(screen.getByLabelText('Premium'), {
      target: { name: 'premium', value: '5' },
    });
    fireEvent.change(screen.getByLabelText('Stock Price DOC'), {
      target: { name: 'stockPriceDOC', value: '155' },
    });
    fireEvent.change(screen.getByLabelText('Cash Reserve'), {
      target: { name: 'cashReserve', value: '15000' },
    });

    // Select strategy
    fireEvent.change(screen.getByLabelText('Strategy'), {
      target: { name: 'strategyId', value: 'strat-1' },
    });
    // Select portfolio
    fireEvent.change(screen.getByLabelText('Portfolio / Account'), {
      target: { name: 'portfolioId', value: 'port-1' },
    });

    await user.click(screen.getByRole('button', { name: 'Save Trade' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedEntry = onSave.mock.calls[0][0] as TradeJournalEntry;
    expect(savedEntry.stockSymbol).toBe('AAPL');
    expect(savedEntry.strikePrice).toBe(150);
    expect(savedEntry.premium).toBe(5);
    expect(savedEntry.strategyId).toBe('strat-1');
    expect(savedEntry.portfolioId).toBe('port-1');
    expect(savedEntry.planId).toBe('plan-1');
    expect(savedEntry.id).toBeTruthy();
  });

  it('populates form fields in edit mode', () => {
    const entry: TradeJournalEntry = {
      id: 'entry-1',
      stockSymbol: 'TSLA',
      openDate: new Date('2025-02-01'),
      expirationDate: new Date('2025-04-18'),
      optionType: 'Call',
      direction: 'Buy',
      stockPriceDOC: 200,
      dte: 76,
      ditc: 5,
      breakEvenPrice: 210,
      strikePrice: 200,
      premium: 10,
      cashReserve: 20000,
      marginCashReserve: 10000,
      fees: 2,
      tradeStatus: 'Open',
      portfolioId: 'port-1',
      strategyId: 'strat-2',
      planId: 'plan-1',
      winLoss: null,
      notes: 'Bullish play',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<TradeEntryForm {...defaultProps} entry={entry} />);

    expect((screen.getByLabelText('Stock Symbol') as HTMLInputElement).value).toBe('TSLA');
    expect((screen.getByLabelText('Strike Price') as HTMLInputElement).value).toBe('200');
    expect((screen.getByLabelText('Premium') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Strategy') as HTMLSelectElement).value).toBe('strat-2');
    expect(screen.getByRole('button', { name: 'Update Trade' })).toBeInTheDocument();
  });

  it('renders notes editor', () => {
    render(<TradeEntryForm {...defaultProps} />);
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });
});
