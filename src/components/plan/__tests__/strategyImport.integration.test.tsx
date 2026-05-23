/**
 * Integration tests for strategy import and plan creation flows.
 *
 * Tests:
 * 1. Plan creation with defaults: verify strategies appear in correct arrays (Core/Speculative)
 * 2. Import into existing plan: open importer, select, confirm, verify plan state
 * 3. Imported strategy is editable via StrategyEditor
 *
 * Requirements: 3.1, 3.2, 4.1, 4.4, 5.1, 5.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { act } from '@testing-library/react';

import { usePlanStore } from '../../../stores/planStore';
import { useAppStore } from '../../../stores/appStore';
import { getAllTemplates } from '../../../data/strategyLibrary';
import { instantiateTemplates } from '../../../utils/strategyInstantiator';
import type { TradingPlan, Strategy } from '../../../types/tradingPlan';
import StrategyImporter from '../StrategyImporter';
import StrategyEditor from '../StrategyEditor';

// --- Supabase mock (prevents real network calls) ---

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => {
      const chain: Record<string, any> = {};
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.update = vi.fn(() => chain);
      chain.delete = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() => chain);
      chain.limit = vi.fn(() => chain);
      chain.single = vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null }));
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
      chain.then = (resolve: any) => resolve({ data: [], error: null, count: 0 });
      return chain;
    }),
  },
}));

// --- Helpers ---

function createTestPlan(overrides: Partial<TradingPlan> = {}): TradingPlan {
  const now = new Date();
  return {
    id: 'plan-test-1',
    name: 'Test Plan',
    author: 'Tester',
    year: 2024,
    createdAt: now,
    updatedAt: now,
    goals: [],
    greeksTargets: [],
    riskManagement: { bpThresholds: [], positionLimits: [] },
    tradeRules: [],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [],
    marketRegimes: [],
    accountSizing: { totalAccountSize: 100000, allocations: [] },
    coreStrategies: [],
    speculativeStrategies: [],
    ...overrides,
  };
}

function resetStores() {
  usePlanStore.setState({
    currentPlan: null,
    plans: [],
    isDirty: false,
    isLoading: false,
  });
  useAppStore.setState({ activePlanId: null, toasts: [] });
}

// --- Tests ---

describe('Integration: Plan creation with default strategies', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('populates coreStrategies and speculativeStrategies correctly when including defaults', () => {
    // Simulate what PlanEditor.handleIncludeDefaults does
    const templates = getAllTemplates();
    const instantiated = instantiateTemplates(templates);
    const core = instantiated.filter((s) => s.classification === 'Core');
    const speculative = instantiated.filter((s) => s.classification === 'Speculative');

    const plan = createTestPlan({ coreStrategies: core, speculativeStrategies: speculative });
    usePlanStore.setState({ currentPlan: plan, isDirty: true });

    const state = usePlanStore.getState();
    expect(state.currentPlan).not.toBeNull();

    // All 20 templates should be instantiated
    expect(state.currentPlan!.coreStrategies.length + state.currentPlan!.speculativeStrategies.length).toBe(20);

    // Core strategies should all have classification 'Core'
    for (const s of state.currentPlan!.coreStrategies) {
      expect(s.classification).toBe('Core');
      expect(s.id).toBeTruthy();
    }

    // Speculative strategies should all have classification 'Speculative'
    for (const s of state.currentPlan!.speculativeStrategies) {
      expect(s.classification).toBe('Speculative');
      expect(s.id).toBeTruthy();
    }
  });

  it('places specific known strategies in the correct arrays', () => {
    const templates = getAllTemplates();
    const instantiated = instantiateTemplates(templates);
    const core = instantiated.filter((s) => s.classification === 'Core');
    const speculative = instantiated.filter((s) => s.classification === 'Speculative');

    const plan = createTestPlan({ coreStrategies: core, speculativeStrategies: speculative });
    usePlanStore.setState({ currentPlan: plan });

    const state = usePlanStore.getState();
    const coreNames = state.currentPlan!.coreStrategies.map((s) => s.name);
    const specNames = state.currentPlan!.speculativeStrategies.map((s) => s.name);

    // Known Core strategies
    expect(coreNames).toContain('Iron Condor');
    expect(coreNames).toContain('Covered Call');
    expect(coreNames).toContain('Short Put');
    expect(coreNames).toContain('Bull Put Spread');
    expect(coreNames).toContain('Bear Call Spread');

    // Known Speculative strategies
    expect(specNames).toContain('Long Call');
    expect(specNames).toContain('Long Put');
    expect(specNames).toContain('Short Call');
    expect(specNames).toContain('Long Straddle');
    expect(specNames).toContain('Ratio Spread');

    // No overlap
    for (const name of coreNames) {
      expect(specNames).not.toContain(name);
    }
  });

  it('generates unique IDs for all instantiated strategies', () => {
    const templates = getAllTemplates();
    const instantiated = instantiateTemplates(templates);

    const ids = instantiated.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('leaves strategy arrays empty when starting empty', () => {
    const plan = createTestPlan();
    usePlanStore.setState({ currentPlan: plan });

    const state = usePlanStore.getState();
    expect(state.currentPlan!.coreStrategies).toHaveLength(0);
    expect(state.currentPlan!.speculativeStrategies).toHaveLength(0);
  });
});

describe('Integration: Import into existing plan', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('imports selected strategies into the plan store via the importer flow', async () => {
    const user = userEvent.setup();

    // Set up an existing plan with one strategy
    const existingStrategy: Strategy = {
      id: 'existing-1',
      name: 'My Custom Strategy',
      classification: 'Core',
      description: 'A custom strategy',
      entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30' }],
      managementRules: [{ id: 'mr-1', triggerCondition: 'Test', actionDescription: 'Close' }],
      profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
      stopLosses: [{ id: 'sl-1', stopValue: '2x', action: 'Close' }],
    };

    const plan = createTestPlan({ coreStrategies: [existingStrategy] });
    usePlanStore.setState({ currentPlan: plan });

    // Track what onImport receives
    const importedData: { toAdd: Strategy[]; toReplace: Strategy[] } = { toAdd: [], toReplace: [] };

    const handleImport = (toAdd: Strategy[], toReplace: Strategy[]) => {
      importedData.toAdd = toAdd;
      importedData.toReplace = toReplace;

      // Simulate what PlanViewer.handleImport does
      const currentPlan = usePlanStore.getState().currentPlan!;
      let coreStrategies = [...currentPlan.coreStrategies];
      let speculativeStrategies = [...currentPlan.speculativeStrategies];

      for (const replacement of toReplace) {
        const coreIdx = coreStrategies.findIndex((s) => s.id === replacement.id);
        if (coreIdx !== -1) { coreStrategies[coreIdx] = replacement; continue; }
        const specIdx = speculativeStrategies.findIndex((s) => s.id === replacement.id);
        if (specIdx !== -1) { speculativeStrategies[specIdx] = replacement; }
      }

      for (const strategy of toAdd) {
        if (strategy.classification === 'Core') {
          coreStrategies.push(strategy);
        } else {
          speculativeStrategies.push(strategy);
        }
      }

      usePlanStore.setState({
        currentPlan: { ...currentPlan, coreStrategies, speculativeStrategies },
        isDirty: true,
      });
    };

    render(
      <StrategyImporter
        isOpen={true}
        onClose={vi.fn()}
        existingStrategies={[existingStrategy]}
        onImport={handleImport}
      />,
    );

    // Expand Iron Strategies and select Iron Condor (Core)
    await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
    await user.click(screen.getByLabelText('Select Iron Condor'));

    // Expand Directional and select Long Call (Speculative)
    await user.click(screen.getByRole('button', { name: 'Directional category' }));
    await user.click(screen.getByLabelText('Select Long Call'));

    // Continue to confirm (no duplicates expected)
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Confirm import
    await user.click(screen.getByRole('button', { name: /Import 2 Strateg/i }));

    // Verify plan state was updated
    const state = usePlanStore.getState();
    expect(state.isDirty).toBe(true);

    // Original strategy still present + Iron Condor added to core
    const coreNames = state.currentPlan!.coreStrategies.map((s) => s.name);
    expect(coreNames).toContain('My Custom Strategy');
    expect(coreNames).toContain('Iron Condor');

    // Long Call added to speculative
    const specNames = state.currentPlan!.speculativeStrategies.map((s) => s.name);
    expect(specNames).toContain('Long Call');
  });

  it('handles duplicate resolution during import into existing plan', async () => {
    const user = userEvent.setup();

    const existingIronCondor: Strategy = {
      id: 'existing-ic',
      name: 'Iron Condor',
      classification: 'Core',
      description: 'My existing iron condor',
      entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '45' }],
      managementRules: [{ id: 'mr-1', triggerCondition: 'Delta > 0.30', actionDescription: 'Roll' }],
      profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
      stopLosses: [{ id: 'sl-1', stopValue: '2x credit', action: 'Close' }],
    };

    const plan = createTestPlan({ coreStrategies: [existingIronCondor] });
    usePlanStore.setState({ currentPlan: plan });

    const handleImport = (toAdd: Strategy[], toReplace: Strategy[]) => {
      const currentPlan = usePlanStore.getState().currentPlan!;
      let coreStrategies = [...currentPlan.coreStrategies];
      let speculativeStrategies = [...currentPlan.speculativeStrategies];

      for (const replacement of toReplace) {
        const coreIdx = coreStrategies.findIndex((s) => s.id === replacement.id);
        if (coreIdx !== -1) { coreStrategies[coreIdx] = replacement; continue; }
        const specIdx = speculativeStrategies.findIndex((s) => s.id === replacement.id);
        if (specIdx !== -1) { speculativeStrategies[specIdx] = replacement; }
      }

      for (const strategy of toAdd) {
        if (strategy.classification === 'Core') {
          coreStrategies.push(strategy);
        } else {
          speculativeStrategies.push(strategy);
        }
      }

      usePlanStore.setState({
        currentPlan: { ...currentPlan, coreStrategies, speculativeStrategies },
        isDirty: true,
      });
    };

    render(
      <StrategyImporter
        isOpen={true}
        onClose={vi.fn()}
        existingStrategies={[existingIronCondor]}
        onImport={handleImport}
      />,
    );

    // Select Iron Condor (will conflict)
    await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
    await user.click(screen.getByLabelText('Select Iron Condor'));

    // Continue - should show duplicate resolution
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Choose "Replace Existing"
    await user.click(screen.getByText('Replace Existing'));

    // Continue to confirm
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // Confirm import
    await user.click(screen.getByRole('button', { name: /Import 1 Strategy/i }));

    // Verify the existing Iron Condor was replaced (same ID, new content)
    const state = usePlanStore.getState();
    const replacedStrategy = state.currentPlan!.coreStrategies.find((s) => s.id === 'existing-ic');
    expect(replacedStrategy).toBeDefined();
    // The replaced strategy should have the library's description (longer/different from original)
    expect(replacedStrategy!.description).toContain('Neutral strategy');
    expect(replacedStrategy!.entryCriteria.length).toBeGreaterThanOrEqual(1);
  });

  it('routes imported strategies to correct arrays based on classification', async () => {
    const user = userEvent.setup();

    const plan = createTestPlan();
    usePlanStore.setState({ currentPlan: plan });

    const handleImport = (toAdd: Strategy[], toReplace: Strategy[]) => {
      const currentPlan = usePlanStore.getState().currentPlan!;
      let coreStrategies = [...currentPlan.coreStrategies];
      let speculativeStrategies = [...currentPlan.speculativeStrategies];

      for (const strategy of toAdd) {
        if (strategy.classification === 'Core') {
          coreStrategies.push(strategy);
        } else {
          speculativeStrategies.push(strategy);
        }
      }

      usePlanStore.setState({
        currentPlan: { ...currentPlan, coreStrategies, speculativeStrategies },
        isDirty: true,
      });
    };

    render(
      <StrategyImporter
        isOpen={true}
        onClose={vi.fn()}
        existingStrategies={[]}
        onImport={handleImport}
      />,
    );

    // Select a mix of Core and Speculative strategies
    await user.click(screen.getByRole('button', { name: 'Premium Selling category' }));
    await user.click(screen.getByLabelText('Select Covered Call')); // Core

    await user.click(screen.getByRole('button', { name: 'Directional category' }));
    await user.click(screen.getByLabelText('Select Long Put')); // Speculative

    await user.click(screen.getByRole('button', { name: 'Iron Strategies category' }));
    await user.click(screen.getByLabelText('Select Iron Butterfly')); // Core

    // Continue and confirm
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: /Import 3 Strateg/i }));

    const state = usePlanStore.getState();
    const coreNames = state.currentPlan!.coreStrategies.map((s) => s.name);
    const specNames = state.currentPlan!.speculativeStrategies.map((s) => s.name);

    expect(coreNames).toContain('Covered Call');
    expect(coreNames).toContain('Iron Butterfly');
    expect(specNames).toContain('Long Put');

    // No misrouting
    expect(specNames).not.toContain('Covered Call');
    expect(specNames).not.toContain('Iron Butterfly');
    expect(coreNames).not.toContain('Long Put');
  });
});

describe('Integration: Imported strategy is editable via StrategyEditor', () => {
  beforeEach(() => {
    resetStores();
  });

  afterEach(() => {
    resetStores();
  });

  it('renders an imported strategy in StrategyEditor with all fields populated', () => {
    // Instantiate a template to simulate an imported strategy
    const templates = getAllTemplates();
    const ironCondorTemplate = templates.find((t) => t.templateId === 'iron-condor')!;
    const instantiated = instantiateTemplates([ironCondorTemplate]);
    const strategy = instantiated[0];

    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <StrategyEditor
        strategy={strategy}
        classification="Core"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Verify the strategy name is populated
    const nameInput = screen.getByLabelText('Strategy Name') as HTMLInputElement;
    expect(nameInput.value).toBe('Iron Condor');

    // Verify classification is set
    const classSelect = screen.getByLabelText('Classification') as HTMLSelectElement;
    expect(classSelect.value).toBe('Core');

    // Verify description is populated
    const descInput = screen.getByLabelText('Description') as HTMLInputElement;
    expect(descInput.value).toContain('Neutral strategy');
  });

  it('allows modifying the name of an imported strategy and saving', async () => {
    const user = userEvent.setup();

    const templates = getAllTemplates();
    const coveredCallTemplate = templates.find((t) => t.templateId === 'covered-call')!;
    const instantiated = instantiateTemplates([coveredCallTemplate]);
    const strategy = instantiated[0];

    const onSave = vi.fn();
    const onCancel = vi.fn();

    render(
      <StrategyEditor
        strategy={strategy}
        classification="Core"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Modify the strategy name
    const nameInput = screen.getByLabelText('Strategy Name') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'My Custom Covered Call');

    // Save
    await user.click(screen.getByRole('button', { name: 'Save Strategy' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedStrategy = onSave.mock.calls[0][0] as Strategy;
    expect(savedStrategy.name).toBe('My Custom Covered Call');
    expect(savedStrategy.id).toBe(strategy.id); // Same ID preserved
    expect(savedStrategy.classification).toBe('Core');
    expect(savedStrategy.entryCriteria.length).toBeGreaterThanOrEqual(1);
  });

  it('allows modifying the description of an imported strategy', async () => {
    const user = userEvent.setup();

    const templates = getAllTemplates();
    const shortPutTemplate = templates.find((t) => t.templateId === 'short-put')!;
    const instantiated = instantiateTemplates([shortPutTemplate]);
    const strategy = instantiated[0];

    const onSave = vi.fn();

    render(
      <StrategyEditor
        strategy={strategy}
        classification="Core"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    const descInput = screen.getByLabelText('Description') as HTMLInputElement;
    await user.clear(descInput);
    await user.type(descInput, 'My modified short put description');

    await user.click(screen.getByRole('button', { name: 'Save Strategy' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedStrategy = onSave.mock.calls[0][0] as Strategy;
    expect(savedStrategy.description).toBe('My modified short put description');
    expect(savedStrategy.name).toBe('Short Put');
  });

  it('treats imported strategy identically to manually created (same validation)', async () => {
    const user = userEvent.setup();

    const templates = getAllTemplates();
    const longCallTemplate = templates.find((t) => t.templateId === 'long-call')!;
    const instantiated = instantiateTemplates([longCallTemplate]);
    const strategy = instantiated[0];

    const onSave = vi.fn();

    render(
      <StrategyEditor
        strategy={strategy}
        classification="Speculative"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Clear the name to trigger validation error
    const nameInput = screen.getByLabelText('Strategy Name') as HTMLInputElement;
    await user.clear(nameInput);

    await user.click(screen.getByRole('button', { name: 'Save Strategy' }));

    // Should show validation error, not call onSave
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Strategy name is required.')).toBeInTheDocument();
  });
});
