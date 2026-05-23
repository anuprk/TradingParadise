import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StrategyBreakdown from '../StrategyBreakdown';
import type { TradeJournalEntry } from '../../../types/journal';

function makeEntry(overrides: Partial<TradeJournalEntry> = {}): TradeJournalEntry {
  return {
    id: 'e1',
    stockSymbol: 'AAPL',
    openDate: new Date('2025-01-10'),
    expirationDate: new Date('2025-02-21'),
    optionType: 'Put',
    direction: 'Sell',
    stockPriceDOC: 180,
    dte: 42,
    ditc: 10,
    breakEvenPrice: 175,
    strikePrice: 180,
    premium: 5,
    cashReserve: 18000,
    fees: 1,
    tradeStatus: 'Closed',
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    winLoss: 'Win',
    profitLoss: 300,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const strategyNames: Record<string, string> = {
  s1: 'Iron Condor',
  s2: 'Cash Secured Put',
};

describe('StrategyBreakdown', () => {
  it('shows empty state when no closed trades', () => {
    render(<StrategyBreakdown entries={[]} strategyNames={strategyNames} />);
    expect(screen.getByText('No closed trades to analyze')).toBeInTheDocument();
  });

  it('groups P/L by strategy', () => {
    const entries = [
      makeEntry({ id: 'e1', strategyId: 's1', profitLoss: 300, winLoss: 'Win' }),
      makeEntry({ id: 'e2', strategyId: 's1', profitLoss: -100, winLoss: 'Loss' }),
      makeEntry({ id: 'e3', strategyId: 's2', profitLoss: 500, winLoss: 'Win' }),
    ];
    render(<StrategyBreakdown entries={entries} strategyNames={strategyNames} />);

    expect(screen.getAllByText('Iron Condor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cash Secured Put').length).toBeGreaterThan(0);
    // Iron Condor: 300 + (-100) = 200
    expect(screen.getAllByText('$200.00').length).toBeGreaterThan(0);
    // Cash Secured Put: 500
    expect(screen.getAllByText('$500.00').length).toBeGreaterThan(0);
  });

  it('ignores open trades', () => {
    const entries = [
      makeEntry({ id: 'e1', tradeStatus: 'Open', strategyId: 's1' }),
    ];
    render(<StrategyBreakdown entries={entries} strategyNames={strategyNames} />);
    expect(screen.getByText('No closed trades to analyze')).toBeInTheDocument();
  });

  it('shows Unknown Strategy for unmapped strategy IDs', () => {
    const entries = [
      makeEntry({ id: 'e1', strategyId: 'unknown-id', profitLoss: 100 }),
    ];
    render(<StrategyBreakdown entries={entries} strategyNames={strategyNames} />);
    expect(screen.getAllByText('Unknown Strategy').length).toBeGreaterThan(0);
  });
});
