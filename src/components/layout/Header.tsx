import { TrendingUp, LogOut } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export default function Header() {
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <header className="h-14 border-b border-border bg-surface-secondary flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">TradingParadise</h1>
      </div>

      <button
        onClick={signOut}
        className="p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-surface-tertiary transition-colors"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </header>
  );
}
