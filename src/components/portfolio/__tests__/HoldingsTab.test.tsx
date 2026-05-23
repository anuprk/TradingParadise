import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HoldingsTab from '../HoldingsTab';
import type { Holding } from '../../../types/transaction';

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    symbol: 'AAPL',
    assetType: 'Stock',
    netQuantity: 100,
    averageCostBasis: 150.0,
    totalCostBasis: 15000.0,
    currentValue: 17500.0,
    unrealizedPL: 2500.0,
    ...overrides,
  };
}

describe('HoldingsTab', () => {
  it('shows empty state message when no holdings exist', () => {
    render(<HoldingsTab holdings={[]} />);
    expect(screen.getByText('No open positions')).toBeInTheDocument();
  });

  it('renders holdings table with correct columns', () => {
    const holdings = [makeHolding()];
    render(<HoldingsTab holdings={holdings} />);

    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Quantity')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost Basis')).toBeInTheDocument();
    expect(screen.getByText('Current Value')).toBeInTheDocument();
    expect(screen.getByText('Unrealized P/L')).toBeInTheDocument();
  });

  it('displays holding data correctly', () => {
    const holdings = [
      makeHolding({
        symbol: 'MSFT',
        netQuantity: 50,
        averageCostBasis: 300.0,
        currentValue: 16000.0,
        unrealizedPL: 1000.0,
      }),
    ];
    render(<HoldingsTab holdings={holdings} />);

    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByText('$16,000.00')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
  });

  it('sorts holdings by symbol ascending', () => {
    const holdings = [
      makeHolding({ symbol: 'TSLA', netQuantity: 10 }),
      makeHolding({ symbol: 'AAPL', netQuantity: 20 }),
      makeHolding({ symbol: 'MSFT', netQuantity: 30 }),
    ];
    render(<HoldingsTab holdings={holdings} />);

    const rows = screen.getAllByRole('row');
    // First row is header, data rows follow
    expect(rows[1]).toHaveTextContent('AAPL');
    expect(rows[2]).toHaveTextContent('MSFT');
    expect(rows[3]).toHaveTextContent('TSLA');
  });

  it('color-codes positive unrealized P/L in green', () => {
    const holdings = [makeHolding({ unrealizedPL: 500.0 })];
    render(<HoldingsTab holdings={holdings} />);

    const plCell = screen.getByText('$500.00');
    expect(plCell).toHaveClass('text-success');
  });

  it('color-codes negative unrealized P/L in red', () => {
    const holdings = [makeHolding({ unrealizedPL: -200.0 })];
    render(<HoldingsTab holdings={holdings} />);

    const plCell = screen.getByText('-$200.00');
    expect(plCell).toHaveClass('text-error');
  });

  it('uses neutral styling for zero unrealized P/L', () => {
    const holdings = [makeHolding({ unrealizedPL: 0 })];
    render(<HoldingsTab holdings={holdings} />);

    const plCell = screen.getByText('$0.00');
    expect(plCell).toHaveClass('text-text-primary');
    expect(plCell).not.toHaveClass('text-success');
    expect(plCell).not.toHaveClass('text-error');
  });

  it('renders multiple holdings correctly', () => {
    const holdings = [
      makeHolding({ symbol: 'AAPL', netQuantity: 100, unrealizedPL: 2500 }),
      makeHolding({ symbol: 'GOOGL', netQuantity: 25, unrealizedPL: -300 }),
      makeHolding({ symbol: 'TSLA', netQuantity: 50, unrealizedPL: 0 }),
    ];
    render(<HoldingsTab holdings={holdings} />);

    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('GOOGL')).toBeInTheDocument();
    expect(screen.getByText('TSLA')).toBeInTheDocument();
  });
});
