import type { TradeJournalEntry } from '../../types/journal';
import Card from '../ui/Card';
import { formatCurrency } from '../../utils/formatters';
import {
  dailyPremiumIncome,
  weeklyPremiumIncome,
  monthlyPremiumIncome,
} from '../../utils/optionsDashboard';

/**
 * Displays daily, weekly, and monthly premium income totals.
 *
 * Requirements: 18.1, 18.2, 18.3
 */

interface PremiumIncomeProps {
  entries: TradeJournalEntry[];
}

export default function PremiumIncome({ entries }: PremiumIncomeProps) {
  const now = new Date();
  const daily = dailyPremiumIncome(entries, now);
  const weekly = weeklyPremiumIncome(entries, now);
  const monthly = monthlyPremiumIncome(entries, now);

  const items = [
    { label: 'Today', value: daily },
    { label: 'This Week', value: weekly },
    { label: 'This Month', value: monthly },
  ];

  return (
    <Card title="Premium Income">
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-xs text-text-secondary uppercase tracking-wide">{item.label}</p>
            <p className="mt-1 text-xl font-bold text-success">
              {formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
