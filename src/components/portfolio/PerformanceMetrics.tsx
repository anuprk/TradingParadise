import type { PortfolioMetrics } from '../../types/portfolio';
import Card from '../ui/Card';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';

/**
 * Displays portfolio performance metrics: monthly returns, max drawdown,
 * cumulative return, win rate, avg trade return, total trades.
 *
 * Requirements: 17.4, 17.12
 */

interface PerformanceMetricsProps {
  metrics: PortfolioMetrics;
}

export default function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const stats = [
    { label: 'Cumulative Return', value: formatPercentage(metrics.cumulativeReturn) },
    { label: 'Max Drawdown', value: formatCurrency(metrics.maxDrawdown) },
    { label: 'Win Rate', value: formatPercentage(metrics.winRate) },
    { label: 'Avg Trade Return', value: formatCurrency(metrics.averageTradeReturn) },
    { label: 'Total Trades', value: formatNumber(metrics.totalTrades, 0) },
  ];

  return (
    <Card title="Performance Metrics">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wide">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {metrics.monthlyReturns.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-text-primary mb-2">Monthly Returns</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-surface-tertiary">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-text-secondary uppercase">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">Dollar Return</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-text-secondary uppercase">% Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {metrics.monthlyReturns.map((mr) => (
                  <tr key={mr.month}>
                    <td className="px-3 py-2 text-text-primary">{mr.month}</td>
                    <td className={`px-3 py-2 text-right ${mr.dollarReturn >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(mr.dollarReturn)}
                    </td>
                    <td className={`px-3 py-2 text-right ${mr.percentageReturn >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatPercentage(mr.percentageReturn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
