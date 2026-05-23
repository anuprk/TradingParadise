import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GoalsSection from '../GoalsSection';
import type { Goal } from '../../../types/tradingPlan';

const mockGoals: Goal[] = [
  { id: '1', description: 'Generate income', targetValue: '$5,000/month' },
  { id: '2', description: 'Grow account', targetValue: '20% annual return' },
];

describe('GoalsSection', () => {
  it('renders empty state when no goals exist', () => {
    const onChange = vi.fn();
    render(<GoalsSection goals={[]} onChange={onChange} />);
    expect(screen.getByText(/no goals defined yet/i)).toBeInTheDocument();
  });

  it('renders existing goals with description and target value', () => {
    const onChange = vi.fn();
    render(<GoalsSection goals={mockGoals} onChange={onChange} />);

    expect(screen.getByText('Generate income')).toBeInTheDocument();
    expect(screen.getByText('Target: $5,000/month')).toBeInTheDocument();
    expect(screen.getByText('Grow account')).toBeInTheDocument();
    expect(screen.getByText('Target: 20% annual return')).toBeInTheDocument();
  });

  it('adds a new goal when form is filled and Add Goal is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Description'), 'New goal');
    await user.type(screen.getByLabelText('Target Value'), '$10k');
    await user.click(screen.getByRole('button', { name: 'Add Goal' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newGoals = onChange.mock.calls[0][0] as Goal[];
    expect(newGoals).toHaveLength(1);
    expect(newGoals[0].description).toBe('New goal');
    expect(newGoals[0].targetValue).toBe('$10k');
    expect(newGoals[0].id).toBeTruthy();
  });

  it('disables Add Goal button when fields are empty', () => {
    const onChange = vi.fn();
    render(<GoalsSection goals={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Add Goal' })).toBeDisabled();
  });

  it('removes a goal when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={mockGoals} onChange={onChange} />);

    await user.click(
      screen.getByRole('button', { name: /remove goal: generate income/i }),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as Goal[];
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('2');
  });

  it('enters edit mode and saves changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={mockGoals} onChange={onChange} />);

    await user.click(
      screen.getByRole('button', { name: /edit goal: generate income/i }),
    );

    // Edit fields should appear with current values
    const descInput = screen.getByDisplayValue('Generate income');
    const targetInput = screen.getByDisplayValue('$5,000/month');
    expect(descInput).toBeInTheDocument();
    expect(targetInput).toBeInTheDocument();

    await user.clear(descInput);
    await user.type(descInput, 'Updated goal');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as Goal[];
    expect(updated[0].description).toBe('Updated goal');
    expect(updated[0].targetValue).toBe('$5,000/month');
  });

  it('cancels edit mode without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={mockGoals} onChange={onChange} />);

    await user.click(
      screen.getByRole('button', { name: /edit goal: generate income/i }),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Should be back to display mode
    expect(screen.getByText('Generate income')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add goal with empty description', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Target Value'), '$10k');
    // Button should still be disabled since description is empty
    expect(screen.getByRole('button', { name: 'Add Goal' })).toBeDisabled();
  });

  it('clears form fields after adding a goal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalsSection goals={[]} onChange={onChange} />);

    const descInput = screen.getByLabelText('Description');
    const targetInput = screen.getByLabelText('Target Value');

    await user.type(descInput, 'My goal');
    await user.type(targetInput, '$1000');
    await user.click(screen.getByRole('button', { name: 'Add Goal' }));

    expect(descInput).toHaveValue('');
    expect(targetInput).toHaveValue('');
  });

  it('renders goals list with accessible label', () => {
    const onChange = vi.fn();
    render(<GoalsSection goals={mockGoals} onChange={onChange} />);
    expect(screen.getByRole('list', { name: 'Goals list' })).toBeInTheDocument();
  });
});
