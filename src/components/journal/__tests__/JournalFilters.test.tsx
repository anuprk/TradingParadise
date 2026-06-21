import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JournalFilters from '../JournalFilters';

describe('JournalFilters', () => {
  it('renders symbol filter and date presets', () => {
    render(
      <JournalFilters
        symbols={['AAPL', 'MSFT']}
        filters={{}}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders status checkboxes', () => {
    render(
      <JournalFilters
        symbols={[]}
        filters={{ tradeStatus: ['Open'] }}
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Open')).toBeInTheDocument();
    expect(screen.getByLabelText('Closed')).toBeInTheDocument();
    expect(screen.getByLabelText('Expired')).toBeInTheDocument();
    expect(screen.getByLabelText('Assigned')).toBeInTheDocument();
  });

  it('calls onFilterChange when symbol changes', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <JournalFilters
        symbols={['AAPL', 'MSFT']}
        filters={{}}
        onFilterChange={onChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('Symbol'), 'AAPL');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stockSymbol: 'AAPL' }));
  });
});
