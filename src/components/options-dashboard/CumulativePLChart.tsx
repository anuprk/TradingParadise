import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TradeJournalEntry } from '../../types/journal';
import type { TimePeriod } from '../../utils/optionsDashboard';
import { cumulativePLData } from '../../utils/optionsDashboard';
import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

/**
 * Cumulative P/L line chart over time.
 *
 * Requirements: 18.11
 */

interface CumulativePLChartProps {
  entries: TradeJournalEntry[];
  period: TimePeriod;
}

export default function CumulativePLChart({ entries, period }: CumulativePLChartProps) {
  const data = useMemo(() => cumulativePLData(entries, period), [entries, period]);

  if (data.length === 0) {
    return (
      <Card title="Cumulative P/L">
        <p className="text-sm text-text-secondary text-center py-6">No P/L data available</p>
      </Card>
    );
  }

  return (
    <Card title="Cumulative P/L">
      <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => formatCurrency(v)}
              width={80}
            />
            <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Cumulative P/L']} />
            <Line
              type="monotone"
              dataKey="cumulativePL"
              stroke="#6366f1"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
