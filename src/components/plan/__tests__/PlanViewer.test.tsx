import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PlanViewer from '../PlanViewer';
import { usePlanStore } from '../../../stores/planStore';
import { PLAN_SECTIONS } from '../SectionNav';
import type { TradingPlan } from '../../../types/tradingPlan';
import type { TradeJournalEntry } from '../../../types/journal';

vi.mock('../../../db/planRepository', () => ({
  createPlan: vi.fn().mockResolvedValue('new-id'),
  getPlan: vi.fn().mockResolvedValue(undefined),
  updatePlan: vi.fn().mockResolvedValue(undefined),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  listPlans: vi.fn().mockResolvedValue([]),
  getLastAccessed: vi.fn().mockResolvedValue(undefined),
}));

const mockFilterJournalEntries = vi.fn().mockResolvedValue([]);
vi.mock('../../../db/journalRepository', () => ({
  filterJournalEntries: (...args: unknown[]) => mockFilterJournalEntries(...args),
}));

function buildPlan(): TradingPlan {
  const now = new Date();
  return {
    id: 'plan-1',
    name: 'My 2025 Plan',
    author: 'Tom King',
    year: 2025,
    createdAt: now,
    updatedAt: now,
    goals: [
      { id: 'g1', description: 'Generate monthly income', targetValue: '$5,000/month' },
      { id: 'g2', description: 'Grow account', targetValue: '20% annual' },
    ],
    greeksTargets: [
      { id: 'gt1', metricName: 'Delta', targetDescription: 'Keep neutral', minValue: -5, maxValue: 5 },
      { id: 'gt2', metricName: 'Theta', targetDescription: 'Positive theta', minValue: 50 },
    ],
    riskManagement: {
      bpThresholds: [
        { id: 'bp1', percentage: 50, actionDescription: 'Reduce positions' },
        { id: 'bp2', percentage: 75, actionDescription: 'Stop new trades' },
      ],
      positionLimits: [
        { id: 'pl1', strategyName: 'Iron Condor', maxPositions: 5, maxPerUnderlying: 2 },
      ],
      maxLossPerTrade: 500,
      maxLossPerPortfolio: 5000,
    },
    tradeRules: [
      { id: 'tr1', order: 0, text: 'Never add to a losing position', category: 'Risk' },
      { id: 'tr2', order: 1, text: 'Always use stop losses' },
    ],
    dailyManagement: {
      nightlyReview: [
        { id: 'nr1', order: 0, description: 'Check open positions', reviewType: 'nightly' },
      ],
      morningReview: [
        { id: 'mr1', order: 0, description: 'Review market conditions', reviewType: 'morning' },
      ],
    },
    vacationRules: [
      { id: 'vr1', order: 0, text: 'Close all speculative positions' },
    ],
    marketRegimes: [
      { id: 'mr1', name: 'Bullish', conditions: 'SPY above 200 SMA', strategyAdjustments: 'Increase long delta' },
      { id: 'mr2', name: 'Bearish', conditions: 'SPY below 200 SMA', strategyAdjustments: 'Reduce exposure' },
    ],
    accountSizing: {
      totalAccountSize: 100000,
      allocations: [
        { id: 'a1', categoryName: 'Core Income', allocationPercentage: 60, numberOfPositions: 10, positionSizing: '$6,000 each' },
        { id: 'a2', categoryName: 'Speculative', allocationPercentage: 40 },
      ],
    },
    coreStrategies: [
      {
        id: 'cs1',
        name: 'Cash Secured Put',
        classification: 'Core',
        description: 'Sell puts on quality stocks',
        entryCriteria: [
          { id: 'ec1', parameterName: 'DTE', value: '45 days' },
          { id: 'ec2', parameterName: 'Delta', value: '0.30' },
        ],
        managementRules: [
          { id: 'mgr1', triggerCondition: 'At 21 DTE', actionDescription: 'Roll or close' },
        ],
        profitTargets: [
          { id: 'pt1', targetValue: '50%', action: 'Close position' },
        ],
        stopLosses: [
          { id: 'sl1', stopValue: '200%', action: 'Close and reassess' },
        ],
      },
    ],
    speculativeStrategies: [
      {
        id: 'ss1',
        name: 'Bear Trap',
        classification: 'Speculative',
        description: 'Contrarian play on oversold stocks',
        entryCriteria: [
          { id: 'ec3', parameterName: 'IV Rank', value: 'Above 50' },
        ],
        managementRules: [
          { id: 'mgr2', triggerCondition: 'Stock recovers 5%', actionDescription: 'Take profits' },
        ],
        profitTargets: [],
        stopLosses: [],
      },
    ],
  };
}

