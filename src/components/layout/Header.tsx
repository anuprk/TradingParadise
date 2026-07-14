import { TrendingUp, LogOut, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAppStore } from '../../stores/appStore';

export default function Header() {
  const signOut = useAuthStore((s) => s.signOut);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <header className="h-14 border-b border-border bg-surface-secondary flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">TradingParadise</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          onClick={signOut}
          className="p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-surface-tertiary transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
