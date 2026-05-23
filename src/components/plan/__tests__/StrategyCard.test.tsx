import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import StrategyCard from '../StrategyCard';
import type { Strategy } from '../../../types/tradingPlan';

const sampleStrategy: Strategy = {
  id: 'strat-1',
  name: 'Bear Trap',
  classification: 'Core',
  description: 'A core put selling strategy',
  variants: [],
  entryCriteria: [
    { id: 'ec1', parameterName: 'DTE', value: '45' },
    { id: 'ec2', parameterName: 'Delta', value: '0.30' },
  ],
  managementRules: [{ id: 'mr1', triggerCondition: 'At 50%', actionDescription: 'Close' }],
  profitTargets: [{ id: 'pt1', targetValue: '50%', action: 'Close' }],
  stopLosses: [],
};

describe('StrategyCard', () => {
  it('displays strategy name and classification badge', () => {
    render(<StrategyCard strategy={sampleStrategy} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Bear Trap')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<StrategyCard strategy={sampleStrategy} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('A core put selling strategy')).toBeInTheDocument();
  });

  it('displays counts of sub-items', () => {
    render(<StrategyCard strategy={sampleStrategy} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Entry Criteria: 2')).toBeInTheDocument();
    expect(screen.getByText('Management Rules: 1')).toBeInTheDocument();
    expect(screen.getByText('Profit Targets: 1')).toBeInTheDocument();
    expect(screen.getByText('Stop Losses: 0')).toBeInTheDocument();
  });

  it('calls onEdit when Edit button is clicked', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<StrategyCard strategy={sampleStrategy} onEdit={onEdit} onRemove={vi.fn()} />);
    await user.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(sampleStrategy);
  });

  it('calls onRemove when Remove button is clicked', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(<StrategyCard strategy={sampleStrategy} onEdit={vi.fn()} onRemove={onRemove} />);
    await user.click(screen.getByText('Remove'));
    expect(onRemove).toHaveBeenCalledWith('strat-1');
  });

  it('shows Speculative badge variant for speculative strategies', () => {
    const specStrategy: Strategy = { ...sampleStrategy, classification: 'Speculative' };
    render(<StrategyCard strategy={specStrategy} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText('Speculative')).toBeInTheDocument();
  });
});
