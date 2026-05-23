import { useState } from 'react';
import { addDays } from 'date-fns';
import { Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ReminderForm from '../components/reminders/ReminderForm';
import ReminderList from '../components/reminders/ReminderList';
import { useReminders } from '../hooks/useReminders';
import { useAppStore } from '../stores/appStore';
import type { Reminder } from '../types/reminder';

export default function RemindersPage() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const addToast = useAppStore((s) => s.addToast);
  const { reminders, createReminder, updateReminder, deleteReminder, markComplete, snooze, dismiss } = useReminders();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!activePlanId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Reminders</h1>
        <p className="mt-2 text-text-secondary">Select a trading plan to manage reminders.</p>
      </div>
    );
  }

  const handleSave = async (reminder: Reminder) => {
    if (editing) {
      await updateReminder(reminder.id, reminder);
      addToast('Reminder updated', 'success');
    } else {
      await createReminder(reminder);
      addToast('Reminder created', 'success');
    }
    setEditing(null);
  };

  const handleEdit = (reminder: Reminder) => {
    setEditing(reminder);
    setFormOpen(true);
  };

  const handleSnooze = (id: string) => {
    snooze(id, addDays(new Date(), 1));
    addToast('Reminder snoozed for 1 day', 'info');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteReminder(deleteId);
    addToast('Reminder deleted', 'success');
    setDeleteId(null);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Reminders</h1>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={16} className="mr-1" /> Create Reminder
        </Button>
      </div>

      <ReminderList
        reminders={reminders}
        onMarkComplete={markComplete}
        onSnooze={handleSnooze}
        onDismiss={dismiss}
        onEdit={handleEdit}
        onDelete={(id) => setDeleteId(id)}
      />

      <ReminderForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        editingReminder={editing}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Reminder"
        message="Are you sure you want to delete this reminder? This action cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
