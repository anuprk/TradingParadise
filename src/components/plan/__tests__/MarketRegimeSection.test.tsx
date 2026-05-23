import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MarketRegimeSection from '../MarketRegimeSection';
import type { MarketRegime } from '../../../types/tradingPlan';

function makeRegimes(count: number): MarketRegime[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Regime ${i + 1}`,
    conditions: `Condition ${i + 1}`,
    strategyAdjustments: `Adjustment ${i + 1}`,
  }));
}

describe('MarketRegimeSection', () => {
  it('renders empty state when no regimes exist', () => {
    render(<MarketRegimeSection marketRegimes={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no market regimes defined yet/i)).toBeInTheDocument();
  });

  it('renders existing regimes with name, conditions, and adjustments', () => {
    const regimes = makeRegimes(3);
    render(<MarketRegimeSection marketRegimes={regimes} onChange={vi.fn()} />);
    expect(screen.getByText('Regime 1')).toBeInTheDocument();
    expect(screen.getByText('Conditions: Condition 2')).toBeInTheDocument();
    expect(screen.getByText('Adjustments: Adjustment 3')).toBeInTheDocument();
  });

  it('shows minimum info message when fewer than 3 regimes', () => {
    render(<MarketRegimeSection marketRegimes={makeRegimes(2)} onChange={vi.fn()} />);
    expect(screen.getByText(/at least 3 market regimes are required/i)).toBeInTheDocument();
  });

  it('does not show minimum info message when 3 or more regimes', () => {
    render(<MarketRegimeSection marketRegimes={makeRegimes(3)} onChange={vi.fn()} />);
    expect(screen.queryByText(/at least 3 market regimes are required/i)).not.toBeInTheDocument();
  });

  it('adds a new market regime', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MarketRegimeSection marketRegimes={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText('Regime Name'), 'Bullish');
    await user.type(screen.getByLabelText('Conditions'), 'SPX above 200 SMA');
    await user.type(screen.getByLabelText('Strategy Adjustments'), 'Increase put selling');
    await user.click(screen.getByRole('button', { name: 'Add Regime' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as MarketRegime[];
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe('Bullish');
    expect(updated[0].conditions).toBe('SPX above 200 SMA');
    expect(updated[0].strategyAdjustments).toBe('Increase put selling');
  });

  it('disables Add Regime button when fields are empty', () => {
    render(<MarketRegimeSection marketRegimes={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add Regime' })).toBeDisabled();
  });

  it('removes a regime', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const regimes = makeRegimes(3);
    render(<MarketRegimeSection marketRegimes={regimes} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /remove regime: regime 2/i }));

    const updated = onChange.mock.calls[0][0] as MarketRegime[];
    expect(updated).toHaveLength(2);
    expect(updated[0].name).toBe('Regime 1');
    expect(updated[1].name).toBe('Regime 3');
  });

  it('edits a regime', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const regimes = makeRegimes(1);
    render(<MarketRegimeSection marketRegimes={regimes} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit regime: regime 1/i }));
    const nameInput = screen.getByDisplayValue('Regime 1');
    await user.clear(nameInput);
    await user.type(nameInput, 'Bearish');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const updated = onChange.mock.calls[0][0] as MarketRegime[];
    expect(updated[0].name).toBe('Bearish');
    expect(updated[0].conditions).toBe('Condition 1');
    expect(updated[0].strategyAdjustments).toBe('Adjustment 1');
  });

  it('cancels edit without saving', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const regimes = makeRegimes(1);
    render(<MarketRegimeSection marketRegimes={regimes} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /edit regime: regime 1/i }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Regime 1')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows max warning and disables add at 10 regimes', () => {
    const regimes = makeRegimes(10);
    render(<MarketRegimeSection marketRegimes={regimes} onChange={vi.fn()} />);
    expect(screen.getByText(/maximum of 10 market regimes reached/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Regime' })).toBeDisabled();
  });

  it('does not show max warning when under 10 regimes', () => {
    render(<MarketRegimeSection marketRegimes={makeRegimes(9)} onChange={vi.fn()} />);
    expect(screen.queryByText(/maximum of 10 market regimes reached/i)).not.toBeInTheDocument();
  });
});
