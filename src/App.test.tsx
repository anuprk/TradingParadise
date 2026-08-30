import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import type { TradingPlan } from './types/tradingPlan';

// Mock all DB modules to prevent Supabase calls in tests
const mockListPlans = vi.fn().mockResolvedValue([]);
vi.mock('./db/planRepository', () => ({
  listPlans: (...args: unknown[]) => mockListPlans(...args),
  getPlan: vi.fn().mockResolvedValue(null),
  createPlan: vi.fn().mockResolvedValue('test-id'),
  updatePlan: vi.fn().mockResolvedValue(undefined),
  deletePlan: vi.fn().mockResolvedValue(undefined),
  getLastAccessed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./db/journalRepository', () => ({
  listJournalEntries: vi.fn().mockResolvedValue([]),
  filterJournalEntries: vi.fn().mockResolvedValue([]),
  createJournalEntry: vi.fn().mockResolvedValue('je-id'),
}));

vi.mock('./db/portfolioRepository', () => ({
  listPortfolios: vi.fn().mockResolvedValue([]),
  getPortfolio: vi.fn().mockResolvedValue(undefined),
  createPortfolio: vi.fn().mockResolvedValue('p-id'),
}));

vi.mock('./db/reminderRepository', () => ({
  listReminders: vi.fn().mockResolvedValue([]),
  getRemindersByStatus: vi.fn().mockResolvedValue([]),
  getRemindersDueBy: vi.fn().mockResolvedValue([]),
  createReminder: vi.fn().mockResolvedValue('r-id'),
}));

function SimplePage() {
  return <div>Test Page</div>;
}

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [{ index: true, element: <SimplePage /> }],
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('App Shell', () => {
  it('renders the app title', () => {
    renderWithRouter();
    expect(screen.getByText('TradingParadise')).toBeInTheDocument();
  });

  it('renders the plan selector when a plan exists and the sidebar is expanded', async () => {
    const user = userEvent.setup();
    // The plan selector only renders when plans exist and the sidebar is expanded.
    // Have the store's loadPlans() populate a plan on mount.
    mockListPlans.mockResolvedValueOnce([{ id: 'plan-1', name: 'My Plan' } as TradingPlan]);
    renderWithRouter();
    // Let loadPlans() settle so the store has the plan.
    await screen.findByRole('button', { name: 'Expand sidebar' });
    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(await screen.findByLabelText('Select trading plan')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithRouter();
    // The mobile bottom-nav always renders labels for its items; assert those.
    expect(screen.getAllByText('Journal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Positions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  it('renders the page content', () => {
    renderWithRouter();
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });
});
