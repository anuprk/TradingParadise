import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  RiskManagement,
  BPThreshold,
  PositionLimit,
} from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface RiskManagementSectionProps {
  riskManagement: RiskManagement;
  onChange: (riskManagement: RiskManagement) => void;
}

export default function RiskManagementSection({
  riskManagement,
  onChange,
}: RiskManagementSectionProps) {
  return (
    <div className="space-y-8">
      <BPThresholdsSubsection
        thresholds={riskManagement.bpThresholds}
        onChange={(bpThresholds) =>
          onChange({ ...riskManagement, bpThresholds })
        }
      />
      <PositionLimitsSubsection
        limits={riskManagement.positionLimits}
        onChange={(positionLimits) =>
          onChange({ ...riskManagement, positionLimits })
        }
      />
      <MaxLossSubsection
        maxLossPerTrade={riskManagement.maxLossPerTrade}
        maxLossPerPortfolio={riskManagement.maxLossPerPortfolio}
        onChange={(maxLossPerTrade, maxLossPerPortfolio) =>
          onChange({ ...riskManagement, maxLossPerTrade, maxLossPerPortfolio })
        }
      />
    </div>
  );
}


/* ── BP Thresholds ─────────────────────────────────────────────── */

function BPThresholdsSubsection({
  thresholds,
  onChange,
}: {
  thresholds: BPThreshold[];
  onChange: (t: BPThreshold[]) => void;
}) {
  const [newPercentage, setNewPercentage] = useState('');
  const [newAction, setNewAction] = useState('');
  const [addError, setAddError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPercentage, setEditPercentage] = useState('');
  const [editAction, setEditAction] = useState('');
  const [editError, setEditError] = useState('');

  function isDuplicate(pct: number, excludeId?: string): boolean {
    return thresholds.some(
      (t) => t.percentage === pct && t.id !== excludeId,
    );
  }

  function sortedInsert(list: BPThreshold[], item: BPThreshold): BPThreshold[] {
    const next = [...list, item];
    next.sort((a, b) => a.percentage - b.percentage);
    return next;
  }

  function handleAdd() {
    const pct = Number(newPercentage);
    const action = newAction.trim();
    if (isNaN(pct) || action === '') return;

    if (isDuplicate(pct)) {
      setAddError('A threshold with this percentage already exists');
      return;
    }
    setAddError('');

    const item: BPThreshold = {
      id: uuidv4(),
      percentage: pct,
      actionDescription: action,
    };
    onChange(sortedInsert(thresholds, item));
    setNewPercentage('');
    setNewAction('');
  }

  function handleRemove(id: string) {
    onChange(thresholds.filter((t) => t.id !== id));
  }

  function startEdit(t: BPThreshold) {
    setEditingId(t.id);
    setEditPercentage(String(t.percentage));
    setEditAction(t.actionDescription);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPercentage('');
    setEditAction('');
    setEditError('');
  }

  function saveEdit(id: string) {
    const pct = Number(editPercentage);
    const action = editAction.trim();
    if (isNaN(pct) || action === '') return;

    if (isDuplicate(pct, id)) {
      setEditError('A threshold with this percentage already exists');
      return;
    }
    setEditError('');

    const updated = thresholds.map((t) =>
      t.id === id ? { ...t, percentage: pct, actionDescription: action } : t,
    );
    updated.sort((a, b) => a.percentage - b.percentage);
    onChange(updated);
    cancelEdit();
  }

  const canAdd =
    newPercentage.trim() !== '' &&
    !isNaN(Number(newPercentage)) &&
    newAction.trim() !== '';

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Buying Power Thresholds
      </h3>

      {thresholds.length > 0 && (
        <ol className="space-y-2 mb-4" aria-label="BP thresholds list">
          {thresholds.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === t.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Percentage (%)"
                    type="number"
                    value={editPercentage}
                    onChange={(e) => setEditPercentage(e.target.value)}
                  />
                  <Input
                    label="Action Description"
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                  />
                  {editError && (
                    <p className="text-sm text-error">{editError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(t.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {t.percentage}% BP Usage
                    </p>
                    <p className="text-sm text-text-secondary">
                      {t.actionDescription}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(t)}
                      aria-label={`Edit threshold: ${t.percentage}%`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(t.id)}
                      aria-label={`Remove threshold: ${t.percentage}%`}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {thresholds.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No BP thresholds defined yet. Add your first threshold below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">
          Add BP Threshold
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Percentage (%)"
            type="number"
            placeholder="e.g., 50"
            value={newPercentage}
            onChange={(e) => {
              setNewPercentage(e.target.value);
              setAddError('');
            }}
            id="new-bp-percentage"
          />
          <Input
            label="Action Description"
            placeholder="e.g., Reduce positions by 25%"
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            id="new-bp-action"
          />
        </div>
        {addError && (
          <p className="mt-1 text-sm text-error">{addError}</p>
        )}
        <div className="mt-3">
          <Button size="sm" onClick={handleAdd} disabled={!canAdd}>
            Add Threshold
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ── Position Limits ───────────────────────────────────────────── */

function PositionLimitsSubsection({
  limits,
  onChange,
}: {
  limits: PositionLimit[];
  onChange: (l: PositionLimit[]) => void;
}) {
  const [newStrategy, setNewStrategy] = useState('');
  const [newMaxPositions, setNewMaxPositions] = useState('');
  const [newMaxPerUnderlying, setNewMaxPerUnderlying] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStrategy, setEditStrategy] = useState('');
  const [editMaxPositions, setEditMaxPositions] = useState('');
  const [editMaxPerUnderlying, setEditMaxPerUnderlying] = useState('');

  function handleAdd() {
    const strategy = newStrategy.trim();
    const maxPos = Number(newMaxPositions);
    const maxPer = Number(newMaxPerUnderlying);
    if (!strategy || isNaN(maxPos) || isNaN(maxPer)) return;

    const item: PositionLimit = {
      id: uuidv4(),
      strategyName: strategy,
      maxPositions: maxPos,
      maxPerUnderlying: maxPer,
    };
    onChange([...limits, item]);
    setNewStrategy('');
    setNewMaxPositions('');
    setNewMaxPerUnderlying('');
  }

  function handleRemove(id: string) {
    onChange(limits.filter((l) => l.id !== id));
  }

  function startEdit(l: PositionLimit) {
    setEditingId(l.id);
    setEditStrategy(l.strategyName);
    setEditMaxPositions(String(l.maxPositions));
    setEditMaxPerUnderlying(String(l.maxPerUnderlying));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditStrategy('');
    setEditMaxPositions('');
    setEditMaxPerUnderlying('');
  }

  function saveEdit(id: string) {
    const strategy = editStrategy.trim();
    const maxPos = Number(editMaxPositions);
    const maxPer = Number(editMaxPerUnderlying);
    if (!strategy || isNaN(maxPos) || isNaN(maxPer)) return;

    onChange(
      limits.map((l) =>
        l.id === id
          ? {
              ...l,
              strategyName: strategy,
              maxPositions: maxPos,
              maxPerUnderlying: maxPer,
            }
          : l,
      ),
    );
    cancelEdit();
  }

  const canAdd =
    newStrategy.trim() !== '' &&
    newMaxPositions.trim() !== '' &&
    !isNaN(Number(newMaxPositions)) &&
    newMaxPerUnderlying.trim() !== '' &&
    !isNaN(Number(newMaxPerUnderlying));

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Position Limits
      </h3>

      {limits.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label="Position limits list">
          {limits.map((l) => (
            <li
              key={l.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === l.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Strategy Name"
                    value={editStrategy}
                    onChange={(e) => setEditStrategy(e.target.value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Max Positions"
                      type="number"
                      value={editMaxPositions}
                      onChange={(e) => setEditMaxPositions(e.target.value)}
                    />
                    <Input
                      label="Max Per Underlying"
                      type="number"
                      value={editMaxPerUnderlying}
                      onChange={(e) => setEditMaxPerUnderlying(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(l.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {l.strategyName}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Max positions: {l.maxPositions} · Max per underlying:{' '}
                      {l.maxPerUnderlying}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(l)}
                      aria-label={`Edit limit: ${l.strategyName}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(l.id)}
                      aria-label={`Remove limit: ${l.strategyName}`}
                    >
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {limits.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No position limits defined yet. Add your first limit below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">
          Add Position Limit
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Strategy Name"
            placeholder="e.g., Iron Condor"
            value={newStrategy}
            onChange={(e) => setNewStrategy(e.target.value)}
            id="new-pl-strategy"
          />
          <Input
            label="Max Positions"
            type="number"
            placeholder="e.g., 5"
            value={newMaxPositions}
            onChange={(e) => setNewMaxPositions(e.target.value)}
            id="new-pl-max-positions"
          />
          <Input
            label="Max Per Underlying"
            type="number"
            placeholder="e.g., 2"
            value={newMaxPerUnderlying}
            onChange={(e) => setNewMaxPerUnderlying(e.target.value)}
            id="new-pl-max-per-underlying"
          />
        </div>
        <div className="mt-3">
          <Button size="sm" onClick={handleAdd} disabled={!canAdd}>
            Add Limit
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ── Max Loss Thresholds ───────────────────────────────────────── */

function MaxLossSubsection({
  maxLossPerTrade,
  maxLossPerPortfolio,
  onChange,
}: {
  maxLossPerTrade?: number;
  maxLossPerPortfolio?: number;
  onChange: (trade?: number, portfolio?: number) => void;
}) {
  function parseOptional(val: string): number | undefined {
    const trimmed = val.trim();
    if (trimmed === '') return undefined;
    const num = Number(trimmed);
    return isNaN(num) ? undefined : num;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Maximum Loss Thresholds
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Max Loss Per Trade ($)"
          type="number"
          placeholder="e.g., 500"
          value={maxLossPerTrade !== undefined ? String(maxLossPerTrade) : ''}
          onChange={(e) =>
            onChange(parseOptional(e.target.value), maxLossPerPortfolio)
          }
          id="max-loss-per-trade"
        />
        <Input
          label="Max Loss Per Portfolio ($)"
          type="number"
          placeholder="e.g., 5000"
          value={
            maxLossPerPortfolio !== undefined
              ? String(maxLossPerPortfolio)
              : ''
          }
          onChange={(e) =>
            onChange(maxLossPerTrade, parseOptional(e.target.value))
          }
          id="max-loss-per-portfolio"
        />
      </div>
    </div>
  );
}
