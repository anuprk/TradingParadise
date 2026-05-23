import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyReturn } from '../../types/portfolio';
import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';

/**
 * Portfolio performance chart showing historical Net Liquidation
 * and cumulative P/L over time using Recharts.
 *
 * Requirements: 17.11
 */

type TimePeriod = 'All' | '1Y' | '6M' | '3M';

interface PerformanceChartProps {
  monthlyReturns: MonthlyReturn[];
  initialBalance: number;
}

const PERIOD_MONTHS: Record<TimePeriod, number | null> = {
  All: null,
  '1Y': 12,
  '6M': 6,
  '3M': 3,
};

export default function PerformanceChart({ monthlyReturns, initialBalance }: PerformanceChartProps) {
  const [period, setPeriod] = useState<TimePeriod>('All');

  const chartData = useMemo(() => {
    const sorted = [...monthlyReturns].sort((a, b) => a.month.localeCompare(b.month));
    const limit = PERIOD_MONTHS[period];
    // Compute running cumulative P/L and net liquidation from the full sorted array
    // so that sliced data reflects correct cumulative values.
    let cumulativePL = 0;
    const fullData = sorted.map((mr) => {
      cumulativePL += mr.dollarReturn;
      return {
        month: mr.month,
        netLiquidation: initialBalance + cumulativePL,
        cumulativePL,
      };
    });

    if (!limit) return fullData;

    // Return only the last N months
    return fullData.slice(-limit);
  }, [monthlyReturns, initialBalance, period]);

  if (monthlyReturns.length === 0) {
    return (
      <Card title="Performance Chart">
        <p className="text-sm text-text-secondary text-center py-6">No performance data available</p>
      </Card>
    );
  }

  return (
    <Card title="Performance Chart">
      {/* Time period selector */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(PERIOD_MONTHS) as TimePeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
              period === p
                ? 'bg-blue-600 text-white'
                : 'bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => formatCurrency(v)}
              width={90}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'netLiquidation' ? 'Net Liquidation' : 'Cumulative P/L',
              ]}
              labelFormatter={(label: ReactNode) => `Month: ${label}`}
            />
            <Legend
              formatter={(value: string) =>
                value === 'netLiquidation' ? 'Net Liquidation' : 'Cumulative P/L'
              }
            />
            <Line
              type="monotone"
              dataKey="netLiquidation"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="cumulativePL"
              stroke="#10b981"
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
