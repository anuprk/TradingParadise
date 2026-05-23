import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import AccountSizingSection from '../AccountSizingSection';
import type { AccountSizing, StrategyAllocation } from '../../../types/tradingPlan';

const emptyAccountSizing: AccountSizing = {
  totalAccountSize: 0,
  allocations: [],
};

const mockAllocations: StrategyAllocation[] = [
  { id: '1', categoryName: 'Core Income', allocationPercentage: 60 },
  { id: '2', categoryName: 'Speculative', allocationPercentage: 30 },
];

const mockAccountSizing: AccountSizing = {
  totalAccountSize: 100000,
  allocations: mockAllocations,
};

describe('AccountSizingSection', () => {
  it('renders empty state when no allocations exist', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={emptyAccountSizing} onChange={onChange} />);
    expect(screen.getByText(/no allocations defined yet/i)).toBeInTheDocument();
  });

  it('renders total account size input', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);
    expect(screen.getByLabelText(/total account size/i)).toHaveValue(100000);
  });

  it('updates total account size on change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={emptyAccountSizing} onChange={onChange} />);

    const input = screen.getByLabelText(/total account size/i);
    await user.type(input, '5');

    // onChange is called for each keystroke; check the first call
    expect(onChange).toHaveBeenCalled();
    const firstCall = onChange.mock.calls[0][0] as AccountSizing;
    expect(firstCall.totalAccountSize).toBe(5);
  });

  it('renders existing allocations with category name and percentage', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    expect(screen.getByText('Core Income')).toBeInTheDocument();
    expect(screen.getByText(/60%/)).toBeInTheDocument();
    expect(screen.getByText('Speculative')).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });

  it('displays calculated dollar amounts', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    // 60% of $100,000 = $60,000
    expect(screen.getByText(/\$60,000/)).toBeInTheDocument();
    // 30% of $100,000 = $30,000
    expect(screen.getByText(/\$30,000/)).toBeInTheDocument();
  });

  it('shows warning when allocations do not sum to 100%', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    // 60 + 30 = 90, not 100
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/90%.*expected 100%/i)).toBeInTheDocument();
  });

  it('does not show warning when allocations sum to 100%', () => {
    const onChange = vi.fn();
    const balanced: AccountSizing = {
      totalAccountSize: 100000,
      allocations: [
        { id: '1', categoryName: 'Core', allocationPercentage: 70 },
        { id: '2', categoryName: 'Spec', allocationPercentage: 30 },
      ],
    };
    render(<AccountSizingSection accountSizing={balanced} onChange={onChange} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('adds a new allocation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={emptyAccountSizing} onChange={onChange} />);

    await user.type(screen.getByLabelText('Category Name'), 'Growth');
    await user.type(screen.getByLabelText('Allocation %'), '40');
    await user.click(screen.getByRole('button', { name: 'Add Allocation' }));

    expect(onChange).toHaveBeenCalled();
    const result = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AccountSizing;
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].categoryName).toBe('Growth');
    expect(result.allocations[0].allocationPercentage).toBe(40);
    expect(result.allocations[0].id).toBeTruthy();
  });

  it('disables Add Allocation button when required fields are empty', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={emptyAccountSizing} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Add Allocation' })).toBeDisabled();
  });

  it('removes an allocation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove allocation: core income/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const result = onChange.mock.calls[0][0] as AccountSizing;
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].id).toBe('2');
  });

  it('enters edit mode and saves changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit allocation: core income/i }));

    const nameInput = screen.getByDisplayValue('Core Income');
    expect(nameInput).toBeInTheDocument();

    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Core');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalled();
    const result = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AccountSizing;
    expect(result.allocations[0].categoryName).toBe('Updated Core');
  });

  it('cancels edit mode without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit allocation: core income/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Core Income')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('displays optional numberOfPositions and positionSizing', () => {
    const onChange = vi.fn();
    const withOptionals: AccountSizing = {
      totalAccountSize: 100000,
      allocations: [
        {
          id: '1',
          categoryName: 'Core',
          allocationPercentage: 100,
          numberOfPositions: 5,
          positionSizing: '$10,000 per position',
        },
      ],
    };
    render(<AccountSizingSection accountSizing={withOptionals} onChange={onChange} />);

    expect(screen.getByText(/Positions: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Sizing: \$10,000 per position/)).toBeInTheDocument();
  });

  it('adds allocation with optional fields', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={emptyAccountSizing} onChange={onChange} />);

    await user.type(screen.getByLabelText('Category Name'), 'Income');
    await user.type(screen.getByLabelText('Allocation %'), '50');
    await user.type(screen.getByLabelText('Number of Positions'), '3');
    await user.type(screen.getByLabelText('Position Sizing'), '$5k each');
    await user.click(screen.getByRole('button', { name: 'Add Allocation' }));

    const result = onChange.mock.calls[onChange.mock.calls.length - 1][0] as AccountSizing;
    expect(result.allocations[0].numberOfPositions).toBe(3);
    expect(result.allocations[0].positionSizing).toBe('$5k each');
  });

  it('renders allocations list with accessible label', () => {
    const onChange = vi.fn();
    render(<AccountSizingSection accountSizing={mockAccountSizing} onChange={onChange} />);
    expect(screen.getByRole('list', { name: 'Allocations list' })).toBeInTheDocument();
  });
});
