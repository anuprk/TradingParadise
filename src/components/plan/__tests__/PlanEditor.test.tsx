import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PlanEditor from '../PlanEditor';
import { usePlanStore } from '../../../stores/planStore';
import { useAppStore } from '../../../stores/appStore';
import type { TradingPlan } from '../../../types/tradingPlan';

// Mock planRepository to avoid Supabase calls in tests
vi.mock('../../../db/planRepository', () => ({
  createPlan: vi.fn().mockResolvedValue('new-id'),
  getPlan: vi.fn().mockResolvedValue(undefined),
  updatePlan: vi.fn().mockResolvedValue(undefined),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  listPlans: vi.fn().mockResolvedValue([]),
  getLastAccessed: vi.fn().mockResolvedValue(undefined),
}));

// Reset store state before each test
beforeEach(() => {
  usePlanStore.setState({
    currentPlan: null,
    isDirty: false,
    isLoading: false,
    plans: [],
  });
  useAppStore.setState({ toasts: [] });
});

function renderEditor(planId?: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <PlanEditor planId={planId} />,
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

function buildValidPlan(): TradingPlan {
  const now = new Date();
  return {
    id: 'plan-1',
    name: 'Test Plan',
    author: 'Tester',
    year: 2025,
    createdAt: now,
    updatedAt: now,
    goals: [{ id: 'g1', description: 'Goal 1', targetValue: '100' }],
    greeksTargets: [],
    riskManagement: { bpThresholds: [], positionLimits: [] },
    tradeRules: [{ id: 'r1', order: 0, text: 'Rule 1' }],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [],
    marketRegimes: [
      { id: 'm1', name: 'Bull', conditions: 'Up', strategyAdjustments: 'Go long' },
      { id: 'm2', name: 'Bear', conditions: 'Down', strategyAdjustments: 'Go short' },
      { id: 'm3', name: 'Neutral', conditions: 'Flat', strategyAdjustments: 'Straddle' },
    ],
    accountSizing: { totalAccountSize: 100000, allocations: [] },
    coreStrategies: [],
    speculativeStrategies: [],
  };
}

describe('PlanEditor', () => {
  it('renders the plan tab as active by default', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /📄 Plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /📊 Strategy Table/i })).toBeInTheDocument();
  });

  it('renders the markdown editor in edit mode', () => {
    renderEditor();
    expect(screen.getByPlaceholderText('Write your trading plan in markdown…')).toBeInTheDocument();
  });

  it('switches to strategy table when clicking the Strategy Table tab', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /📊 Strategy Table/i }));

    expect(screen.getByText('Trade Strategy Table')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    usePlanStore.setState({ isLoading: true });
    renderEditor();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('registers beforeunload handler when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    usePlanStore.setState({ isDirty: true });
    renderEditor();
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('initializes a new empty plan when no planId is provided', () => {
    renderEditor();
    const { currentPlan } = usePlanStore.getState();
    expect(currentPlan).not.toBeNull();
    expect(currentPlan?.name).toBe('');
    expect(currentPlan?.goals).toEqual([]);
  });
});

describe('PlanEditor — Save with validation', () => {
  it('renders a "Save" button for new plans', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('disables save button when isDirty is false', () => {
    renderEditor();
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeDisabled();
  });

  it('enables save button when isDirty is true', () => {
    // Pre-set a valid plan so the component doesn't create a new empty one
    usePlanStore.setState({ currentPlan: buildValidPlan(), isDirty: true });
    renderEditor();
    const btn = screen.getByRole('button', { name: /save/i });
    expect(btn).toBeEnabled();
  });

  it('calls createPlan and shows success toast for a valid new plan', async () => {
    const user = userEvent.setup();
    const validPlan = buildValidPlan();
    const createPlanSpy = vi.fn().mockResolvedValue('new-id');

    // Pre-set the valid plan so the component uses it
    usePlanStore.setState({
      currentPlan: validPlan,
      isDirty: true,
      createPlan: createPlanSpy,
    });
    renderEditor();

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'success')).toBe(true);
    });
    expect(createPlanSpy).toHaveBeenCalled();
  });

  it('calls savePlan for an existing plan (not new)', async () => {
    const user = userEvent.setup();
    const validPlan = buildValidPlan();
    const savePlanSpy = vi.fn().mockResolvedValue(undefined);
    const loadPlanSpy = vi.fn().mockImplementation(async () => {
      // Simulate loadPlan setting the plan and keeping isDirty true
      usePlanStore.setState({ currentPlan: validPlan, isDirty: true });
    });

    usePlanStore.setState({
      currentPlan: validPlan,
      isDirty: true,
      savePlan: savePlanSpy,
      loadPlan: loadPlanSpy,
    });

    const router = createMemoryRouter(
      [{ path: '/', element: <PlanEditor planId="plan-1" /> }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'success')).toBe(true);
    });
    expect(savePlanSpy).toHaveBeenCalled();
  });

  it('shows error toast when save operation throws', async () => {
    const user = userEvent.setup();
    const validPlan = buildValidPlan();
    const createPlanSpy = vi.fn().mockRejectedValue(new Error('DB error'));

    usePlanStore.setState({
      currentPlan: validPlan,
      isDirty: true,
      createPlan: createPlanSpy,
    });
    renderEditor();

    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'error' && /failed to save/i.test(t.message))).toBe(true);
    });
  });
});

describe('PlanEditor — Default Strategies Prompt', () => {
  it('shows the default strategies prompt when creating a new plan', () => {
    renderEditor();
    expect(screen.getByText('Start with default options strategies?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Include Default Strategies/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Empty/i })).toBeInTheDocument();
  });

  it('does not show the prompt when editing an existing plan', () => {
    const validPlan = buildValidPlan();
    const loadPlanSpy = vi.fn().mockImplementation(async () => {
      usePlanStore.setState({ currentPlan: validPlan });
    });
    usePlanStore.setState({ currentPlan: validPlan, loadPlan: loadPlanSpy });

    const router = createMemoryRouter(
      [{ path: '/', element: <PlanEditor planId="plan-1" /> }],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.queryByText('Start with default options strategies?')).not.toBeInTheDocument();
  });

  it('"Start Empty" dismisses the prompt and leaves strategy arrays empty', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /Start Empty/i }));

    expect(screen.queryByText('Start with default options strategies?')).not.toBeInTheDocument();
    const { currentPlan } = usePlanStore.getState();
    expect(currentPlan?.coreStrategies).toEqual([]);
    expect(currentPlan?.speculativeStrategies).toEqual([]);
  });

  it('"Include Default Strategies" populates core and speculative arrays and dismisses prompt', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /Include Default Strategies/i }));

    expect(screen.queryByText('Start with default options strategies?')).not.toBeInTheDocument();
    const { currentPlan } = usePlanStore.getState();
    expect(currentPlan?.coreStrategies.length).toBeGreaterThan(0);
    expect(currentPlan?.speculativeStrategies.length).toBeGreaterThan(0);
    // All core strategies should have classification 'Core'
    currentPlan?.coreStrategies.forEach((s) => {
      expect(s.classification).toBe('Core');
    });
    // All speculative strategies should have classification 'Speculative'
    currentPlan?.speculativeStrategies.forEach((s) => {
      expect(s.classification).toBe('Speculative');
    });
  });

  it('"Include Default Strategies" generates unique IDs for each strategy', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('button', { name: /Include Default Strategies/i }));

    const { currentPlan } = usePlanStore.getState();
    const allIds = [
      ...(currentPlan?.coreStrategies.map((s) => s.id) ?? []),
      ...(currentPlan?.speculativeStrategies.map((s) => s.id) ?? []),
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
