import { useCallback } from 'react';
import Select from '../ui/Select';
import Input from '../ui/Input';
import Button from '../ui/Button';
import type { Strategy } from '../../types/tradingPlan';
import type { Portfolio } from '../../types/portfolio';
import type { JournalFilters as Filters } from '../../db/journalRepository';

interface JournalFiltersProps {
  strategies: Strategy[];
  portfolios: Portfolio[];
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

const optionTypeOptions = [
  { value: '', label: 'All' },
  { value: 'Call', label: 'Call' },
  { value: 'Put', label: 'Put' },
];

const tradeStatusOptions = [
  { value: '', label: 'All' },
  { value: 'Open', label: 'Open' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Assigned', label: 'Assigned' },
];

const winLossOptions = [
  { value: '', label: 'All' },
  { value: 'Win', label: 'Win' },
  { value: 'Loss', label: 'Loss' },
];

export default function JournalFilters({
  strategies,
  portfolios,
  filters,
  onFilterChange,
}: JournalFiltersProps) {
  const update = useCallback(
    (patch: Partial<Filters>) => {
      onFilterChange({ ...filters, ...patch });
    },
    [filters, onFilterChange],
  );

  const strategyOptions = [
    { value: '', label: 'All Strategies' },
    ...strategies.map((s) => ({ value: s.id, label: s.name })),
  ];

  const portfolioOptions = [
    { value: '', label: 'All Accounts' },
    ...portfolios.map((p) => ({ value: p.id, label: p.name })),
  ];

  const clearFilters = () => {
    onFilterChange({ planId: filters.planId });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <Select
        label="Strategy"
        options={strategyOptions}
        value={filters.strategyId ?? ''}
        onChange={(e) => update({ strategyId: e.target.value || undefined })}
      />
      <Select
        label="Account"
        options={portfolioOptions}
        value={filters.portfolioId ?? ''}
        onChange={(e) => update({ portfolioId: e.target.value || undefined })}
      />
      <Input
        label="From"
        type="date"
        value={filters.dateFrom ? toDateString(filters.dateFrom) : ''}
        onChange={(e) =>
          update({ dateFrom: e.target.value ? new Date(e.target.value) : undefined })
        }
      />
      <Input
        label="To"
        type="date"
        value={filters.dateTo ? toDateString(filters.dateTo) : ''}
        onChange={(e) =>
          update({ dateTo: e.target.value ? new Date(e.target.value) : undefined })
        }
      />
      <Input
        label="Symbol"
        placeholder="e.g. AAPL"
        value={filters.stockSymbol ?? ''}
        onChange={(e) => update({ stockSymbol: e.target.value || undefined })}
      />
      <Select
        label="Option Type"
        options={optionTypeOptions}
        value={filters.optionType ?? ''}
        onChange={(e) => update({ optionType: (e.target.value as Filters['optionType']) || undefined })}
      />
      <Select
        label="Status"
        options={tradeStatusOptions}
        value={filters.tradeStatus ?? ''}
        onChange={(e) => update({ tradeStatus: (e.target.value as Filters['tradeStatus']) || undefined })}
      />
      <Select
        label="Win/Loss"
        options={winLossOptions}
        value={filters.winLoss === null ? '' : (filters.winLoss ?? '')}
        onChange={(e) => {
          const v = e.target.value;
          update({ winLoss: v === 'Win' || v === 'Loss' ? (v as 'Win' | 'Loss') : undefined });
        }}
      />
      <div className="flex items-end col-span-2 sm:col-span-1">
        <Button variant="secondary" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}

function toDateString(d: Date): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
