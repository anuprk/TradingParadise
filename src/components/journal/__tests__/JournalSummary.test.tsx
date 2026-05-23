import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JournalSummary from '../JournalSummary';

describe('JournalSummary', () => {
  it('displays all summary metrics', () => {
    render(
      <JournalSummary
        summary={{ totalTrades: 10, winRate: 60, totalPL: 1500, avgPL: 150, totalFees: 25 }}
      />,
    );
    expect(screen.getByText('Total Trades')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Win Rate')).toBeInTheDocument();
    expect(screen.getByText('60.00%')).toBeInTheDocument();
    expect(screen.getByText('Total P/L')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('Avg P/L')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('Total Fees')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('handles zero trades gracefully', () => {
    render(
      <JournalSummary
        summary={{ totalTrades: 0, winRate: 0, totalPL: 0, avgPL: 0, totalFees: 0 }}
      />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.00%')).toBeInTheDocument();
  });
});
