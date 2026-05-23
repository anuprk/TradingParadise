import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { validatePassword } from '../utils/validation';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

/**
 * UpdatePasswordPage — Allows users to set a new password after following a reset link.
 * Validates password client-side, calls authStore.updatePassword, and redirects to /login on success.
 *
 * Requirements: 6.3
 */
export default function UpdatePasswordPage() {
  const { updatePassword, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (!validatePassword(password)) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    await updatePassword(password);

    // If the store has no error after the call, the update succeeded
    const storeError = useAuthStore.getState().error;
    setIsSubmitting(false);

    if (!storeError) {
      navigate('/login');
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-primary px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary">Set New Password</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setValidationError(null);
            }}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setValidationError(null);
            }}
            placeholder="Re-enter your password"
            required
            autoComplete="new-password"
          />

          {displayError && (
            <p className="text-sm text-error" role="alert">
              {displayError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !password || !confirmPassword}
          >
            {isSubmitting ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
