/**
 * Unit tests for SettingsPage — plan management and JSON import/export.
 *
 * Requirements: 14.2, 14.3, 14.4, 16.1, 16.2, 16.3, 16.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsPage from '../SettingsPage';
import { usePlanStore } from '../../stores/planStore';
import { useAppStore } from '../../stores/appStore';
import { serializePlan, deserializePlan } from '../../utils/serialization';
import type { TradingPlan } from '../../types/tradingPlan';

// Mock repository modules
const mockUpdatePlan = vi.fn().mockResolvedValue(undefined);
const mockGetPlan = vi.fn().mockResolvedValue(undefined);
const mockCreatePlan = vi.fn().mockResolvedValue('new-id');
const mockListPortfolios = vi.fn().mockResolvedValue([]);
const mockCreatePortfolio = vi.fn().mockResolvedValue('new-portfolio-id');
const mockListJournalEntries = vi.fn().mockResolvedValue([]);
const mockCreateJournalEntry = vi.fn().mockResolvedValue('new-entry-id');
const mockListReminders = vi.fn().mockResolvedValue([]);
const mockCreateReminder = vi.fn().mockResolvedValue('new-reminder-id');

vi.mock('../../db/planRepository', () => ({
  createPlan: (...args: unknown[]) => mockCreatePlan(...args),
  getPlan: (...args: unknown[]) => mockGetPlan(...args),
  updatePlan: (...args: unknown[]) => mockUpdatePlan(...args),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  listPlans: vi.fn().mockResolvedValue([]),
  getLastAccessed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../db/portfolioRepository', () => ({
  listPortfolios: (...args: unknown[]) => mockListPortfolios(...args),
  createPortfolio: (...args: unknown[]) => mockCreatePortfolio(...args),
}));

vi.mock('../../db/journalRepository', () => ({
  listJournalEntries: (...args: unknown[]) => mockListJournalEntries(...args),
  createJournalEntry: (...args: unknown[]) => mockCreateJournalEntry(...args),
}));

vi.mock('../../db/reminderRepository', () => ({
  listReminders: (...args: unknown[]) => mockListReminders(...args),
  createReminder: (...args: unknown[]) => mockCreateReminder(...args),
}));

// Mock Supabase client for cascade delete operations
const _mockSupabaseDelete = vi.fn().mockReturnValue({ error: null });
const mockSupabaseEq = vi.fn().mockReturnValue({ error: null });

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: () => ({
        eq: mockSupabaseEq,
      }),
    })),
  },
}));

function buildPlan(overrides: Partial<TradingPlan> = {}): TradingPlan {
  const now = new Date('2025-01-15T10:00:00.000Z');
  return {
    id: 'plan-1',
    name: 'Test Plan',
    author: 'Tester',
    year: 2025,
    createdAt: now,
    updatedAt: now,
    goals: [{ id: 'g1', description: 'Goal 1', targetValue: '10%' }],
    greeksTargets: [],
    riskManagement: { bpThresholds: [], positionLimits: [] },
    tradeRules: [{ id: 'r1', order: 0, text: 'Rule 1' }],
    dailyManagement: { nightlyReview: [], morningReview: [] },
    vacationRules: [],
    marketRegimes: [
      { id: 'mr1', name: 'Bullish', conditions: 'Up', strategyAdjustments: 'Increase' },
      { id: 'mr2', name: 'Neutral', conditions: 'Flat', strategyAdjustments: 'Hold' },
      { id: 'mr3', name: 'Bearish', conditions: 'Down', strategyAdjustments: 'Reduce' },
    ],
    accountSizing: { totalAccountSize: 100000, allocations: [] },
    coreStrategies: [],
    speculativeStrategies: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  usePlanStore.setState({
    currentPlan: null,
    isDirty: false,
    isLoading: false,
    plans: [],
  });
  useAppStore.setState({ activePlanId: null, toasts: [] });
});

describe('SettingsPage — Plan Management', () => {
  it('renders plan management section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Plan Management')).toBeInTheDocument();
  });

  it('shows empty state when no plans exist', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/no plans yet/i)).toBeInTheDocument();
  });

  it('lists all plans', () => {
    const plan1 = buildPlan({ id: 'p1', name: 'Plan Alpha' });
    const plan2 = buildPlan({ id: 'p2', name: 'Plan Beta' });
    usePlanStore.setState({
      plans: [plan1, plan2],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });

    render(<SettingsPage />);
    expect(screen.getByText('Plan Alpha')).toBeInTheDocument();
    expect(screen.getByText('Plan Beta')).toBeInTheDocument();
  });

  it('highlights the active plan', () => {
    const plan = buildPlan({ id: 'p1', name: 'Active Plan' });
    usePlanStore.setState({
      plans: [plan],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });
    useAppStore.setState({ activePlanId: 'p1' });

    render(<SettingsPage />);
    expect(screen.getByText('(active)')).toBeInTheDocument();
  });

  it('allows inline rename of a plan', async () => {
    const user = userEvent.setup();
    const plan = buildPlan({ id: 'p1', name: 'Old Name' });
    usePlanStore.setState({
      plans: [plan],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: /rename old name/i }));
    const input = screen.getByLabelText(/plan name/i);
    expect(input).toHaveValue('Old Name');

    await user.clear(input);
    await user.type(input, 'New Name');
    await user.click(screen.getByRole('button', { name: /save name/i }));

    expect(mockUpdatePlan).toHaveBeenCalledWith('p1', expect.objectContaining({ name: 'New Name' }));
  });

  it('shows delete confirmation with journal entry warning', async () => {
    const user = userEvent.setup();
    const plan = buildPlan({ id: 'p1', name: 'My Plan' });
    mockListJournalEntries.mockResolvedValueOnce([{ id: 'entry-1' }, { id: 'entry-2' }]);
    usePlanStore.setState({
      plans: [plan],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });

    render(<SettingsPage />);

    await user.click(screen.getByRole('button', { name: /delete my plan/i }));

    await waitFor(() => {
      expect(screen.getByText(/also delete all associated journal entries/i)).toBeInTheDocument();
    });
  });
});

describe('SettingsPage — Import/Export', () => {
  it('renders import/export section', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Import / Export')).toBeInTheDocument();
  });

  it('disables export button when no plan is active', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /export plan/i })).toBeDisabled();
  });

  it('enables export button when a plan is active', () => {
    const plan = buildPlan();
    usePlanStore.setState({
      plans: [plan],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });
    useAppStore.setState({ activePlanId: 'plan-1' });

    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /export plan/i })).toBeEnabled();
  });

  it('shows error toast for malformed JSON import', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const file = new File(['not valid json'], 'bad.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import plan file/i);
    await user.upload(input, file);

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
    });
  });

  it('shows descriptive error for invalid plan structure', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const badData = JSON.stringify({ version: '1.0', exportedAt: '2025-01-01' });
    const file = new File([badData], 'invalid.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import plan file/i);
    await user.upload(input, file);

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'error' && t.message.includes('Invalid plan data'))).toBe(true);
    });
  });

  it('does not modify existing data on import failure', async () => {
    const user = userEvent.setup();
    const existingPlan = buildPlan({ id: 'existing', name: 'Existing' });
    usePlanStore.setState({
      plans: [existingPlan],
      loadPlans: vi.fn().mockResolvedValue(undefined),
    });
    useAppStore.setState({ activePlanId: 'existing' });

    render(<SettingsPage />);

    const file = new File(['bad json'], 'bad.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import plan file/i);
    await user.upload(input, file);

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'error')).toBe(true);
    });

    // Existing data should not be modified
    expect(mockCreatePlan).not.toHaveBeenCalled();
    expect(mockCreatePortfolio).not.toHaveBeenCalled();
    expect(mockCreateJournalEntry).not.toHaveBeenCalled();
    expect(mockCreateReminder).not.toHaveBeenCalled();
    expect(useAppStore.getState().activePlanId).toBe('existing');
  });

  it('successfully imports a valid JSON file', async () => {
    const user = userEvent.setup();
    const plan = buildPlan();
    const json = serializePlan(plan, [], [], []);

    render(<SettingsPage />);

    const file = new File([json], 'plan.json', { type: 'application/json' });
    const input = screen.getByLabelText(/import plan file/i);
    await user.upload(input, file);

    await waitFor(() => {
      const { toasts } = useAppStore.getState();
      expect(toasts.some((t) => t.type === 'success' && /imported/i.test(t.message))).toBe(true);
    });

    expect(mockCreatePlan).toHaveBeenCalled();
    expect(useAppStore.getState().activePlanId).toBe('plan-1');
  });

  it('round-trip: exported JSON can be re-imported', () => {
    // This tests the serialization round-trip at the data level
    const plan = buildPlan();
    const json = serializePlan(plan, [], [], []);
    const result = deserializePlan(json);

    expect(result.plan.id).toBe(plan.id);
    expect(result.plan.name).toBe(plan.name);
    expect(result.plan.goals).toHaveLength(plan.goals.length);
    expect(result.portfolios).toEqual([]);
    expect(result.journalEntries).toEqual([]);
    expect(result.reminders).toEqual([]);
  });
});
