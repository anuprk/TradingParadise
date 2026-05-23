import { useState, useMemo, useCallback } from 'react';
import { useJournal } from '../../hooks/useJournal';
import { useTradingPlan } from '../../hooks/useTradingPlan';
import { usePortfolio } from '../../hooks/usePortfolio';
import type { Strategy } from '../../types/tradingPlan';
import type { TimePeriod } from '../../utils/optionsDashboard';
import { computeAggregatedMetrics } from '../../utils/optionsDashboard';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { formatCurrency, formatPercentage, formatNumber } from '../../utils/formatters';
import PremiumIncome from './PremiumIncome';
import IncomeChart from './IncomeChart';
import CumulativePLChart from './CumulativePLChart';
import PerformanceByStrategy from './PerformanceByStrategy';

/**
 * Main Options Dashboard container.
 * Aggregates journal data into premium income, charts, and performance metrics.
 *
 * Requirements: 18.1–18.12
 */

interface DashboardFilters {
  portfolioId: string;
  strategyId: string;
  stockSymbol: string;
  optionType: string;
  dateFrom: string;
  dateTo: string;
}

const INITIAL_FILTERS: DashboardFilters = {
  portfolioId: '',
  strategyId: '',
  stockSymbol: '',
  optionType: '',
  dateFrom: '',
  dateTo: '',
};

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

const OPTION_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Call', label: 'Call' },
  { value: 'Put', label: 'Put' },
];

export default function OptionsDashboard() {
  const { entries } = useJournal();
  const { plan } = useTradingPlan();
  const { portfolios } = usePortfolio();

  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [period, setPeriod] = useState<TimePeriod>('all');

  const allStrategies: Strategy[] = useMemo(() => {
    if (!plan) return [];
    return [...plan.coreStrategies, ...plan.speculativeStrategies];
  }, [plan]);

  const strategyOptions = useMemo(
    () => [
      { value: '', label: 'All Strategies' },
      ...allStrategies.map((s) => ({ value: s.id, label: s.name })),
    ],
    [allStrategies],
  );

  const portfolioOptions = useMemo(
    () => [
      { value: '', label: 'All Accounts' },
      ...portfolios.map((p) => ({ value: p.id, label: p.name })),
    ],
    [portfolios],
  );

  // Apply local filters to entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filters.portfolioId) {
      result = result.filter((e) => e.portfolioId === filters.portfolioId);
    }
    if (filters.strategyId) {
      result = result.filter((e) => e.strategyId === filters.strategyId);
    }
    if (filters.stockSymbol) {
      const sym = filters.stockSymbol.toUpperCase();
      result = result.filter((e) => e.stockSymbol.toUpperCase().includes(sym));
    }
    if (filters.optionType) {
      result = result.filter((e) => e.optionType === filters.optionType);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      result = result.filter((e) => new Date(e.openDate).getTime() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      result = result.filter((e) => new Date(e.openDate).getTime() <= to);
    }

    return result;
  }, [entries, filters]);

  const metrics = useMemo(() => computeAggregatedMetrics(filteredEntries), [filteredEntries]);

  const updateFilter = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  const isEmpty = filteredEntries.length === 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card title="Filters">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select
            label="Account"
            options={portfolioOptions}
            value={filters.portfolioId}
            onChange={(e) => updateFilter({ portfolioId: e.target.value })}
          />
          <Select
            label="Strategy"
            options={strategyOptions}
            value={filters.strategyId}
            onChange={(e) => updateFilter({ strategyId: e.target.value })}
          />
          <Input
            label="Symbol"
            placeholder="e.g. AAPL"
            value={filters.stockSymbol}
            onChange={(e) => updateFilter({ stockSymbol: e.target.value })}
          />
          <Select
            label="Option Type"
            options={OPTION_TYPE_OPTIONS}
            value={filters.optionType}
            onChange={(e) => updateFilter({ optionType: e.target.value })}
          />
          <Input
            label="From"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter({ dateFrom: e.target.value })}
          />
          <Input
            label="To"
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter({ dateTo: e.target.value })}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Empty state */}
      {isEmpty && (
        <Card>
          <p className="text-sm text-text-secondary text-center py-8">
            No data available for the selected criteria.
          </p>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* Premium Income */}
          <PremiumIncome entries={filteredEntries} />

          {/* Aggregated Metrics */}
          <Card title="Performance Metrics">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: 'Total Trades', value: formatNumber(metrics.totalTrades, 0) },
                { label: 'Win Rate', value: formatPercentage(metrics.winRate) },
                { label: 'Total P/L', value: formatCurrency(metrics.totalPL) },
                { label: 'Avg P/L', value: formatCurrency(metrics.avgPL) },
                { label: 'Avg Ann. ROR', value: formatPercentage(metrics.avgAnnualizedROR) },
                { label: 'Avg Margin ROR', value: formatPercentage(metrics.avgMarginAnnualizedROR) },
                { label: 'Total Fees', value: formatCurrency(metrics.totalFees) },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-xs text-text-secondary uppercase tracking-wide">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Time period selector for charts */}
          <div className="flex gap-2">
            {TIME_PERIODS.map((tp) => (
              <button
                key={tp.value}
                onClick={() => setPeriod(tp.value)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${
                  period === tp.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-tertiary text-text-secondary hover:bg-surface-tertiary'
                }`}
              >
                {tp.label}
              </button>
            ))}
          </div>

          {/* Charts */}
          <IncomeChart entries={filteredEntries} period={period} />
          <CumulativePLChart entries={filteredEntries} period={period} />

          {/* Strategy breakdown */}
          <PerformanceByStrategy entries={filteredEntries} strategies={allStrategies} />
        </>
      )}
    </div>
  );
}
