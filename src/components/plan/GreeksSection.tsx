import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { GreeksTarget } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

const DEFAULT_METRICS = ['Delta', 'Theta', 'Vega'];

interface GreeksSectionProps {
  greeksTargets: GreeksTarget[];
  onChange: (greeksTargets: GreeksTarget[]) => void;
}

function validateRange(min?: number, max?: number): string | undefined {
  if (min !== undefined && max !== undefined && min > max) {
    return 'Min value must be less than or equal to max value';
  }
  return undefined;
}

export default function GreeksSection({ greeksTargets, onChange }: GreeksSectionProps) {
  const [newMetricName, setNewMetricName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMinValue, setNewMinValue] = useState('');
  const [newMaxValue, setNewMaxValue] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMetricName, setEditMetricName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMinValue, setEditMinValue] = useState('');
  const [editMaxValue, setEditMaxValue] = useState('');

  const parseOptionalNumber = (val: string): number | undefined => {
    const trimmed = val.trim();
    if (trimmed === '') return undefined;
    const num = Number(trimmed);
    return isNaN(num) ? undefined : num;
  };

  const newMin = parseOptionalNumber(newMinValue);
  const newMax = parseOptionalNumber(newMaxValue);
  const newRangeError = validateRange(newMin, newMax);

  const editMin = parseOptionalNumber(editMinValue);
  const editMax = parseOptionalNumber(editMaxValue);
  const editRangeError = validateRange(editMin, editMax);

  const canAdd = newMetricName.trim() !== '' && newDescription.trim() !== '' && !newRangeError;

  function handleAdd() {
    if (!canAdd) return;
    const target: GreeksTarget = {
      id: uuidv4(),
      metricName: newMetricName.trim(),
      targetDescription: newDescription.trim(),
      minValue: newMin,
      maxValue: newMax,
    };
    onChange([...greeksTargets, target]);
    setNewMetricName('');
    setNewDescription('');
    setNewMinValue('');
    setNewMaxValue('');
  }

  function handleRemove(id: string) {
    onChange(greeksTargets.filter((t) => t.id !== id));
  }

  function startEdit(target: GreeksTarget) {
    setEditingId(target.id);
    setEditMetricName(target.metricName);
    setEditDescription(target.targetDescription);
    setEditMinValue(target.minValue !== undefined ? String(target.minValue) : '');
    setEditMaxValue(target.maxValue !== undefined ? String(target.maxValue) : '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMetricName('');
    setEditDescription('');
    setEditMinValue('');
    setEditMaxValue('');
  }

  function saveEdit(id: string) {
    const name = editMetricName.trim();
    const desc = editDescription.trim();
    if (!name || !desc || editRangeError) return;

    onChange(
      greeksTargets.map((t) =>
        t.id === id
          ? { ...t, metricName: name, targetDescription: desc, minValue: editMin, maxValue: editMax }
          : t,
      ),
    );
    cancelEdit();
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Portfolio Greeks Targets</h3>

      {greeksTargets.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label="Greeks targets list">
          {greeksTargets.map((target) => (
            <li
              key={target.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === target.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Metric Name"
                    value={editMetricName}
                    onChange={(e) => setEditMetricName(e.target.value)}
                  />
                  <Input
                    label="Target Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Min Value"
                      type="number"
                      value={editMinValue}
                      onChange={(e) => setEditMinValue(e.target.value)}
                    />
                    <Input
                      label="Max Value"
                      type="number"
                      value={editMaxValue}
                      onChange={(e) => setEditMaxValue(e.target.value)}
                    />
                  </div>
                  {editRangeError && (
                    <p className="text-sm text-error">{editRangeError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(target.id)} disabled={!!editRangeError}>
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
                      {target.metricName}
                    </p>
                    <p className="text-sm text-text-secondary">
                      {target.targetDescription}
                    </p>
                    {(target.minValue !== undefined || target.maxValue !== undefined) && (
                      <p className="text-xs text-text-secondary mt-1">
                        Range:{' '}
                        {target.minValue !== undefined ? target.minValue : '—'}
                        {' to '}
                        {target.maxValue !== undefined ? target.maxValue : '—'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(target)}
                      aria-label={`Edit target: ${target.metricName}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(target.id)}
                      aria-label={`Remove target: ${target.metricName}`}
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

      {greeksTargets.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No Greeks targets defined yet. Add your first target below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add Greeks Target</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Metric Name"
            placeholder="e.g., Delta, Theta, Vega"
            value={newMetricName}
            onChange={(e) => setNewMetricName(e.target.value)}
            id="new-greek-metric-name"
            list="default-metrics"
          />
          <Input
            label="Target Description"
            placeholder="e.g., Keep portfolio delta neutral"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            id="new-greek-description"
          />
          <Input
            label="Min Value (optional)"
            type="number"
            placeholder="e.g., -5"
            value={newMinValue}
            onChange={(e) => setNewMinValue(e.target.value)}
            id="new-greek-min"
          />
          <Input
            label="Max Value (optional)"
            type="number"
            placeholder="e.g., 5"
            value={newMaxValue}
            onChange={(e) => setNewMaxValue(e.target.value)}
            id="new-greek-max"
          />
        </div>
        {newRangeError && (
          <p className="mt-1 text-sm text-error">{newRangeError}</p>
        )}
        <datalist id="default-metrics">
          {DEFAULT_METRICS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            Add Target
          </Button>
        </div>
      </div>
    </div>
  );
}
