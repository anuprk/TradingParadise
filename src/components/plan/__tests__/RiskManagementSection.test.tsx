import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RiskManagementSection from '../RiskManagementSection';
import type { RiskManagement } from '../../../types/tradingPlan';

function emptyRM(): RiskManagement {
  return {
    bpThresholds: [],
    positionLimits: [],
  };
}

function rmWithThresholds(): RiskManagement {
  return {
    bpThresholds: [
      { id: '1', percentage: 25, actionDescription: 'Monitor closely' },
      { id: '2', percentage: 50, actionDescription: 'Reduce positions' },
      { id: '3', percentage: 75, actionDescription: 'Stop new trades' },
    ],
    positionLimits: [],
  };
}

function rmWithLimits(): RiskManagement {
  return {
    bpThresholds: [],
    positionLimits: [
      { id: '1', strategyName: 'Iron Condor', maxPositions: 5, maxPerUnderlying: 2 },
    ],
  };
}

describe('RiskManagementSection', () => {
  describe('BP Thresholds', () => {
    it('renders empty state when no thresholds exist', () => {
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={vi.fn()} />);
      expect(screen.getByText(/no bp thresholds defined yet/i)).toBeInTheDocument();
    });

    it('renders existing thresholds in order', () => {
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={vi.fn()} />);
      expect(screen.getByText('25% BP Usage')).toBeInTheDocument();
      expect(screen.getByText('50% BP Usage')).toBeInTheDocument();
      expect(screen.getByText('75% BP Usage')).toBeInTheDocument();
    });

    it('adds a new threshold and auto-sorts into ascending order', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const rm = rmWithThresholds();
      render(<RiskManagementSection riskManagement={rm} onChange={onChange} />);

      await user.type(screen.getByLabelText('Percentage (%)'), '40');
      await user.type(screen.getByLabelText('Action Description'), 'Review risk');
      await user.click(screen.getByRole('button', { name: 'Add Threshold' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      const pcts = updated.bpThresholds.map((t) => t.percentage);
      expect(pcts).toEqual([25, 40, 50, 75]);
    });

    it('shows validation error for duplicate percentage', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={onChange} />);

      await user.type(screen.getByLabelText('Percentage (%)'), '50');
      await user.type(screen.getByLabelText('Action Description'), 'Duplicate test');
      await user.click(screen.getByRole('button', { name: 'Add Threshold' }));

      expect(screen.getByText('A threshold with this percentage already exists')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('removes a threshold', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /remove threshold: 50%/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      expect(updated.bpThresholds).toHaveLength(2);
      expect(updated.bpThresholds.map((t) => t.percentage)).toEqual([25, 75]);
    });

    it('edits a threshold and re-sorts', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /edit threshold: 25%/i }));

      const pctInput = screen.getByDisplayValue('25');
      await user.clear(pctInput);
      await user.type(pctInput, '60');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      const pcts = updated.bpThresholds.map((t) => t.percentage);
      expect(pcts).toEqual([50, 60, 75]);
    });

    it('shows duplicate error when editing to an existing percentage', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /edit threshold: 25%/i }));

      const pctInput = screen.getByDisplayValue('25');
      await user.clear(pctInput);
      await user.type(pctInput, '50');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('A threshold with this percentage already exists')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('cancels edit without saving', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithThresholds()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /edit threshold: 25%/i }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByText('25% BP Usage')).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('disables Add Threshold button when fields are empty', () => {
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Add Threshold' })).toBeDisabled();
    });
  });

  describe('Position Limits', () => {
    it('renders empty state when no limits exist', () => {
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={vi.fn()} />);
      expect(screen.getByText(/no position limits defined yet/i)).toBeInTheDocument();
    });

    it('renders existing position limits', () => {
      render(<RiskManagementSection riskManagement={rmWithLimits()} onChange={vi.fn()} />);
      expect(screen.getByText('Iron Condor')).toBeInTheDocument();
      expect(screen.getByText(/Max positions: 5/)).toBeInTheDocument();
      expect(screen.getByText(/Max per underlying: 2/)).toBeInTheDocument();
    });

    it('adds a new position limit', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={onChange} />);

      await user.type(screen.getByLabelText('Strategy Name'), 'Covered Call');
      await user.type(screen.getByLabelText('Max Positions'), '3');
      await user.type(screen.getByLabelText('Max Per Underlying'), '1');
      await user.click(screen.getByRole('button', { name: 'Add Limit' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      expect(updated.positionLimits).toHaveLength(1);
      expect(updated.positionLimits[0].strategyName).toBe('Covered Call');
      expect(updated.positionLimits[0].maxPositions).toBe(3);
      expect(updated.positionLimits[0].maxPerUnderlying).toBe(1);
    });

    it('removes a position limit', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithLimits()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /remove limit: iron condor/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      expect(updated.positionLimits).toHaveLength(0);
    });

    it('edits a position limit', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rmWithLimits()} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /edit limit: iron condor/i }));

      const strategyInput = screen.getByDisplayValue('Iron Condor');
      await user.clear(strategyInput);
      await user.type(strategyInput, 'Bull Put Spread');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const updated = onChange.mock.calls[0][0] as RiskManagement;
      expect(updated.positionLimits[0].strategyName).toBe('Bull Put Spread');
    });

    it('disables Add Limit button when fields are empty', () => {
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Add Limit' })).toBeDisabled();
    });
  });

  describe('Max Loss Thresholds', () => {
    it('renders max loss inputs', () => {
      render(<RiskManagementSection riskManagement={emptyRM()} onChange={vi.fn()} />);
      expect(screen.getByLabelText('Max Loss Per Trade ($)')).toBeInTheDocument();
      expect(screen.getByLabelText('Max Loss Per Portfolio ($)')).toBeInTheDocument();
    });

    it('updates max loss per trade', async () => {
      const user = userEvent.setup();
      const rm = emptyRM();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rm} onChange={onChange} />);

      await user.type(screen.getByLabelText('Max Loss Per Trade ($)'), '5');

      expect(onChange).toHaveBeenCalled();
      // Each keystroke fires onChange; the single-digit "5" parses to 5
      const call = onChange.mock.calls[0][0] as RiskManagement;
      expect(call.maxLossPerTrade).toBe(5);
    });

    it('updates max loss per portfolio', async () => {
      const user = userEvent.setup();
      const rm = emptyRM();
      const onChange = vi.fn();
      render(<RiskManagementSection riskManagement={rm} onChange={onChange} />);

      await user.type(screen.getByLabelText('Max Loss Per Portfolio ($)'), '8');

      expect(onChange).toHaveBeenCalled();
      const call = onChange.mock.calls[0][0] as RiskManagement;
      expect(call.maxLossPerPortfolio).toBe(8);
    });

    it('displays existing max loss values', () => {
      const rm: RiskManagement = {
        bpThresholds: [],
        positionLimits: [],
        maxLossPerTrade: 1000,
        maxLossPerPortfolio: 10000,
      };
      render(<RiskManagementSection riskManagement={rm} onChange={vi.fn()} />);
      expect(screen.getByLabelText('Max Loss Per Trade ($)')).toHaveValue(1000);
      expect(screen.getByLabelText('Max Loss Per Portfolio ($)')).toHaveValue(10000);
    });
  });
});
