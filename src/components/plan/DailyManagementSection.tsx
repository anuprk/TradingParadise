import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { DailyManagement, ChecklistItem } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface DailyManagementSectionProps {
  dailyManagement: DailyManagement;
  onChange: (dailyManagement: DailyManagement) => void;
}

export default function DailyManagementSection({
  dailyManagement,
  onChange,
}: DailyManagementSectionProps) {
  return (
    <div className="space-y-8">
      <ChecklistEditor
        title="Nightly Review"
        reviewType="nightly"
        items={dailyManagement.nightlyReview}
        onChange={(nightlyReview) => onChange({ ...dailyManagement, nightlyReview })}
      />
      <ChecklistEditor
        title="Morning Review"
        reviewType="morning"
        items={dailyManagement.morningReview}
        onChange={(morningReview) => onChange({ ...dailyManagement, morningReview })}
      />
    </div>
  );
}

interface ChecklistEditorProps {
  title: string;
  reviewType: 'nightly' | 'morning';
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

function ChecklistEditor({ title, reviewType, items, onChange }: ChecklistEditorProps) {
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  function handleAdd() {
    const description = newDescription.trim();
    if (!description) return;

    const item: ChecklistItem = {
      id: uuidv4(),
      order: items.length + 1,
      description,
      reviewType,
    };
    onChange([...items, item]);
    setNewDescription('');
  }

  function handleRemove(id: string) {
    onChange(reorder(items.filter((i) => i.id !== id)));
  }

  function startEdit(item: ChecklistItem) {
    setEditingId(item.id);
    setEditDescription(item.description);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDescription('');
  }

  function saveEdit(id: string) {
    const description = editDescription.trim();
    if (!description) return;
    onChange(items.map((i) => (i.id === id ? { ...i, description } : i)));
    cancelEdit();
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(reorder(next));
  }

  function moveDown(index: number) {
    if (index >= items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(reorder(next));
  }

  const listLabel = `${title} checklist`;

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>

      {items.length > 0 && (
        <ol className="space-y-2 mb-4 list-none" aria-label={listLabel}>
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === item.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(item.id)}>
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
                    {item.description}
                  </p>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      aria-label={`Move item up: ${item.description}`}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveDown(index)}
                      disabled={index === items.length - 1}
                      aria-label={`Move item down: ${item.description}`}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit item: ${item.description}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(item.id)}
                      aria-label={`Remove item: ${item.description}`}
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

      {items.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No {title.toLowerCase()} items defined yet. Add your first item below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add {title} Item</h4>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Description"
              placeholder={`e.g., Review open positions`}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              id={`new-${reviewType}-description`}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newDescription.trim()}
          >
            Add Item
          </Button>
        </div>
      </div>
    </div>
  );
}

function reorder(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item, i) => ({ ...item, order: i + 1 }));
}
