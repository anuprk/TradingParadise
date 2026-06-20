import { useState, useCallback } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import type { JournalFilters as Filters } from '../../db/journalRepository';
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns';

interface JournalFiltersProps {
  symbols: string[];
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

type DatePreset = 'all' | 'today' | 'this-week' | 'this-month' | 'custom';

const ALL_STATUSES: string[] = ['Open', 'Closed', 'Expired', 'Assigned'];

function getSelectedStatuses(filters: Filters): string[] {
  if (!filters.tradeStatus) return [];
  if (Array.isArray(filters.tradeStatus)) return filters.tradeStatus;
  return [filters.tradeStatus];
}

function getDatePreset(filters: Filters): DatePreset {
  if (!filters.dateFrom && !filters.dateTo) return 'all';
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  if (filters.dateFrom && filters.dateFrom.getTime() === todayStart.getTime() && !filters.dateTo) return 'today';
  if (filters.dateFrom && filters.dateFrom.getTime() === weekStart.getTime() && !filters.dateTo) return 'this-week';
  if (filters.dateFrom && filters.dateFrom.getTime() === monthStart.getTime() && !filters.dateTo) return 'this-month';
  return 'custom';
}

export default function JournalFilters({
  symbols,
  filters,
  onFilterChange,
}: JournalFiltersProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>(() => getDatePreset(filters));

  const update = useCallback(
    (patch: Partial<Filters>) => {
      onFilterChange({ ...filters, ...patch });
    },
    [filters, onFilterChange],
  );

  const handleDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    switch (preset) {
      case 'all':
        update({ dateFrom: undefined, dateTo: undefined });
        break;
      case 'today':
        update({ dateFrom: startOfDay(now), dateTo: undefined });
        break;
      case 'this-week':
        update({ dateFrom: startOfWeek(now, { weekStartsOn: 1 }), dateTo: undefined });
        break;
      case 'this-month':
        update({ dateFrom: startOfMonth(now), dateTo: undefined });
        break;
      case 'custom':
        // Keep existing dates, just switch to custom mode
        break;
    }
  };

  const handleStatusToggle = (status: string) => {
    const current = getSelectedStatuses(filters);
    let next: string[];
    if (current.includes(status)) {
      next = current.filter((s) => s !== status);
    } else {
      next = [...current, status];
    }
    // If all are selected or none are selected, clear the filter (show all)
    if (next.length === 0 || next.length === ALL_STATUSES.length) {
      update({ tradeStatus: undefined });
    } else if (next.length === 1) {
      update({ tradeStatus: next[0] as Filters['tradeStatus'] });
    } else {
      update({ tradeStatus: next as unknown as Filters['tradeStatus'] });
    }
  };

  const clearFilters = () => {
    setDatePreset('all');
    onFilterChange({ planId: filters.planId, tradeStatus: ['Open'] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Symbol filter */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Symbol</label>
          <select
            className="block rounded-md border border-border bg-input-bg text-text-primary px-2 py-1.5 text-sm"
            value={filters.stockSymbol ?? ''}
            onChange={(e) => update({ stockSymbol: e.target.value || undefined })}
          >
            <option value="">All</option>
            {symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Date preset */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Date</label>
          <div className="flex gap-1">
            {([
              ['all', 'All'],
              ['today', 'Today'],
              ['this-week', 'Week'],
              ['this-month', 'Month'],
              ['custom', 'Custom'],
            ] as [DatePreset, string][]).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleDatePreset(preset)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  datePreset === preset
                    ? 'bg-text-accent text-white border-text-accent'
                    : 'border-border text-text-secondary hover:text-text-primary hover:border-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {datePreset === 'custom' && (
          <>
            <div>
              <Input
                label="From"
                type="date"
                value={filters.dateFrom ? toDateString(filters.dateFrom) : ''}
                onChange={(e) =>
                  update({ dateFrom: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined })
                }
              />
            </div>
            <div>
              <Input
                label="To"
                type="date"
                value={filters.dateTo ? toDateString(filters.dateTo) : ''}
                onChange={(e) =>
                  update({ dateTo: e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined })
                }
              />
            </div>
          </>
        )}

        {/* Win/Loss filter */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Result</label>
          <select
            className="block rounded-md border border-border bg-input-bg text-text-primary px-2 py-1.5 text-sm"
            value={filters.winLoss === null ? '' : (filters.winLoss ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              update({ winLoss: v === 'Win' || v === 'Loss' ? (v as 'Win' | 'Loss') : undefined });
            }}
          >
            <option value="">All</option>
            <option value="Win">Win</option>
            <option value="Loss">Loss</option>
          </select>
        </div>

        {/* Clear */}
        <div className="flex items-end">
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Reset
          </Button>
        </div>
      </div>

      {/* Status checkboxes */}
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-text-secondary">Status:</span>
        {ALL_STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={getSelectedStatuses(filters).includes(status)}
              onChange={() => handleStatusToggle(status)}
              className="rounded border-border text-text-accent focus:ring-text-accent h-3.5 w-3.5"
            />
            <span className="text-xs text-text-primary">{status}</span>
          </label>
        ))}
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
