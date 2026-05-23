import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import type { JournalSummary as Summary } from '../../stores/journalStore';

interface JournalSummaryProps {
  summary: Summary;
  compliancePercentage?: number;
}

export default function JournalSummary({ summary, compliancePercentage }: JournalSummaryProps) {
  const items = [
    { label: 'Total Trades', value: String(summary.totalTrades) },
    { label: 'Win Rate', value: formatPercentage(summary.winRate) },
    { label: 'Total P/L', value: formatCurrency(summary.totalPL) },
    { label: 'Avg P/L', value: formatCurrency(summary.avgPL) },
    { label: 'Total Fees', value: formatCurrency(summary.totalFees) },
  ];

  function complianceVariant(): 'success' | 'warning' | 'danger' {
    if (compliancePercentage == null) return 'neutral' as 'success';
    if (compliancePercentage >= 90) return 'success';
    if (compliancePercentage >= 70) return 'warning';
    return 'danger';
  }

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wide">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{item.value}</p>
          </div>
        ))}
        {compliancePercentage != null && (
          <div className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wide">Compliance</p>
            <p className="mt-1">
              <Badge variant={complianceVariant()}>
                {formatPercentage(compliancePercentage)}
              </Badge>
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
