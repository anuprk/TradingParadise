import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

/**
 * ResetPasswordPage — Allows users to request a password reset email.
 * Always shows a confirmation message after submit to prevent email enumeration (Req 6.4).
 *
 * Requirements: 6.1, 6.2, 6.4
 */
export default function ResetPasswordPage() {
  const { resetPassword, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    await resetPassword(email);
    setIsSubmitting(false);
    // Always show confirmation regardless of whether the email exists (prevents enumeration)
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Reset Password</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-md bg-surface-secondary border border-border p-4 text-center space-y-3">
            <p className="text-sm text-text-primary">
              If an account exists for <span className="font-medium">{email}</span>, you will
              receive a password reset email shortly.
            </p>
            <p className="text-sm text-text-secondary">
              Check your inbox and follow the link to set a new password.
            </p>
            <Link
              to="/login"
              className="inline-block mt-2 text-sm text-text-accent hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              error={error ?? undefined}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? 'Sending…' : 'Send Reset Link'}
            </Button>

            <p className="text-center text-sm text-text-secondary">
              <Link to="/login" className="text-text-accent hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
