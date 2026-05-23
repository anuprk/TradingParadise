import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerformanceMetrics from '../PerformanceMetrics';
import type { PortfolioMetrics } from '../../../types/portfolio';

const baseMetrics: PortfolioMetrics = {
  netLiquidation: 55000,
  totalRealizedPL: 3000,
  totalUnrealizedPL: 500,
  totalPL: 3500,
  monthlyReturns: [
    { month: '2025-01', dollarReturn: 1200, percentageReturn: 2.4 },
    { month: '2025-02', dollarReturn: -300, percentageReturn: -0.6 },
  ],
  maxDrawdown: 800,
  cumulativeReturn: 6.0,
  winRate: 72.5,
  averageTradeReturn: 150,
  totalTrades: 20,
};

describe('PerformanceMetrics', () => {
  it('renders all summary stats', () => {
    render(<PerformanceMetrics metrics={baseMetrics} />);
    expect(screen.getByText('Cumulative Return')).toBeInTheDocument();
    expect(screen.getByText('6.00%')).toBeInTheDocument();
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument();
    expect(screen.getByText('$800.00')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('72.50%')).toBeInTheDocument();
    expect(screen.getByText('Avg Trade Return')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('Total Trades')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders monthly returns table', () => {
    render(<PerformanceMetrics metrics={baseMetrics} />);
    expect(screen.getByText('Monthly Returns')).toBeInTheDocument();
    expect(screen.getByText('2025-01')).toBeInTheDocument();
    expect(screen.getByText('$1,200.00')).toBeInTheDocument();
    expect(screen.getByText('2.40%')).toBeInTheDocument();
    expect(screen.getByText('2025-02')).toBeInTheDocument();
  });

  it('hides monthly returns table when empty', () => {
    const noMonthly = { ...baseMetrics, monthlyReturns: [] };
    render(<PerformanceMetrics metrics={noMonthly} />);
    expect(screen.queryByText('Monthly Returns')).not.toBeInTheDocument();
  });
});