beforeEach(() => {
  usePlanStore.setState({
    currentPlan: null,
    isDirty: false,
    isLoading: false,
    plans: [],
  });
  mockFilterJournalEntries.mockReset().mockResolvedValue([]);
});

/**
 * Helper that pre-sets the plan in the store and stubs loadPlan to be a no-op
 * so the component's useEffect doesn't trigger an async DB call that resets state.
 */
function setViewerPlan(plan: TradingPlan | null) {
  usePlanStore.setState({
    currentPlan: plan,
    isLoading: false,
    loadPlan: vi.fn(),
  });
}

function renderViewer(planId = 'plan-1') {
  const router = createMemoryRouter(
    [{ path: '/', element: <PlanViewer planId={planId} /> }],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('PlanViewer', () => {
  it('shows loading state', () => {
    usePlanStore.setState({ isLoading: true });
    renderViewer();
    expect(screen.getByText('Loading plan…')).toBeInTheDocument();
  });

  it('shows not found when plan is null and not loading', () => {
    setViewerPlan(null);
    renderViewer();
    expect(screen.getByText('Plan not found.')).toBeInTheDocument();
  });

  it('renders plan header with name, author, and year', () => {
    setViewerPlan(buildPlan());
    renderViewer();
    expect(screen.getByText('My 2025 Plan')).toBeInTheDocument();
    expect(screen.getByText(/Tom King/)).toBeInTheDocument();
    expect(screen.getByText(/Tom King · 2025/)).toBeInTheDocument();
  });

  it('renders section navigation with all sections', () => {
    setViewerPlan(buildPlan());
    renderViewer();
    const nav = screen.getByRole('navigation', { name: 'Plan sections' });
    for (const section of PLAN_SECTIONS) {
      expect(within(nav).getByText(section.label)).toBeInTheDocument();
    }
  });

  it('displays goals section by default with numbered list', () => {
    setViewerPlan(buildPlan());
    renderViewer();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Generate monthly income')).toBeInTheDocument();
    expect(screen.getByText('Target: $5,000/month')).toBeInTheDocument();
    expect(screen.getByText('Grow account')).toBeInTheDocument();
  });

  it('navigates to Greeks Targets section', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Portfolio Greeks Targets'));
    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByText('Keep neutral')).toBeInTheDocument();
    expect(screen.getByText('-5 to 5')).toBeInTheDocument();
  });

  it('navigates to Risk Management section and shows BP thresholds', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Risk Management'));
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Reduce positions')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Stop new trades')).toBeInTheDocument();
  });

  it('shows position limits in Risk Management', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Risk Management'));
    expect(screen.getByText('Iron Condor')).toBeInTheDocument();
  });

  it('shows max loss thresholds in Risk Management', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Risk Management'));
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(screen.getByText('$5,000.00')).toBeInTheDocument();
  });

  it('navigates to Trade Rules section with numbered rules and category badges', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Trade Rules'));
    expect(screen.getByText('Never add to a losing position')).toBeInTheDocument();
    expect(screen.getByText('Risk')).toBeInTheDocument();
    expect(screen.getByText('Always use stop losses')).toBeInTheDocument();
  });

  it('navigates to Daily Management section with separate checklists', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Daily Management'));
    expect(screen.getByText('Nightly Review')).toBeInTheDocument();
    expect(screen.getByText('Check open positions')).toBeInTheDocument();
    expect(screen.getByText('Morning Review')).toBeInTheDocument();
    expect(screen.getByText('Review market conditions')).toBeInTheDocument();
  });

  it('navigates to Vacation Rules section', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Vacation Rules'));
    expect(screen.getByText('Close all speculative positions')).toBeInTheDocument();
  });

  it('navigates to Market Regime section with cards', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Market Regime Framework'));
    expect(screen.getByText('Bullish')).toBeInTheDocument();
    expect(screen.getByText('SPY above 200 SMA')).toBeInTheDocument();
    expect(screen.getByText('Bearish')).toBeInTheDocument();
  });

  it('navigates to Account Sizing section with dollar amounts', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Account Sizing & Allocation'));
    expect(screen.getByText('$100,000.00')).toBeInTheDocument();
    expect(screen.getByText('Core Income')).toBeInTheDocument();
    expect(screen.getByText('60.00%')).toBeInTheDocument();
    expect(screen.getByText('$60,000.00')).toBeInTheDocument();
    expect(screen.getByText('Speculative')).toBeInTheDocument();
    expect(screen.getByText('$40,000.00')).toBeInTheDocument();
  });

  it('navigates to Core Strategies section with full details', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Core Strategies'));
    expect(screen.getByText('Cash Secured Put')).toBeInTheDocument();
    expect(screen.getByText('Sell puts on quality stocks')).toBeInTheDocument();
    // Entry criteria
    expect(screen.getByText('DTE')).toBeInTheDocument();
    expect(screen.getByText('45 days')).toBeInTheDocument();
    // Management rules
    expect(screen.getByText(/At 21 DTE/)).toBeInTheDocument();
    expect(screen.getByText(/Roll or close/)).toBeInTheDocument();
    // Profit targets
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/Close position/)).toBeInTheDocument();
    // Stop losses
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  it('navigates to Speculative Strategies section', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Speculative Strategies'));
    expect(screen.getByText('Bear Trap')).toBeInTheDocument();
    expect(screen.getByText('Contrarian play on oversold stocks')).toBeInTheDocument();
  });

  it('shows allocation warning when total is not 100%', async () => {
    const user = userEvent.setup();
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Account Sizing & Allocation'));
    // 60 + 40 = 100, so no warning should appear
    expect(screen.queryByText(/expected 100%/)).not.toBeInTheDocument();
  });

  it('shows allocation warning when total deviates from 100%', async () => {
    const user = userEvent.setup();
    const plan = buildPlan();
    plan.accountSizing.allocations = [
      { id: 'a1', categoryName: 'Core', allocationPercentage: 60 },
      { id: 'a2', categoryName: 'Spec', allocationPercentage: 30 },
    ];
    setViewerPlan(plan);
    renderViewer();

    await user.click(screen.getByText('Account Sizing & Allocation'));
    expect(screen.getByText(/expected 100%/)).toBeInTheDocument();
  });

  it('displays "No trades recorded" when strategy has no journal entries', async () => {
    const user = userEvent.setup();
    mockFilterJournalEntries.mockResolvedValue([]);
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Core Strategies'));
    await waitFor(() => {
      expect(screen.getByText('No trades recorded for this strategy.')).toBeInTheDocument();
    });
  });

  it('displays recent trades for a strategy when journal entries exist', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const mockEntries: TradeJournalEntry[] = [
      {
        id: 'je1',
        stockSymbol: 'AAPL',
        openDate: new Date('2025-01-15'),
        expirationDate: new Date('2025-03-15'),
        optionType: 'Put',
        direction: 'Sell',
        stockPriceDOC: 180,
        dte: 59,
        ditc: 10,
        breakEvenPrice: 175,
        strikePrice: 180,
        premium: 5,
        cashReserve: 18000,
        fees: 1.5,
        tradeStatus: 'Closed',
        closeDate: new Date('2025-02-01'),
        exitPrice: 1,
        profitLoss: 250,
        winLoss: 'Win',
        daysHeld: 17,
        portfolioId: 'p1',
        strategyId: 'cs1',
        planId: 'plan-1',
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'je2',
        stockSymbol: 'MSFT',
        openDate: new Date('2025-02-01'),
        expirationDate: new Date('2025-04-01'),
        optionType: 'Put',
        direction: 'Sell',
        stockPriceDOC: 400,
        dte: 59,
        ditc: 5,
        breakEvenPrice: 395,
        strikePrice: 400,
        premium: 5,
        cashReserve: 40000,
        fees: 1.5,
        tradeStatus: 'Open',
        portfolioId: 'p1',
        strategyId: 'cs1',
        planId: 'plan-1',
        winLoss: null,
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
    ];
    mockFilterJournalEntries.mockResolvedValue(mockEntries);
    setViewerPlan(buildPlan());
    renderViewer();

    await user.click(screen.getByText('Core Strategies'));
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('+$250.00')).toBeInTheDocument();
    // Verify filterJournalEntries was called with the correct strategyId and planId
    expect(mockFilterJournalEntries).toHaveBeenCalledWith({ strategyId: 'cs1', planId: 'plan-1' });
  });
});
