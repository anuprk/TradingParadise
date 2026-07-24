import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay } from 'date-fns';
import { formatProfitLoss } from '../../utils/formatters';
import type { TradeJournalEntry } from '../../types/journal';

interface PLCalendarProps {
  entries: TradeJournalEntry[];
  totalAccountSize?: number;
}

interface DayData {
  pl: number;
  trades: number;
}

export default function PLCalendar({ entries, totalAccountSize }: PLCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Build a map of close_date -> { pl, trades }
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const e of entries) {
      if (e.tradeStatus === 'Open' || !e.closeDate || e.profitLoss == null) continue;
      const key = format(new Date(e.closeDate), 'yyyy-MM-dd');
      const existing = map.get(key) ?? { pl: 0, trades: 0 };
      existing.pl += e.profitLoss;
      existing.trades += 1;
      map.set(key, existing);
    }
    return map;
  }, [entries]);

  // Monthly total
  const monthTotal = useMemo(() => {
    let pl = 0;
    let trades = 0;
    for (const [key, data] of dayMap) {
      const d = new Date(key + 'T12:00:00');
      if (isSameMonth(d, currentMonth)) {
        pl += data.pl;
        trades += data.trades;
      }
    }
    return { pl, trades };
  }, [dayMap, currentMonth]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const pctReturn = totalAccountSize && totalAccountSize > 0
    ? (monthTotal.pl / totalAccountSize) * 100
    : null;

  return (
    <div className="bg-surface-secondary rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded"
          >
            ←
          </button>
          <h3 className="text-sm font-bold text-text-primary">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded"
          >
            →
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-text-secondary">
            P/L:{' '}
            <span className={monthTotal.pl >= 0 ? 'text-success font-bold' : 'text-error font-bold'}>
              {formatProfitLoss(monthTotal.pl)}
            </span>
          </span>
          {pctReturn !== null && (
            <span className="text-text-secondary">
              Return:{' '}
              <span className={pctReturn >= 0 ? 'text-success font-bold' : 'text-error font-bold'}>
                {pctReturn >= 0 ? '+' : ''}{pctReturn.toFixed(2)}%
              </span>
            </span>
          )}
          <span className="text-text-secondary">{monthTotal.trades} trades</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-text-secondary py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const data = dayMap.get(key);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={key}
              className={`min-h-[60px] p-1 rounded text-center ${
                isCurrentMonth ? 'bg-surface-tertiary/30' : 'bg-transparent opacity-30'
              } ${isToday ? 'ring-1 ring-text-accent' : ''}`}
            >
              <p className={`text-[10px] font-medium ${isToday ? 'text-text-accent' : 'text-text-secondary'}`}>
                {format(day, 'd')}
              </p>
              {isCurrentMonth && data ? (
                <div className="mt-0.5">
                  <p className={`text-[10px] font-bold ${data.pl >= 0 ? 'text-success' : 'text-error'}`}>
                    {data.pl >= 0 ? '+' : ''}{data.pl.toFixed(0)}
                  </p>
                  <p className="text-[9px] text-text-secondary">{data.trades}t</p>
                  {totalAccountSize && totalAccountSize > 0 && (
                    <p className={`text-[9px] ${data.pl >= 0 ? 'text-success' : 'text-error'}`}>
                      {((data.pl / totalAccountSize) * 100).toFixed(2)}%
                    </p>
                  )}
                </div>
              ) : isCurrentMonth ? (
                <div className="mt-0.5">
                  <p className="text-[10px] text-text-secondary/50">0.00</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
