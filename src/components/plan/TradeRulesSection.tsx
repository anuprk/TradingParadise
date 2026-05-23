import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TradeRule } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

const MAX_RULES = 50;

interface TradeRulesSectionProps {
  tradeRules: TradeRule[];
  onChange: (tradeRules: TradeRule[]) => void;
}

export default function TradeRulesSection({
  tradeRules,
  onChange,
}: TradeRulesSectionProps) {
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');

  const atMax = tradeRules.length >= MAX_RULES;

  function handleAdd() {
    const text = newText.trim();
    if (!text || atMax) return;

    const category = newCategory.trim();
    const rule: TradeRule = {
      id: uuidv4(),
      order: tradeRules.length + 1,
      text,
      category: category || undefined,
    };
    onChange([...tradeRules, rule]);
    setNewText('');
    setNewCategory('');
  }

  function handleRemove(id: string) {
    const filtered = tradeRules.filter((r) => r.id !== id);
    onChange(reorder(filtered));
  }

  function startEdit(rule: TradeRule) {
    setEditingId(rule.id);
    setEditText(rule.text);
    setEditCategory(rule.category ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
    setEditCategory('');
  }

  function saveEdit(id: string) {
    const text = editText.trim();
    if (!text) return;

    const category = editCategory.trim();
    onChange(
      tradeRules.map((r) =>
        r.id === id
          ? { ...r, text, category: category || undefined }
          : r,
      ),
    );
    cancelEdit();
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...tradeRules];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(reorder(next));
  }

  function moveDown(index: number) {
    if (index >= tradeRules.length - 1) return;
    const next = [...tradeRules];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(reorder(next));
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Trade Rules</h3>

      {atMax && (
        <p className="text-sm text-warning mb-3" role="alert">
          Maximum of {MAX_RULES} rules reached. Remove a rule before adding more.
        </p>
      )}

      {tradeRules.length > 0 && (
        <ol className="space-y-2 mb-4 list-none" aria-label="Trade rules list">
          {tradeRules.map((rule, index) => (
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
                  <Input
                    label="Category (optional)"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {rule.text}
                    </p>
                    {rule.category && (
                      <p className="text-xs text-text-secondary mt-0.5">
                        Category: {rule.category}
                      </p>
                    )}
                  </div>
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
                      disabled={index === tradeRules.length - 1}
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

      {tradeRules.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No trade rules defined yet. Add your first rule below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add Trade Rule</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Rule Text"
            placeholder="e.g., Never add to a losing position"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            id="new-rule-text"
          />
          <Input
            label="Category (optional)"
            placeholder="e.g., Risk Management"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            id="new-rule-category"
          />
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newText.trim() || atMax}
          >
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  );
}

function reorder(rules: TradeRule[]): TradeRule[] {
  return rules.map((r, i) => ({ ...r, order: i + 1 }));
}
