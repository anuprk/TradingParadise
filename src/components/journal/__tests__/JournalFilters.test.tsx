import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JournalFilters from '../JournalFilters';
import type { Strategy } from '../../../types/tradingPlan';
import type { Portfolio } from '../../../types/portfolio';

const strategies: Strategy[] = [
  {
    id: 's1',
    name: 'Iron Condor',
    classification: 'Core',
    description: '',
    entryCriteria: [],
    managementRules: [],
    profitTargets: [],
    stopLosses: [],
  },
];

const portfolios: Portfolio[] = [
  {
    id: 'p1',
    name: 'Main Account',
    description: '',
    initialBalance: 100000,
    planId: 'plan1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('JournalFilters', () => {
  it('renders all filter controls', () => {
    render(
      <JournalFilters
        strategies={strategies}
        portfolios={portfolios}
        filters={{}}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Strategy')).toBeInTheDocument();
    expect(screen.getByLabelText('Account')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByLabelText('Symbol')).toBeInTheDocument();
    expect(screen.getByLabelText('Option Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Win/Loss')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('populates strategy and portfolio options', () => {
    render(
      <JournalFilters
        strategies={strategies}
        portfolios={portfolios}
        filters={{}}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Iron Condor')).toBeInTheDocument();
    expect(screen.getByText('Main Account')).toBeInTheDocument();
  });

  it('calls onFilterChange when strategy changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <JournalFilters
        strategies={strategies}
        portfolios={portfolios}
        filters={{}}
        onFilterChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Strategy'), 's1');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ strategyId: 's1' }));
  });

  it('calls onFilterChange when symbol is typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <JournalFilters
        strategies={strategies}
        portfolios={portfolios}
        filters={{}}
        onFilterChange={onChange}
      />,
    );
    await user.type(screen.getByLabelText('Symbol'), 'A');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stockSymbol: 'A' }));
  });

  it('clears filters when Clear Filters is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <JournalFilters
        strategies={strategies}
        portfolios={portfolios}
        filters={{ planId: 'plan1', strategyId: 's1', stockSymbol: 'AAPL' }}
        onFilterChange={onChange}
      />,
    );
    await user.click(screen.getByText('Clear Filters'));
    expect(onChange).toHaveBeenCalledWith({ planId: 'plan1' });
  });
});
