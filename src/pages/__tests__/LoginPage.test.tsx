/**
 * Unit tests for LoginPage — sign-in form, error display, loading state, redirect.
 *
 * Requirements: 4.1, 4.2, 4.3, 11.2
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { useAuthStore } from '../../stores/authStore';

// Mock the supabase module so authStore doesn't throw on import
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
    },
  },
}));

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/signup" element={<div>Signup</div>} />
        <Route path="/reset-password" element={<div>Reset</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    error: null,
  });
});

describe('LoginPage', () => {
  it('renders email and password fields with labels', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a sign-in submit button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders links to sign-up and reset-password pages', () => {
    renderLoginPage();
    expect(screen.getByRole('link', { name: /sign up/i })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute('href', '/reset-password');
  });

  it('displays inline error from authStore.error', () => {
    useAuthStore.setState({ error: 'Email or password is incorrect.' });
    renderLoginPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('calls signIn with email and password on form submit', async () => {
    const user = userEvent.setup();
    const signInMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signIn: signInMock });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'mypassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(signInMock).toHaveBeenCalledWith('test@example.com', 'mypassword');
  });

  it('shows loading text on submit button while request is in progress', async () => {
    const user = userEvent.setup();
    // signIn that never resolves to keep loading state
    const signInMock = vi.fn().mockReturnValue(new Promise(() => {}));
    useAuthStore.setState({ signIn: signInMock });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'mypassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });

  it('redirects to / if user is already authenticated', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' } as any,
    });

    renderLoginPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('clears error before submitting', async () => {
    const user = userEvent.setup();
    const clearErrorMock = vi.fn();
    const signInMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      error: 'Previous error',
      clearError: clearErrorMock,
      signIn: signInMock,
    });

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'mypassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(clearErrorMock).toHaveBeenCalled();
  });
});
