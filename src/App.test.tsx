import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AppShell from './components/layout/AppShell';

// Mock all DB modules to prevent Supabase calls in tests
vi.mock('./db/planRepository', () => ({
  listPlans: vi.fn().mockResolvedValue([]),
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

  it('renders the plan selector', () => {
    renderWithRouter();
    expect(screen.getByLabelText('Select trading plan')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithRouter();
    expect(screen.getAllByText('Journal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Portfolios').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reminders').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
  });

  it('renders the page content', () => {
    renderWithRouter();
    expect(screen.getByText('Test Page')).toBeInTheDocument();
  });
});
