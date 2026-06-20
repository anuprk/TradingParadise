import { type ReactNode } from 'react';

export interface PlanSection {
  id: string;
  label: string;
  icon?: ReactNode;
}

export const PLAN_SECTIONS: PlanSection[] = [
  { id: 'compliance', label: 'Compliance Monitor' },
  { id: 'metadata-goals', label: 'Metadata & Goals' },
  { id: 'greeks-targets', label: 'Portfolio Greeks Targets' },
  { id: 'risk-management', label: 'Risk Management' },
  { id: 'trade-rules', label: 'Trade Rules' },
  { id: 'daily-management', label: 'Daily Management' },
  { id: 'vacation-rules', label: 'Vacation Rules' },
  { id: 'market-regime', label: 'Market Regime Framework' },
  { id: 'account-sizing', label: 'Account Sizing & Allocation' },
  { id: 'core-strategies', label: 'Core Strategies' },
  { id: 'speculative-strategies', label: 'Speculative Strategies' },
];

interface SectionNavProps {
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
}

export default function SectionNav({ activeSection, onSectionChange }: SectionNavProps) {
  return (
    <nav className="w-full" aria-label="Plan sections">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3 px-3">
        Sections
      </h2>
      <ul className="space-y-0.5">
        {PLAN_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? 'bg-surface-tertiary text-text-accent font-medium'
                    : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                }`}
                aria-current={isActive ? 'true' : undefined}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
