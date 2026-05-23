import type { PerformanceSummaryData } from '../../types/transaction';
import Card from '../ui/Card';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

/**
 * Displays portfolio performance summary metrics at the top of the dashboard.
 * Shows: total portfolio value, realized P/L, unrealized P/L, overall return %, win rate.
 * Color-codes P/L values: green for positive, red for negative, neutral for zero.
 *
 * Requirements: 8.1, 8.4, 8.5
 */

interface PerformanceSummaryProps {
  data: PerformanceSummaryData;
}

/**
 * Returns the appropriate Tailwind text color class for a P/L value.
 * Green for positive, red for negative, default gray for zero.
 */
function getPLColorClass(value: number): string {
  if (value > 0) return 'text-success';
  if (value < 0) return 'text-error';
  return 'text-text-primary';
}

export default function PerformanceSummary({ data }: PerformanceSummaryProps) {
  const metrics = [
    {
      label: 'Total Portfolio Value',
      value: formatCurrency(data.totalPortfolioValue),
      colorClass: 'text-text-primary',
    },
    {
      label: 'Realized P/L',
      value: formatCurrency(data.totalRealizedPL),
      colorClass: getPLColorClass(data.totalRealizedPL),
    },
    {
      label: 'Unrealized P/L',
      value: formatCurrency(data.totalUnrealizedPL),
      colorClass: getPLColorClass(data.totalUnrealizedPL),
    },
    {
      label: 'Overall Return',
      value: formatPercentage(data.overallReturnPercentage, 1),
      colorClass: getPLColorClass(data.overallReturnPercentage),
    },
    {
      label: 'Win Rate',
      value: formatPercentage(data.winRate, 1),
      colorClass: 'text-text-primary',
    },
  ];

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wide">{metric.label}</p>
            <p className={`mt-1 text-lg font-semibold ${metric.colorClass}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
