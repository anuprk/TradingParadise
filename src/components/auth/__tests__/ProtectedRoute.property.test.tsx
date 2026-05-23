// Feature: dark-mode-and-cloud-auth, Property 3: Route guard access is determined by session existence

/**
 * Property-based test for route guard access.
 * Uses fast-check to generate random route paths from the protected set,
 * then asserts redirect/render behavior based on session presence.
 *
 * **Validates: Requirements 7.1, 7.2**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import fc from 'fast-check';
import { ProtectedRoute } from '../ProtectedRoute';

const mockAuthStore = vi.fn();

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => mockAuthStore(selector),
}));

const PROTECTED_ROUTES = [
  '/',
  '/plans/new',
  '/plans/abc-123/edit',
  '/plans/abc-123',
  '/journal',
  '/journal/new',
  '/journal/entry-1/edit',
  '/daily-notes',
  '/portfolios',
  '/portfolios/port-1',
  '/options-dashboard',
  '/reminders',
  '/settings',
];

const protectedRouteArb = fc.constantFrom(...PROTECTED_ROUTES);

function renderProtectedRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Property 3: Route guard access is determined by session existence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login for any protected route when no session exists (user is null)', () => {
    fc.assert(
      fc.property(protectedRouteArb, (routePath) => {
        mockAuthStore.mockImplementation(
          (selector: (state: { user: null; isLoading: boolean }) => unknown) =>
            selector({ user: null, isLoading: false }),
        );

        const { unmount } = renderProtectedRoute(routePath);

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 },
    );
  });

  it('renders children for any protected route when a session exists (user is present)', () => {
    fc.assert(
      fc.property(protectedRouteArb, (routePath) => {
        mockAuthStore.mockImplementation(
          (selector: (state: { user: { id: string; email: string }; isLoading: boolean }) => unknown) =>
            selector({ user: { id: 'user-abc', email: 'test@example.com' }, isLoading: false }),
        );

        const { unmount } = renderProtectedRoute(routePath);

        expect(screen.getByTestId('protected-content')).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 },
    );
  });
});
