import { useCallback, useRef, type KeyboardEvent } from 'react';

export type PortfolioTab = 'holdings' | 'dividends';

interface TabNavigationProps {
  activeTab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}

const TABS: { id: PortfolioTab; label: string }[] = [
  { id: 'holdings', label: 'Holdings' },
  { id: 'dividends', label: 'Dividends' },
];

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      let nextIndex: number | null = null;

      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % TABS.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + TABS.length) % TABS.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTabChange(TABS[index].id);
        return;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        tabRefs.current[nextIndex]?.focus();
        onTabChange(TABS[nextIndex].id);
      }
    },
    [onTabChange]
  );

  return (
    <div
      role="tablist"
      aria-label="Portfolio views"
      className="flex border-b border-border"
    >
      {TABS.map((tab, index) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-text-accent focus:ring-offset-1 ${
              isActive
                ? 'border-b-2 border-indigo-600 text-text-accent bg-text-accent/20 font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
