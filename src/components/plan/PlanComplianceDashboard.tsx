import { useState, useEffect } from 'react';
import { filterJournalEntries } from '../../db/journalRepository';
import { evaluatePlanCompliance } from '../../utils/planCompliance';
import type { PlanComplianceReport, ComplianceCheck, ComplianceSeverity } from '../../utils/planCompliance';
import type { TradingPlan } from '../../types/tradingPlan';
import Badge from '../ui/Badge';

interface PlanComplianceDashboardProps {
  plan: TradingPlan;
}

export default function PlanComplianceDashboard({ plan }: PlanComplianceDashboardProps) {
  const [report, setReport] = useState<PlanComplianceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCompliance() {
      setIsLoading(true);
      setError(null);
      try {
        const { entries } = await filterJournalEntries({
          planId: plan.id,
          tradeStatus: 'Open',
        }, 0, 500);

        if (cancelled) return;

        const complianceReport = evaluatePlanCompliance(entries, plan);
        setReport(complianceReport);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load compliance data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCompliance();
    return () => { cancelled = true; };
  }, [plan]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Plan Compliance</h2>
        <p className="text-sm text-text-secondary">Evaluating compliance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Plan Compliance</h2>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const violations = report.checks.filter((c) => c.severity === 'violation');
  const warnings = report.checks.filter((c) => c.severity === 'warning');
  const passing = report.checks.filter((c) => c.severity === 'ok');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Plan Compliance</h2>
        <OverallBadge severity={report.overallSeverity} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Open Trades" value={String(report.openTradeCount)} />
        <StatCard
          label="Violations"
          value={String(violations.length)}
          highlight={violations.length > 0 ? 'error' : undefined}
        />
        <StatCard
          label="Warnings"
          value={String(warnings.length)}
          highlight={warnings.length > 0 ? 'warning' : undefined}
        />
        <StatCard label="Passing" value={String(passing.length)} highlight="success" />
      </div>

      {report.checks.length === 0 && (
        <p className="text-sm text-text-secondary">
          No compliance rules to evaluate. Add position limits, risk thresholds, or
          allocation targets to your plan to enable monitoring.
        </p>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-error mb-2">
            Violations ({violations.length})
          </h3>
          <div className="space-y-2">
            {violations.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-warning mb-2">
            Warnings ({warnings.length})
          </h3>
          <div className="space-y-2">
            {warnings.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </div>
      )}

      {/* Passing */}
      {passing.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-success mb-2">
            Passing ({passing.length})
          </h3>
          <div className="space-y-2">
            {passing.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-text-secondary">
        Last evaluated: {report.timestamp.toLocaleTimeString()}
      </p>
    </div>
  );
}

function OverallBadge({ severity }: { severity: ComplianceSeverity }) {
  const variant = severity === 'violation' ? 'danger'
    : severity === 'warning' ? 'warning'
    : 'success';
  const label = severity === 'violation' ? 'Non-Compliant'
    : severity === 'warning' ? 'Attention Needed'
    : 'Compliant';

  return <Badge variant={variant}>{label}</Badge>;
}

function CheckRow({ check }: { check: ComplianceCheck }) {
  const borderColor = check.severity === 'violation'
    ? 'border-l-error'
    : check.severity === 'warning'
    ? 'border-l-warning'
    : 'border-l-success';

  return (
    <div className={`p-3 bg-surface-tertiary rounded-md border-l-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{check.label}</p>
          <p className="text-sm text-text-secondary">{check.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-text-primary">{check.currentValue}</p>
          <p className="text-xs text-text-secondary">{check.expectedValue}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: 'error' | 'warning' | 'success' }) {
  const valueColor = highlight === 'error' ? 'text-error'
    : highlight === 'warning' ? 'text-warning'
    : highlight === 'success' ? 'text-success'
    : 'text-text-primary';

  return (
    <div className="p-3 bg-surface-tertiary rounded-md text-center">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
