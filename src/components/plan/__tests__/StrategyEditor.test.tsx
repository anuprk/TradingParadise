import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StrategyEditor from '../StrategyEditor';
import type { Strategy } from '../../../types/tradingPlan';

const mockOnSave = vi.fn();
const mockOnCancel = vi.fn();

function renderEditor(strategy: Strategy | null = null, classification: 'Core' | 'Speculative' = 'Core') {
  return render(
    <StrategyEditor
      strategy={strategy}
      classification={classification}
      onSave={mockOnSave}
      onCancel={mockOnCancel}
    />,
  );
}

const sampleStrategy: Strategy = {
  id: 'strat-1',
  name: 'Bear Trap',
  classification: 'Core',
  description: 'A core put selling strategy',
  variants: [{ id: 'v1', name: 'Standard', description: 'OTM version' }],
  entryCriteria: [{ id: 'ec1', parameterName: 'DTE', value: '45' }],
  managementRules: [{ id: 'mr1', triggerCondition: 'At 50% profit', actionDescription: 'Close' }],
  profitTargets: [{ id: 'pt1', targetValue: '50%', action: 'Close position' }],
  stopLosses: [{ id: 'sl1', stopValue: '200%', action: 'Roll or close' }],
};

describe('StrategyEditor', () => {
  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  it('renders Add Strategy title when creating', () => {
    renderEditor();
    expect(screen.getByText('Add Strategy')).toBeInTheDocument();
  });

  it('renders Edit Strategy title when editing', () => {
    renderEditor(sampleStrategy);
    expect(screen.getByText('Edit Strategy')).toBeInTheDocument();
  });

  it('populates fields when editing an existing strategy', () => {
    renderEditor(sampleStrategy);
    expect(screen.getByDisplayValue('Bear Trap')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A core put selling strategy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DTE')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45')).toBeInTheDocument();
  });

  it('shows validation errors when saving without entry criteria and management rules', async () => {
    const user = userEvent.setup();
    renderEditor();

    // Fill in name so we only test the sub-list validation
    await user.type(screen.getByPlaceholderText('e.g., 11x Bear Trap'), 'My Strategy');
    await user.click(screen.getByText('Save Strategy'));

    expect(screen.getByText('At least one entry criterion is required.')).toBeInTheDocument();
    expect(screen.getByText('At least one management rule is required.')).toBeInTheDocument();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('shows validation error when name is empty', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByText('Save Strategy'));
    expect(screen.getByText('Strategy name is required.')).toBeInTheDocument();
  });

  it('calls onSave with valid strategy data', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.type(screen.getByPlaceholderText('e.g., 11x Bear Trap'), 'Test Strategy');

    // Add entry criterion
    const addButtons = screen.getAllByText('+ Add');
    // Entry Criteria is the second sub-list (after Variants)
    await user.click(addButtons[1]);
    const paramInput = screen.getByPlaceholderText('Parameter (e.g., DTE)');
    await user.type(paramInput, 'DTE');
    const valueInput = screen.getByPlaceholderText('Value (e.g., 45 DTE)');
    await user.type(valueInput, '45');

    // Add management rule
    await user.click(addButtons[2]);
    const triggerInput = screen.getByPlaceholderText('Trigger condition');
    await user.type(triggerInput, 'At 50% profit');
    const actionInput = screen.getByPlaceholderText('Action');
    await user.type(actionInput, 'Close');

    await user.click(screen.getByText('Save Strategy'));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    const saved = mockOnSave.mock.calls[0][0] as Strategy;
    expect(saved.name).toBe('Test Strategy');
    expect(saved.classification).toBe('Core');
    expect(saved.entryCriteria).toHaveLength(1);
    expect(saved.managementRules).toHaveLength(1);
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('can add and remove variants', async () => {
    const user = userEvent.setup();
    renderEditor();

    const addButtons = screen.getAllByText('+ Add');
    // Variants is the first sub-list
    await user.click(addButtons[0]);
    expect(screen.getByPlaceholderText('Variant name')).toBeInTheDocument();

    // Remove it
    await user.click(screen.getByText('✕'));
    expect(screen.queryByPlaceholderText('Variant name')).not.toBeInTheDocument();
  });

  it('can add and remove profit targets', async () => {
    const user = userEvent.setup();
    renderEditor();

    const addButtons = screen.getAllByText('+ Add');
    // Profit Targets is the 4th sub-list (index 3)
    await user.click(addButtons[3]);
    expect(screen.getByPlaceholderText('Target (e.g., 50%)')).toBeInTheDocument();

    await user.click(screen.getByText('✕'));
    expect(screen.queryByPlaceholderText('Target (e.g., 50%)')).not.toBeInTheDocument();
  });

  it('can add and remove stop losses', async () => {
    const user = userEvent.setup();
    renderEditor();

    const addButtons = screen.getAllByText('+ Add');
    // Stop Losses is the 5th sub-list (index 4)
    await user.click(addButtons[4]);
    expect(screen.getByPlaceholderText('Stop (e.g., 200%)')).toBeInTheDocument();

    await user.click(screen.getByText('✕'));
    expect(screen.queryByPlaceholderText('Stop (e.g., 200%)')).not.toBeInTheDocument();
  });
});
