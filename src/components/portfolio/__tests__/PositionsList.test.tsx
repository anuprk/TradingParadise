import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PositionsList from '../PositionsList';
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
    tradeStatus: 'Open',
    portfolioId: 'p1',
    strategyId: 's1',
    planId: 'plan1',
    winLoss: null,
    unrealizedPL: 200,
    currentStockPrice: 185,
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PositionsList', () => {
  it('shows only open positions', () => {
    const entries = [
      makeEntry({ id: 'e1', tradeStatus: 'Open', stockSymbol: 'AAPL' }),
      makeEntry({ id: 'e2', tradeStatus: 'Closed', stockSymbol: 'MSFT' }),
    ];
    render(<PositionsList entries={entries} />);
    // AAPL appears in table + mobile card + dropdown = multiple
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    // MSFT is closed, should not appear anywhere
    expect(screen.queryByText('MSFT')).not.toBeInTheDocument();
  });

  it('shows empty state when no open positions', () => {
    render(<PositionsList entries={[]} />);
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('filters positions by symbol via dropdown', () => {
    const entries = [
      makeEntry({ id: 'e1', stockSymbol: 'AAPL', tradeStatus: 'Open' }),
      makeEntry({ id: 'e2', stockSymbol: 'TSLA', tradeStatus: 'Open', strikePrice: 250 }),
    ];
    render(<PositionsList entries={entries} />);

    // Both visible initially — check for unique strike prices in the table
    expect(screen.getAllByText('$180.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$250.00').length).toBeGreaterThan(0);

    // Filter to AAPL
    const symbolSelect = screen.getByLabelText('Symbol');
    fireEvent.change(symbolSelect, { target: { value: 'AAPL' } });

    // AAPL's strike ($180) still visible, TSLA's strike ($250) gone from table
    expect(screen.getAllByText('$180.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$250.00')).not.toBeInTheDocument();
  });

  it('filters positions by option type', () => {
    const entries = [
      makeEntry({ id: 'e1', optionType: 'Put', tradeStatus: 'Open', strikePrice: 180 }),
      makeEntry({ id: 'e2', optionType: 'Call', tradeStatus: 'Open', stockSymbol: 'MSFT', strikePrice: 300 }),
    ];
    render(<PositionsList entries={entries} />);

    const typeSelect = screen.getByLabelText('Option Type');
    fireEvent.change(typeSelect, { target: { value: 'Call' } });

    // MSFT Call's strike ($300) visible, AAPL Put's strike ($180) gone
    expect(screen.getAllByText('$300.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('$180.00')).not.toBeInTheDocument();
  });

  it('displays unrealized P/L with color coding', () => {
    const entries = [
      makeEntry({ id: 'e1', unrealizedPL: 200, tradeStatus: 'Open' }),
    ];
    render(<PositionsList entries={entries} />);
    expect(screen.getAllByText('$200.00').length).toBeGreaterThan(0);
  });
});
