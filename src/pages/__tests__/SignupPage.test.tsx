/**
 * Unit tests for SignupPage — registration form, validation, error display, loading state, redirect.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.2
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SignupPage from '../SignupPage';
import { useAuthStore } from '../../stores/authStore';

// Mock the supabase module so authStore doesn't throw on import
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
    },
  },
}));

function renderSignupPage() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/login" element={<div>Login</div>} />
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

describe('SignupPage', () => {
  it('renders email, password, and confirm password fields', () => {
    renderSignupPage();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('renders a sign-up submit button', () => {
    renderSignupPage();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('renders a link to the login page', () => {
    renderSignupPage();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });

  it('shows validation error when email is empty', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/^password$/i), 'validpass1');
    await user.type(screen.getByLabelText(/confirm password/i), 'validpass1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/email/i), 'notanemail');
    await user.type(screen.getByLabelText(/^password$/i), 'validpass1');
    await user.type(screen.getByLabelText(/confirm password/i), 'validpass1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
  });

  it('shows validation error when password is too short', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows validation error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderSignupPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'validpass1');
    await user.type(screen.getByLabelText(/confirm password/i), 'different1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('calls signUp with email and password on valid submission', async () => {
    const user = userEvent.setup();
    const signUpMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signUp: signUpMock });

    renderSignupPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'validpass1');
    await user.type(screen.getByLabelText(/confirm password/i), 'validpass1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(signUpMock).toHaveBeenCalledWith('test@example.com', 'validpass1');
  });

  it('does not call signUp when validation fails', async () => {
    const user = userEvent.setup();
    const signUpMock = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signUp: signUpMock });

    renderSignupPage();

    // Submit with empty fields
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('displays inline error from authStore.error', () => {
    useAuthStore.setState({ error: 'An account with this email already exists.' });
    renderSignupPage();
    expect(screen.getByRole('alert')).toHaveTextContent('An account with this email already exists.');
  });

  it('shows loading text on submit button while request is in progress', async () => {
    const user = userEvent.setup();
    // signUp that never resolves to keep loading state
    const signUpMock = vi.fn().mockReturnValue(new Promise(() => {}));
    useAuthStore.setState({ signUp: signUpMock });

    renderSignupPage();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'validpass1');
    await user.type(screen.getByLabelText(/confirm password/i), 'validpass1');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });

  it('redirects to / if user is already authenticated', async () => {
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@example.com' } as any,
    });

    renderSignupPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
