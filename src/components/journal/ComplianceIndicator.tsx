import { useState } from 'react';
import Badge from '../ui/Badge';
import { checkTradeCompliance } from '../../utils/compliance';
import type { ComplianceResult } from '../../utils/compliance';
import type { TradeJournalEntry } from '../../types/journal';
import type { Strategy } from '../../types/tradingPlan';

interface ComplianceIndicatorProps {
  entry: TradeJournalEntry;
  strategy: Strategy;
}

export default function ComplianceIndicator({ entry, strategy }: ComplianceIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const result: ComplianceResult = checkTradeCompliance(entry, strategy);

  if (result.isCompliant) {
    return (
      <Badge variant="success" className="cursor-default" aria-label="Trade is compliant">
        ✓ Compliant
      </Badge>
    );
  }

  const violations = result.deviations.filter((d) => d.severity === 'violation').length;
  const warnings = result.deviations.filter((d) => d.severity === 'warning').length;

  const variant = violations > 0 ? 'danger' : 'warning';
  const label = violations > 0
    ? `${violations} violation${violations > 1 ? 's' : ''}`
    : `${warnings} warning${warnings > 1 ? 's' : ''}`;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${result.deviations.length} deviation${result.deviations.length > 1 ? 's' : ''} found`}
      >
        <Badge variant={variant}>⚠ {label}</Badge>
      </button>

      {expanded && (
        <div className="absolute z-10 mt-1 w-64 rounded-md bg-surface-secondary shadow-lg ring-1 ring-border p-3 text-xs">
          <p className="font-semibold text-text-primary mb-2">Deviations</p>
          <ul className="space-y-1.5">
            {result.deviations.map((d, i) => (
              <li key={i} className="flex flex-col">
                <span className="font-medium text-text-primary">{d.field}</span>
                <span className="text-text-secondary">
                  Expected: {d.expected} · Actual: {d.actual}
                </span>
                <Badge
                  variant={d.severity === 'violation' ? 'danger' : 'warning'}
                  className="mt-0.5 self-start"
                >
                  {d.severity}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
