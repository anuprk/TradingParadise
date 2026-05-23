import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TradeJournalEntry } from '../../types/journal';
import type { TimePeriod } from '../../utils/optionsDashboard';
import { dailyIncomeData, monthlyIncomeData } from '../../utils/optionsDashboard';
import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

/**
 * Daily premium income trend (line) and monthly income bar chart.
 *
 * Requirements: 18.4, 18.5
 */

interface IncomeChartProps {
  entries: TradeJournalEntry[];
  period: TimePeriod;
}

export default function IncomeChart({ entries, period }: IncomeChartProps) {
  const daily = useMemo(() => dailyIncomeData(entries, period), [entries, period]);
  const monthly = useMemo(() => monthlyIncomeData(entries, period), [entries, period]);

  if (daily.length === 0 && monthly.length === 0) {
    return (
      <Card title="Income Trends">
        <p className="text-sm text-text-secondary text-center py-6">No income data available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily trend line chart */}
      {daily.length > 0 && (
        <Card title="Daily Premium Income">
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                  width={80}
                />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Premium']} />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Monthly bar chart */}
      {monthly.length > 0 && (
        <Card title="Monthly Premium Income">
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatCurrency(v)}
                  width={80}
                />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Premium']} />
                <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
