import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import GreeksSection from '../GreeksSection';
import type { GreeksTarget } from '../../../types/tradingPlan';

const mockTargets: GreeksTarget[] = [
  { id: '1', metricName: 'Delta', targetDescription: 'Keep neutral', minValue: -5, maxValue: 5 },
  { id: '2', metricName: 'Theta', targetDescription: 'Positive theta', minValue: 0 },
];

describe('GreeksSection', () => {
  it('renders empty state when no targets exist', () => {
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);
    expect(screen.getByText(/no greeks targets defined yet/i)).toBeInTheDocument();
  });

  it('renders existing targets with metric name, description, and range', () => {
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);

    expect(screen.getByText('Delta')).toBeInTheDocument();
    expect(screen.getByText('Keep neutral')).toBeInTheDocument();
    expect(screen.getByText(/Range:.*-5.*to.*5/)).toBeInTheDocument();
    expect(screen.getByText('Theta')).toBeInTheDocument();
    expect(screen.getByText('Positive theta')).toBeInTheDocument();
  });

  it('adds a new target when form is filled and Add Target is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Metric Name'), 'Vega');
    await user.type(screen.getByLabelText('Target Description'), 'Low vega exposure');
    await user.type(screen.getByLabelText('Min Value (optional)'), '-10');
    await user.type(screen.getByLabelText('Max Value (optional)'), '10');
    await user.click(screen.getByRole('button', { name: 'Add Target' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newTargets = onChange.mock.calls[0][0] as GreeksTarget[];
    expect(newTargets).toHaveLength(1);
    expect(newTargets[0].metricName).toBe('Vega');
    expect(newTargets[0].targetDescription).toBe('Low vega exposure');
    expect(newTargets[0].minValue).toBe(-10);
    expect(newTargets[0].maxValue).toBe(10);
    expect(newTargets[0].id).toBeTruthy();
  });

  it('adds a target without optional min/max values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Metric Name'), 'Gamma');
    await user.type(screen.getByLabelText('Target Description'), 'Monitor gamma');
    await user.click(screen.getByRole('button', { name: 'Add Target' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newTargets = onChange.mock.calls[0][0] as GreeksTarget[];
    expect(newTargets[0].minValue).toBeUndefined();
    expect(newTargets[0].maxValue).toBeUndefined();
  });

  it('disables Add Target button when required fields are empty', () => {
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Add Target' })).toBeDisabled();
  });

  it('shows validation error when min > max and disables add', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Metric Name'), 'Delta');
    await user.type(screen.getByLabelText('Target Description'), 'Test');
    await user.type(screen.getByLabelText('Min Value (optional)'), '10');
    await user.type(screen.getByLabelText('Max Value (optional)'), '5');

    expect(screen.getByText('Min value must be less than or equal to max value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Target' })).toBeDisabled();
  });

  it('removes a target when Remove is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove target: delta/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as GreeksTarget[];
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('2');
  });

  it('enters edit mode and saves changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit target: delta/i }));

    const descInput = screen.getByDisplayValue('Keep neutral');
    expect(descInput).toBeInTheDocument();

    await user.clear(descInput);
    await user.type(descInput, 'Updated description');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as GreeksTarget[];
    expect(updated[0].targetDescription).toBe('Updated description');
    expect(updated[0].metricName).toBe('Delta');
  });

  it('cancels edit mode without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit target: delta/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Keep neutral')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows validation error in edit mode when min > max', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit target: delta/i }));

    const minInput = screen.getByDisplayValue('-5');
    const maxInput = screen.getByDisplayValue('5');

    await user.clear(minInput);
    await user.type(minInput, '100');
    await user.clear(maxInput);
    await user.type(maxInput, '1');

    expect(screen.getByText('Min value must be less than or equal to max value')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('clears form fields after adding a target', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Metric Name'), 'Delta');
    await user.type(screen.getByLabelText('Target Description'), 'Test');
    await user.click(screen.getByRole('button', { name: 'Add Target' }));

    expect(screen.getByLabelText('Metric Name')).toHaveValue('');
    expect(screen.getByLabelText('Target Description')).toHaveValue('');
  });

  it('renders targets list with accessible label', () => {
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={mockTargets} onChange={onChange} />);
    expect(screen.getByRole('list', { name: 'Greeks targets list' })).toBeInTheDocument();
  });

  it('allows custom metric names beyond Delta, Theta, Vega', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GreeksSection greeksTargets={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Metric Name'), 'Rho');
    await user.type(screen.getByLabelText('Target Description'), 'Interest rate sensitivity');
    await user.click(screen.getByRole('button', { name: 'Add Target' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newTargets = onChange.mock.calls[0][0] as GreeksTarget[];
    expect(newTargets[0].metricName).toBe('Rho');
  });
});
