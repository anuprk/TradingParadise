import Badge from '../ui/Badge';
import Button from '../ui/Button';
import type { Strategy } from '../../types/tradingPlan';

interface StrategyCardProps {
  strategy: Strategy;
  onEdit: (strategy: Strategy) => void;
  onRemove: (strategyId: string) => void;
}

export default function StrategyCard({ strategy, onEdit, onRemove }: StrategyCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface-secondary">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-text-primary truncate">
              {strategy.name}
            </h4>
            <Badge variant={strategy.classification === 'Core' ? 'info' : 'warning'}>
              {strategy.classification}
            </Badge>
          </div>
          {strategy.description && (
            <p className="text-sm text-text-secondary line-clamp-2 mb-2">
              {strategy.description}
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            <span>Entry Criteria: {strategy.entryCriteria.length}</span>
            <span>Management Rules: {strategy.managementRules.length}</span>
            <span>Profit Targets: {strategy.profitTargets.length}</span>
            <span>Stop Losses: {strategy.stopLosses.length}</span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => onEdit(strategy)}>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => onRemove(strategy.id)}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
