import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PerformanceChart from '../PerformanceChart';
import type { MonthlyReturn } from '../../../types/portfolio';

// Recharts uses ResizeObserver internally — stub it for jsdom
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const sampleReturns: MonthlyReturn[] = [
  { month: '2025-01', dollarReturn: 500, percentageReturn: 1.0 },
  { month: '2025-02', dollarReturn: -200, percentageReturn: -0.4 },
  { month: '2025-03', dollarReturn: 300, percentageReturn: 0.6 },
  { month: '2025-04', dollarReturn: 100, percentageReturn: 0.2 },
  { month: '2025-05', dollarReturn: 400, percentageReturn: 0.8 },
  { month: '2025-06', dollarReturn: -100, percentageReturn: -0.2 },
  { month: '2025-07', dollarReturn: 250, percentageReturn: 0.5 },
];

describe('PerformanceChart', () => {
  it('renders empty state when no monthly returns', () => {
    render(<PerformanceChart monthlyReturns={[]} initialBalance={50000} />);
    expect(screen.getByText('No performance data available')).toBeInTheDocument();
  });

  it('renders chart title and time period buttons', () => {
    render(<PerformanceChart monthlyReturns={sampleReturns} initialBalance={50000} />);
    expect(screen.getByText('Performance Chart')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
  });

  it('highlights the active period button', () => {
    render(<PerformanceChart monthlyReturns={sampleReturns} initialBalance={50000} />);
    const allBtn = screen.getByText('All');
    // Default is "All" — should have the active class
    expect(allBtn.className).toContain('bg-blue-600');
    expect(screen.getByText('3M').className).toContain('bg-surface-tertiary');
  });

  it('switches active period on click', () => {
    render(<PerformanceChart monthlyReturns={sampleReturns} initialBalance={50000} />);
    const btn3M = screen.getByText('3M');
    fireEvent.click(btn3M);
    expect(btn3M.className).toContain('bg-blue-600');
    expect(screen.getByText('All').className).toContain('bg-surface-tertiary');
  });
});
