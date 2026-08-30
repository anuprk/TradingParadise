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
    // Date presets are buttons (query by role to avoid clashing with select options like "All").
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
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
