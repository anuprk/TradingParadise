import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { VacationRule } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface VacationSectionProps {
  vacationRules: VacationRule[];
  onChange: (vacationRules: VacationRule[]) => void;
}

export default function VacationSection({
  vacationRules,
  onChange,
}: VacationSectionProps) {
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  function handleAdd() {
    const text = newText.trim();
    if (!text) return;

    const rule: VacationRule = {
      id: uuidv4(),
      order: vacationRules.length + 1,
      text,
    };
    onChange([...vacationRules, rule]);
    setNewText('');
  }

  function handleRemove(id: string) {
    onChange(reorder(vacationRules.filter((r) => r.id !== id)));
  }

  function startEdit(rule: VacationRule) {
    setEditingId(rule.id);
    setEditText(rule.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;
    onChange(vacationRules.map((r) => (r.id === id ? { ...r, text } : r)));
    cancelEdit();
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...vacationRules];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(reorder(next));
  }

  function moveDown(index: number) {
    if (index >= vacationRules.length - 1) return;
    const next = [...vacationRules];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(reorder(next));
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Vacation Rules</h3>

      {vacationRules.length > 0 && (
        <ol className="space-y-2 mb-4 list-none" aria-label="Vacation rules list">
          {vacationRules.map((rule, index) => (
            <li
              key={rule.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === rule.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Rule Text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(rule.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="secondary" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-sm font-semibold text-text-secondary mt-0.5 w-6 text-right shrink-0">
                    {index + 1}.
                  </span>
                  <p className="flex-1 text-sm font-medium text-text-primary min-w-0">
                    {rule.text}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label={`Move rule up: ${rule.text}`}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveDown(index)}
                      disabled={index === vacationRules.length - 1}
                      aria-label={`Move rule down: ${rule.text}`}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(rule)}
                      aria-label={`Edit rule: ${rule.text}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(rule.id)}
                      aria-label={`Remove rule: ${rule.text}`}
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

      {vacationRules.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No vacation rules defined yet. Add your first rule below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add Vacation Rule</h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Rule Text"
              placeholder="e.g., Close all speculative positions before leaving"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              id="new-vacation-rule-text"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newText.trim()}
          >
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  );
}

function reorder(rules: VacationRule[]): VacationRule[] {
  return rules.map((r, i) => ({ ...r, order: i + 1 }));
}
