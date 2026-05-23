import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useAppStore } from '../../stores/appStore';
import { usePlanStore } from '../../stores/planStore';
import type { Reminder, RecurrencePattern } from '../../types/reminder';

interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Reminder) => void;
  editingReminder?: Reminder | null;
}

const recurrenceOptions = [
  { value: 'one-time', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ReminderForm({ isOpen, onClose, onSave, editingReminder }: ReminderFormProps) {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const currentPlan = usePlanStore((s) => s.currentPlan);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('one-time');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingReminder) {
      setTitle(editingReminder.title);
      setDescription(editingReminder.description);
      setStrategyId(editingReminder.strategyId ?? '');
      const d = new Date(editingReminder.date);
      setDate(d.toISOString().split('T')[0]);
      setTime(editingReminder.time);
      setRecurrence(editingReminder.recurrence);
    } else {
      setTitle('');
      setDescription('');
      setStrategyId('');
      setDate('');
      setTime('09:00');
      setRecurrence('one-time');
    }
    setErrors({});
  }, [editingReminder, isOpen]);

  const strategies = [
    ...(currentPlan?.coreStrategies ?? []),
    ...(currentPlan?.speculativeStrategies ?? []),
  ];

  const strategyOptions = [
    { value: '', label: 'None' },
    ...strategies.map((s) => ({ value: s.id, label: s.name })),
  ];

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!date) errs.date = 'Date is required';
    if (!time) errs.time = 'Time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !activePlanId) return;

    const now = new Date();
    const reminder: Reminder = {
      id: editingReminder?.id ?? uuidv4(),
      title: title.trim(),
      description: description.trim(),
      strategyId: strategyId || undefined,
      date: new Date(date + 'T00:00:00'),
      time,
      recurrence,
      status: editingReminder?.status ?? 'pending',
      planId: activePlanId,
      createdAt: editingReminder?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(reminder);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingReminder ? 'Edit Reminder' : 'Create Reminder'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="Reminder title"
        />
        <div className="w-full">
          <label className="block text-sm font-medium text-text-primary mb-1">Description</label>
          <textarea
            className="block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-text-accent focus:border-text-accent"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
        <Select
          label="Linked Strategy"
          options={strategyOptions}
          value={strategyId}
          onChange={(e) => setStrategyId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
          <Input
            label="Time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            error={errors.time}
          />
        </div>
        <Select
          label="Recurrence"
          options={recurrenceOptions}
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as RecurrencePattern)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">{editingReminder ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}
