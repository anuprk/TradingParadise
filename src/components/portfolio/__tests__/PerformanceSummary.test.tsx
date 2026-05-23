import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerformanceSummary from '../PerformanceSummary';
import type { PerformanceSummaryData } from '../../../types/transaction';

const zeroData: PerformanceSummaryData = {
  totalPortfolioValue: 0,
  totalRealizedPL: 0,
  totalUnrealizedPL: 0,
  overallReturnPercentage: 0,
  winRate: 0,
  totalTransactions: 0,
};

const positiveData: PerformanceSummaryData = {
  totalPortfolioValue: 52500,
  totalRealizedPL: 1500,
  totalUnrealizedPL: 1000,
  overallReturnPercentage: 5.0,
  winRate: 65.0,
  totalTransactions: 20,
};

const negativeData: PerformanceSummaryData = {
  totalPortfolioValue: 47000,
  totalRealizedPL: -2000,
  totalUnrealizedPL: -1000,
  overallReturnPercentage: -6.0,
  winRate: 40.0,
  totalTransactions: 10,
};

describe('PerformanceSummary', () => {
  it('renders all metric labels', () => {
    render(<PerformanceSummary data={positiveData} />);
    expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Realized P/L')).toBeInTheDocument();
    expect(screen.getByText('Unrealized P/L')).toBeInTheDocument();
    expect(screen.getByText('Overall Return')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
  });

  it('displays $0.00 and 0.0% when no transactions exist', () => {
    render(<PerformanceSummary data={zeroData} />);
    const zeroCurrencyValues = screen.getAllByText('$0.00');
    expect(zeroCurrencyValues.length).toBe(3); // total value, realized, unrealized
    const zeroPercentValues = screen.getAllByText('0.0%');
    expect(zeroPercentValues.length).toBe(2); // overall return + win rate
  });

  it('displays formatted positive values correctly', () => {
    render(<PerformanceSummary data={positiveData} />);
    expect(screen.getByText('$52,500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('65.0%')).toBeInTheDocument();
  });

  it('applies green color class for positive P/L values', () => {
    render(<PerformanceSummary data={positiveData} />);
    const realizedPL = screen.getByText('$1,500.00');
    expect(realizedPL).toHaveClass('text-success');
    const unrealizedPL = screen.getByText('$1,000.00');
    expect(unrealizedPL).toHaveClass('text-success');
    const overallReturn = screen.getByText('5.0%');
    expect(overallReturn).toHaveClass('text-success');
  });

  it('applies red color class for negative P/L values', () => {
    render(<PerformanceSummary data={negativeData} />);
    const realizedPL = screen.getByText('-$2,000.00');
    expect(realizedPL).toHaveClass('text-error');
    const unrealizedPL = screen.getByText('-$1,000.00');
    expect(unrealizedPL).toHaveClass('text-error');
    const overallReturn = screen.getByText('-6.0%');
    expect(overallReturn).toHaveClass('text-error');
  });

  it('applies neutral color class for zero P/L values', () => {
    render(<PerformanceSummary data={zeroData} />);
    const zeroCurrencyValues = screen.getAllByText('$0.00');
    // Realized P/L and Unrealized P/L should have neutral color
    zeroCurrencyValues.forEach((el) => {
      expect(el).toHaveClass('text-text-primary');
    });
  });

  it('does not color-code total portfolio value or win rate', () => {
    render(<PerformanceSummary data={positiveData} />);
    const totalValue = screen.getByText('$52,500.00');
    expect(totalValue).toHaveClass('text-text-primary');
    const winRate = screen.getByText('65.0%');
    expect(winRate).toHaveClass('text-text-primary');
  });
});
