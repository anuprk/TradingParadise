import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StrategyImporter from '../StrategyImporter';
import type { Strategy } from '../../../types/tradingPlan';
import { getCategories, getTemplatesByCategory } from '../../../data/strategyLibrary';

// Mock uuid to produce predictable IDs in tests
vi.mock('uuid', () => ({
  v4: (() => {
    let counter = 0;
    return () => `test-uuid-${++counter}`;
  })(),
}));

function makeStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 'existing-1',
    name: 'Iron Condor',
    classification: 'Core',
    description: 'Existing iron condor strategy',
    entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30 days' }],
    managementRules: [{ id: 'mr-1', triggerCondition: 'Test', actionDescription: 'Test action' }],
    profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
    stopLosses: [{ id: 'sl-1', stopValue: '2x', action: 'Close' }],
    ...overrides,
  };
}

describe('StrategyImporter', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    existingStrategies: [] as Strategy[],
    onImport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renders categories and strategy checkboxes', () => {
    it('displays all strategy categories', () => {
      render(<StrategyImporter {...defaultProps} />);

      const categories = getCategories();
      for (const category of categories) {
        expect(screen.getByRole('button', { name: `${category.name} category` })).toBeInTheDocument();
      }
    });

    it('shows strategy checkboxes when a category is expanded', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      // Expand the "Directional" category
      await user.click(screen.getByRole('button', { name: 'Directional category' }));

      // Should show the templates in that category
      const templates = getTemplatesByCategory('directional');
      for (const template of templates) {
        expect(screen.getByLabelText(`Select ${template.name}`)).toBeInTheDocument();
      }
    });

    it('shows strategy name, classification badge, and description in expanded category', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));

      expect(screen.getByText('Long Call')).toBeInTheDocument();
      // Both Long Call and Long Put are Speculative, so multiple badges exist
      const badges = screen.getAllByText('Speculative');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('multi-select and Select All per category', () => {
    it('allows selecting individual strategies', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));

      expect(screen.getByText('1 strategy selected')).toBeInTheDocument();
    });

    it('allows selecting multiple strategies across categories', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      // Expand and select from Directional
      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));
      await user.click(screen.getByLabelText('Select Long Put'));

      expect(screen.getByText('2 strategies selected')).toBeInTheDocument();
    });

    it('Select All selects all strategies in a category', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      // Expand Directional category
      await user.click(screen.getByRole('button', { name: 'Directional category' }));

      // Click Select All for Directional
      await user.click(screen.getByLabelText('Select all in Directional'));

      const templates = getTemplatesByCategory('directional');
      expect(screen.getByText(`${templates.length} strategies selected`)).toBeInTheDocument();

      // Verify all checkboxes are checked
      for (const template of templates) {
        expect(screen.getByLabelText(`Select ${template.name}`)).toBeChecked();
      }
    });

    it('Deselect All deselects all strategies in a category', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select all in Directional'));

      // Now deselect all
      await user.click(screen.getByLabelText('Deselect all in Directional'));

      const templates = getTemplatesByCategory('directional');
      for (const template of templates) {
        expect(screen.getByLabelText(`Select ${template.name}`)).not.toBeChecked();
      }
      expect(screen.getByText('0 strategies selected')).toBeInTheDocument();
    });

    it('shows selected count badge on category header', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));

      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });
  });

  describe('duplicate conflict UI', () => {
    it('shows duplicate resolution step when conflicts exist', async () => {
      const user = userEvent.setup();
      const existingStrategies = [makeStrategy({ name: 'Long Call' })];

      render(<StrategyImporter {...defaultProps} existingStrategies={existingStrategies} />);

      // Select the conflicting strategy
      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));

      // Click Continue
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Should show duplicate resolution UI - use getAllByText since the text appears in multiple elements
      const existTexts = screen.getAllByText(/already exist/i);
      expect(existTexts.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Skip')).toBeInTheDocument();
      expect(screen.getByText('Import as Copy')).toBeInTheDocument();
      expect(screen.getByText('Replace Existing')).toBeInTheDocument();
    });

    it('skips duplicate step when no conflicts exist', async () => {
      const user = userEvent.setup();
      render(<StrategyImporter {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Should go directly to confirm step
      expect(screen.getByText(/Review the import summary/i)).toBeInTheDocument();
    });

    it('allows choosing resolution per conflict', async () => {
      const user = userEvent.setup();
      const existingStrategies = [makeStrategy({ name: 'Long Call' })];

      render(<StrategyImporter {...defaultProps} existingStrategies={existingStrategies} />);

      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Default is Skip - click Replace Existing
      const replaceBtn = screen.getByText('Replace Existing');
      await user.click(replaceBtn);

      expect(replaceBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('confirm dispatches correct strategies to onImport', () => {
    it('calls onImport with selected strategies on confirm', async () => {
      const user = userEvent.setup();
      const onImport = vi.fn();

      render(<StrategyImporter {...defaultProps} onImport={onImport} />);

      // Select a strategy
      await user.click(screen.getByRole('button', { name: 'Directional category' }));
      await user.click(screen.getByLabelText('Select Long Call'));

      // Continue to confirm
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Confirm import
      await user.click(screen.getByRole('button', { name: /Import 1 Strategy/i }));

      expect(onImport).toHaveBeenCalledTimes(1);
      const [toAdd, toReplace] = onImport.mock.calls[0];
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0].name).toBe('Long Call');
      expect(toAdd[0].id).toBeTruthy();
      expect(toReplace).toHaveLength(0);
    });

    it('handles replace resolution correctly', async () => {
      const user = userEvent.setup();
      const onImport = vi.fn();
      const existingStrategies = [makeStrategy({ id: 'existing-ic', name: 'Iron Condor' })];

      render(
        <StrategyImporter
          {...defaultProps}
          onImport={onImport}
          existingStrategies={existingStrategies}
        />,
      );

      // Select Iron Condor (which conflicts)
      await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
      await user.click(screen.getByLabelText('Select Iron Condor'));

      // Continue to duplicates step
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Choose Replace
      await user.click(screen.getByText('Replace Existing'));

      // Continue to confirm
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Confirm import
      await user.click(screen.getByRole('button', { name: /Import 1 Strategy/i }));

      expect(onImport).toHaveBeenCalledTimes(1);
      const [toAdd, toReplace] = onImport.mock.calls[0];
      expect(toAdd).toHaveLength(0);
      expect(toReplace).toHaveLength(1);
      expect(toReplace[0].name).toBe('Iron Condor');
      expect(toReplace[0].id).toBe('existing-ic');
    });

    it('handles skip resolution by not importing the conflicting strategy', async () => {
      const user = userEvent.setup();
      const onImport = vi.fn();
      const existingStrategies = [makeStrategy({ id: 'existing-ic', name: 'Iron Condor' })];

      render(
        <StrategyImporter
          {...defaultProps}
          onImport={onImport}
          existingStrategies={existingStrategies}
        />,
      );

      // Select Iron Condor and Iron Butterfly
      await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
      await user.click(screen.getByLabelText('Select Iron Condor'));
      await user.click(screen.getByLabelText('Select Iron Butterfly'));

      // Continue to duplicates step (Iron Condor conflicts)
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Default resolution is Skip - just continue
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Confirm import (only Iron Butterfly should be added)
      await user.click(screen.getByRole('button', { name: /Import 1 Strategy/i }));

      expect(onImport).toHaveBeenCalledTimes(1);
      const [toAdd, toReplace] = onImport.mock.calls[0];
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0].name).toBe('Iron Butterfly');
      expect(toReplace).toHaveLength(0);
    });

    it('handles rename resolution by importing with suffix', async () => {
      const user = userEvent.setup();
      const onImport = vi.fn();
      const existingStrategies = [makeStrategy({ id: 'existing-ic', name: 'Iron Condor' })];

      render(
        <StrategyImporter
          {...defaultProps}
          onImport={onImport}
          existingStrategies={existingStrategies}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
      await user.click(screen.getByLabelText('Select Iron Condor'));

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Choose Import as Copy (rename)
      await user.click(screen.getByText('Import as Copy'));

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await user.click(screen.getByRole('button', { name: /Import 1 Strategy/i }));

      expect(onImport).toHaveBeenCalledTimes(1);
      const [toAdd, toReplace] = onImport.mock.calls[0];
      expect(toAdd).toHaveLength(1);
      expect(toAdd[0].name).toBe('Iron Condor (Imported)');
      expect(toReplace).toHaveLength(0);
    });

    it('disables confirm button when no strategies will be imported', async () => {
      const user = userEvent.setup();
      const existingStrategies = [makeStrategy({ name: 'Iron Condor' })];

      render(
        <StrategyImporter {...defaultProps} existingStrategies={existingStrategies} />,
      );

      // Select only the conflicting strategy
      await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
      await user.click(screen.getByLabelText('Select Iron Condor'));

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Default is Skip - continue to confirm
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // The import button should be disabled since everything is skipped
      const importBtn = screen.getByRole('button', { name: /Import 0 Strateg/i });
      expect(importBtn).toBeDisabled();
    });

    it('does not render when isOpen is false', () => {
      render(<StrategyImporter {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Import Default Strategies')).not.toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<StrategyImporter {...defaultProps} onClose={onClose} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
