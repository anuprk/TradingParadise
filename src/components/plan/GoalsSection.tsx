import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Goal } from '../../types/tradingPlan';
import Input from '../ui/Input';
import Button from '../ui/Button';

interface GoalsSectionProps {
  goals: Goal[];
  onChange: (goals: Goal[]) => void;
}

export default function GoalsSection({ goals, onChange }: GoalsSectionProps) {
  const [newDescription, setNewDescription] = useState('');
  const [newTargetValue, setNewTargetValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTargetValue, setEditTargetValue] = useState('');

  function handleAdd() {
    const desc = newDescription.trim();
    const target = newTargetValue.trim();
    if (!desc || !target) return;

    const goal: Goal = {
      id: uuidv4(),
      description: desc,
      targetValue: target,
    };
    onChange([...goals, goal]);
    setNewDescription('');
    setNewTargetValue('');
  }

  function handleRemove(id: string) {
    onChange(goals.filter((g) => g.id !== id));
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setEditDescription(goal.description);
    setEditTargetValue(goal.targetValue);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDescription('');
    setEditTargetValue('');
  }

  function saveEdit(id: string) {
    const desc = editDescription.trim();
    const target = editTargetValue.trim();
    if (!desc || !target) return;

    onChange(
      goals.map((g) =>
        g.id === id ? { ...g, description: desc, targetValue: target } : g,
      ),
    );
    cancelEdit();
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">Goals</h3>

      {goals.length > 0 && (
        <ul className="space-y-2 mb-4" aria-label="Goals list">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="flex items-start gap-3 p-3 bg-surface-tertiary rounded-md"
            >
              {editingId === goal.id ? (
                <div className="flex-1 space-y-2">
                  <Input
                    label="Description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  <Input
                    label="Target Value"
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(goal.id)}>
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
                      {goal.description}
                    </p>
                    <p className="text-sm text-text-secondary">
                      Target: {goal.targetValue}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(goal)}
                      aria-label={`Edit goal: ${goal.description}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemove(goal.id)}
                      aria-label={`Remove goal: ${goal.description}`}
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

      {goals.length === 0 && (
        <p className="text-sm text-text-secondary mb-4">
          No goals defined yet. Add your first goal below.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h4 className="text-sm font-medium text-text-secondary mb-2">Add Goal</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Description"
            placeholder="e.g., Generate monthly income"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            id="new-goal-description"
          />
          <Input
            label="Target Value"
            placeholder="e.g., $5,000/month"
            value={newTargetValue}
            onChange={(e) => setNewTargetValue(e.target.value)}
            id="new-goal-target"
          />
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newDescription.trim() || !newTargetValue.trim()}
          >
            Add Goal
          </Button>
        </div>
      </div>
    </div>
  );
}
