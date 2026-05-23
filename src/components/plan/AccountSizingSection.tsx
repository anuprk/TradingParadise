import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AccountSizing, StrategyAllocation } from '../../types/tradingPlan';
import { validateAllocationSum } from '../../schemas/tradingPlanSchema';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface AccountSizingSectionProps {
  accountSizing: AccountSizing;
  onChange: (accountSizing: AccountSizing) => void;
}

export default function AccountSizingSection({ accountSizing, onChange }: AccountSizingSectionProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [newPositions, setNewPositions] = useState('');
  const [newPositionSizing, setNewPositionSizing] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editPercentage, setEditPercentage] = useState('');
  const [editPositions, setEditPositions] = useState('');
  const [editPositionSizing, setEditPositionSizing] = useState('');

  const allocationValidation = validateAllocationSum(accountSizing.allocations);

  function handleAccountSizeChange(value: string) {
    const num = parseFloat(value);
    onChange({ ...accountSizing, totalAccountSize: isNaN(num) ? 0 : num });
  }

  function handleAdd() {
    const name = newCategoryName.trim();
    const pct = parseFloat(newPercentage);
    if (!name || isNaN(pct)) return;

    const allocation: StrategyAllocation = {
      id: uuidv4(),
      categoryName: name,
      allocationPercentage: pct,
      ...(newPositions.trim() ? { numberOfPositions: parseInt(newPositions, 10) } : {}),
      ...(newPositionSizing.trim() ? { positionSizing: newPositionSizing.trim() } : {}),
    };
    onChange({ ...accountSizing, allocations: [...accountSizing.allocations, allocation] });
    setNewCategoryName('');
    setNewPercentage('');
    setNewPositions('');
    setNewPositionSizing('');
  }

  function handleRemove(id: string) {
    onChange({ ...accountSizing, allocations: accountSizing.allocations.filter((a) => a.id !== id) });
  }

  function startEdit(alloc: StrategyAllocation) {
    setEditingId(alloc.id);
    setEditCategoryName(alloc.categoryName);
    setEditPercentage(String(alloc.allocationPercentage));
    setEditPositions(alloc.numberOfPositions != null ? String(alloc.numberOfPositions) : '');
    setEditPositionSizing(alloc.positionSizing ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditCategoryName('');
    setEditPercentage('');
    setEditPositions('');
    setEditPositionSizing('');
  }

  function saveEdit(id: string) {
    const name = editCategoryName.trim();
    const pct = parseFloat(editPercentage);
    if (!name || isNaN(pct)) return;

    onChange({
      ...accountSizing,
      allocations: accountSizing.allocations.map((a) =>
        a.id === id
          ? {
              ...a,
              categoryName: name,
              allocationPercentage: pct,
              numberOfPositions: editPositions.trim() ? parseInt(editPositions, 10) : undefined,
              positionSizing: editPositionSizing.trim() || undefined,
            }
          : a,
      ),
    });
    cancelEdit();
  }

  function calcDollarAmount(pct: number): string {
    const amount = (pct / 100) * accountSizing.totalAccountSize;
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  return (
    <div>
      {/* Total Account Size */}
      <div className="mb-6">
        <Input
          label="Total Account Size ($)"
          type="number"
          value={accountSizing.totalAccountSize === 0 ? '' : String(accountSizing.totalAccountSize)}
          onChange={(e) => handleAccountSizeChange(e.target.value)}
          placeholder="e.g., 100000"
          id="total-account-size"
        />
      </div>

      {/* Allocation warning */}
      {accountSizing.allocations.length > 0 && !allocationValidation.isValid && (
        <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-md" role="alert">
          <p className="text-sm text-warning">{allocationValidation.warning}</p>
        </div>
      )}

      <h3 className="text-sm font-semibold text-text-primary mb-3">Strategy Allocations</h3>

      {accountSizing.allocations.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label="Allocations list">
          {accountSizing.allocations.map((alloc) => (
            <li key={alloc.id} className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md">
              {editingId === alloc.id ? (
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Category Name"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                    />
                    <Input
                      label="Allocation %"
                      type="number"
                      value={editPercentage}
                      onChange={(e) => setEditPercentage(e.target.value)}
                    />
                    <Input
                      label="Number of Positions"
                      type="number"
                      value={editPositions}
                      onChange={(e) => setEditPositions(e.target.value)}
                      placeholder="Optional"
                    />
                    <Input
                      label="Position Sizing"
                      value={editPositionSizing}
                      onChange={(e) => setEditPositionSizing(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(alloc.id)}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{alloc.categoryName}</p>
                    <p className="text-sm text-text-secondary">
                      {alloc.allocationPercentage}% — {calcDollarAmount(alloc.allocationPercentage)}
                    </p>
                    {alloc.numberOfPositions != null && (
                      <p className="text-sm text-text-secondary">Positions: {alloc.numberOfPositions}</p>
                    )}
                    {alloc.positionSizing && (
                      <p className="text-sm text-text-secondary">Sizing: {alloc.positionSizing}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(alloc)}
                      aria-label={`Edit allocation: ${alloc.categoryName}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(alloc.id)}
                      aria-label={`Remove allocation: ${alloc.categoryName}`}
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

      {accountSizing.allocations.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No allocations defined yet. Add your first allocation below.
        </p>
      )}

      {/* Add allocation form */}
      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add Allocation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Category Name"
            placeholder="e.g., Core Income"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            id="new-alloc-category"
          />
          <Input
            label="Allocation %"
            type="number"
            placeholder="e.g., 60"
            value={newPercentage}
            onChange={(e) => setNewPercentage(e.target.value)}
            id="new-alloc-percentage"
          />
          <Input
            label="Number of Positions"
            type="number"
            placeholder="Optional"
            value={newPositions}
            onChange={(e) => setNewPositions(e.target.value)}
            id="new-alloc-positions"
          />
          <Input
            label="Position Sizing"
            placeholder="Optional, e.g., $5,000 per position"
            value={newPositionSizing}
            onChange={(e) => setNewPositionSizing(e.target.value)}
            id="new-alloc-sizing"
          />
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newCategoryName.trim() || !newPercentage.trim() || isNaN(parseFloat(newPercentage))}
          >
            Add Allocation
          </Button>
        </div>
      </div>
    </div>
  );
}
