import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Trash2, Download, Upload, Check, X } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { usePlanStore } from '../stores/planStore';
import { useAppStore } from '../stores/appStore';
import { supabase } from '../lib/supabase';
import { getPlan, updatePlan, createPlan } from '../db/planRepository';
import { listPortfolios, createPortfolio } from '../db/portfolioRepository';
import { listJournalEntries, createJournalEntry } from '../db/journalRepository';
import { listReminders, createReminder } from '../db/reminderRepository';
import { serializePlan, deserializePlan, ValidationError } from '../utils/serialization';

/**
 * SettingsPage — Plan management (list, rename, delete) and JSON import/export.
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5, 16.1, 16.2, 16.3, 16.4
 */
export default function SettingsPage() {
  const { plans, loadPlans, deletePlan } = usePlanStore();
  const { activePlanId, setActivePlanId, addToast } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; hasEntries: boolean } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // --- Rename ---
  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    try {
      await updatePlan(editingId, { name: editName.trim() });
      await loadPlans();
      addToast('Plan renamed', 'success');
    } catch {
      addToast('Failed to rename plan', 'error');
    }
    setEditingId(null);
  }, [editingId, editName, loadPlans, addToast]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
  }, []);

  // --- Delete ---
  const initiateDelete = useCallback(async (id: string, name: string) => {
    const entries = await listJournalEntries(id);
    setDeleteTarget({ id, name, hasEntries: entries.length > 0 });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      // Delete associated data via Supabase
      await supabase.from('journal_entries').delete().eq('plan_id', deleteTarget.id);
      await supabase.from('portfolios').delete().eq('plan_id', deleteTarget.id);
      await supabase.from('reminders').delete().eq('plan_id', deleteTarget.id);
      await deletePlan(deleteTarget.id);
      if (activePlanId === deleteTarget.id) {
        setActivePlanId(null);
      }
      addToast('Plan deleted', 'success');
    } catch {
      addToast('Failed to delete plan', 'error');
    }
    setDeleteTarget(null);
  }, [deleteTarget, deletePlan, activePlanId, setActivePlanId, addToast]);

  // --- Export ---
  const handleExport = useCallback(async () => {
    if (!activePlanId) {
      addToast('No active plan to export', 'error');
      return;
    }
    try {
      const plan = await getPlan(activePlanId);
      if (!plan) {
        addToast('Plan not found', 'error');
        return;
      }
      const portfolios = await listPortfolios(activePlanId);
      const journalEntries = await listJournalEntries(activePlanId);
      const reminders = await listReminders(activePlanId);

      const json = serializePlan(plan, portfolios, journalEntries, reminders);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Plan exported successfully', 'success');
    } catch {
      addToast('Failed to export plan', 'error');
    }
  }, [activePlanId, addToast]);

  // --- Import ---
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const data = deserializePlan(text);

      // Create the plan and associated data
      await createPlan(data.plan);
      for (const p of data.portfolios) {
        await createPortfolio(p);
      }
      for (const je of data.journalEntries) {
        await createJournalEntry(je);
      }
      for (const r of data.reminders) {
        await createReminder(r);
      }

      await loadPlans();
      setActivePlanId(data.plan.id);
      addToast('Plan imported successfully', 'success');
    } catch (err) {
      if (err instanceof ValidationError) {
        addToast(err.message, 'error');
      } else {
        addToast('Failed to import plan: unexpected error', 'error');
      }
    } finally {
      setIsImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [loadPlans, setActivePlanId, addToast]);

  const activePlan = plans.find((p) => p.id === activePlanId);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      {/* Plan Management */}
      <Card title="Plan Management">
        {plans.length === 0 ? (
          <p className="text-sm text-text-secondary">No plans yet. Create one from the Plan Editor.</p>
        ) : (
          <ul className="divide-y divide-border" role="list" aria-label="Trading plans">
            {plans.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between py-3 gap-3">
                {editingId === plan.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmRename();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      className="flex-1"
                      aria-label="Plan name"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={confirmRename} aria-label="Save name">
                      <Check size={16} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelRename} aria-label="Cancel rename">
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button
                      className={`text-sm text-left flex-1 truncate ${
                        plan.id === activePlanId ? 'font-semibold text-text-accent' : 'text-text-primary'
                      }`}
                      onClick={() => setActivePlanId(plan.id)}
                      title={`Select ${plan.name}`}
                    >
                      {plan.name}
                      {plan.id === activePlanId && (
                        <span className="ml-2 text-xs text-indigo-500">(active)</span>
                      )}
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startRename(plan.id, plan.name)}
                        aria-label={`Rename ${plan.name}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => initiateDelete(plan.id, plan.name)}
                        aria-label={`Delete ${plan.name}`}
                      >
                        <Trash2 size={14} className="text-error" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Import / Export */}
      <Card title="Import / Export">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-text-secondary mb-2">
              Export the active plan and all associated data (portfolios, journal entries, reminders) to a JSON file.
            </p>
            <Button onClick={handleExport} disabled={!activePlanId}>
              <Download size={16} className="mr-2" />
              Export Plan
            </Button>
            {!activePlanId && (
              <p className="text-xs text-text-secondary mt-1">Select a plan to export.</p>
            )}
            {activePlan && (
              <p className="text-xs text-text-secondary mt-1">
                Exporting: {activePlan.name}
              </p>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <p className="text-sm text-text-secondary mb-2">
              Import a trading plan from a JSON file. The file will be validated before loading.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
              aria-label="Import plan file"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <Upload size={16} className="mr-2" />
              {isImporting ? 'Importing…' : 'Import Plan'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Plan"
        message={
          deleteTarget?.hasEntries
            ? `Are you sure you want to delete "${deleteTarget.name}"? This will also delete all associated journal entries, portfolios, and reminders.`
            : `Are you sure you want to delete "${deleteTarget?.name}"?`
        }
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
