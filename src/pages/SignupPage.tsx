import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { validatePassword } from '../utils/validation';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

/**
 * SignupPage — Email + password registration form.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.2
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const { user, signUp, error: authError, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localErrors, setLocalErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasMounted = useRef(false);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Clear auth error when user starts typing (skip initial mount)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (authError) {
      clearError();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, confirmPassword]);

  function validate(): boolean {
    const errors: typeof localErrors = {};

    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (!validatePassword(password)) {
      errors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await signUp(email, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Create Account</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Sign up to start tracking your trades in the cloud.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={localErrors.email}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isSubmitting}
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={localErrors.password}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={localErrors.confirmPassword}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          {authError && (
            <p className="text-sm text-error" role="alert">
              {authError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account…' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
