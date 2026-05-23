import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

const mockAuthStore = vi.fn();

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => mockAuthStore(selector),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner while auth is loading', () => {
    mockAuthStore.mockImplementation((selector: (state: { user: null; isLoading: boolean }) => unknown) =>
      selector({ user: null, isLoading: true })
    );

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    // The spinner container should be present
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('redirects to /login when user is null and not loading', () => {
    mockAuthStore.mockImplementation((selector: (state: { user: null; isLoading: boolean }) => unknown) =>
      selector({ user: null, isLoading: false })
    );

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockAuthStore.mockImplementation((selector: (state: { user: { id: string }; isLoading: boolean }) => unknown) =>
      selector({ user: { id: 'user-123' }, isLoading: false })
    );

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
