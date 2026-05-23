import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { MarketRegime } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

const MIN_REGIMES = 3;
const MAX_REGIMES = 10;

interface MarketRegimeSectionProps {
  marketRegimes: MarketRegime[];
  onChange: (marketRegimes: MarketRegime[]) => void;
}

export default function MarketRegimeSection({
  marketRegimes,
  onChange,
}: MarketRegimeSectionProps) {
  const [newName, setNewName] = useState('');
  const [newConditions, setNewConditions] = useState('');
  const [newAdjustments, setNewAdjustments] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editConditions, setEditConditions] = useState('');
  const [editAdjustments, setEditAdjustments] = useState('');

  const atMax = marketRegimes.length >= MAX_REGIMES;

  function handleAdd() {
    const name = newName.trim();
    const conditions = newConditions.trim();
    const adjustments = newAdjustments.trim();
    if (!name || !conditions || !adjustments || atMax) return;

    const regime: MarketRegime = {
      id: uuidv4(),
      name,
      conditions,
      strategyAdjustments: adjustments,
    };
    onChange([...marketRegimes, regime]);
    setNewName('');
    setNewConditions('');
    setNewAdjustments('');
  }

  function handleRemove(id: string) {
    onChange(marketRegimes.filter((r) => r.id !== id));
  }

  function startEdit(regime: MarketRegime) {
    setEditingId(regime.id);
    setEditName(regime.name);
    setEditConditions(regime.conditions);
    setEditAdjustments(regime.strategyAdjustments);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditConditions('');
    setEditAdjustments('');
  }

  function saveEdit(id: string) {
    const name = editName.trim();
    const conditions = editConditions.trim();
    const adjustments = editAdjustments.trim();
    if (!name || !conditions || !adjustments) return;

    onChange(
      marketRegimes.map((r) =>
        r.id === id
          ? { ...r, name, conditions, strategyAdjustments: adjustments }
          : r,
      ),
    );
    cancelEdit();
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Market Regime Categories
      </h3>

      {marketRegimes.length < MIN_REGIMES && (
        <p className="text-sm text-blue-600 mb-3" role="status">
          At least {MIN_REGIMES} market regimes are required for plan validation.
        </p>
      )}

      {atMax && (
        <p className="text-sm text-warning mb-3" role="status">
          Maximum of {MAX_REGIMES} market regimes reached.
        </p>
      )}

      {marketRegimes.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label="Market regimes list">
          {marketRegimes.map((regime) => (
            <li
              key={regime.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === regime.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Regime Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Input
                    label="Conditions"
                    value={editConditions}
                    onChange={(e) => setEditConditions(e.target.value)}
                  />
                  <Input
                    label="Strategy Adjustments"
                    value={editAdjustments}
                    onChange={(e) => setEditAdjustments(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(regime.id)}>
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
                      {regime.name}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Conditions: {regime.conditions}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Adjustments: {regime.strategyAdjustments}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(regime)}
                      aria-label={`Edit regime: ${regime.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(regime.id)}
                      aria-label={`Remove regime: ${regime.name}`}
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

      {marketRegimes.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No market regimes defined yet. Add your first regime below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">
          Add Market Regime
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Regime Name"
            placeholder="e.g., Bullish"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            id="new-regime-name"
          />
          <Input
            label="Conditions"
            placeholder="e.g., SPX above 200 SMA"
            value={newConditions}
            onChange={(e) => setNewConditions(e.target.value)}
            id="new-regime-conditions"
          />
          <Input
            label="Strategy Adjustments"
            placeholder="e.g., Increase put selling"
            value={newAdjustments}
            onChange={(e) => setNewAdjustments(e.target.value)}
            id="new-regime-adjustments"
          />
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={
              !newName.trim() ||
              !newConditions.trim() ||
              !newAdjustments.trim() ||
              atMax
            }
          >
            Add Regime
          </Button>
        </div>
      </div>
    </div>
  );
}
