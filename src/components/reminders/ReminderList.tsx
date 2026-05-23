import { useMemo } from 'react';
import { format, isToday, isBefore, startOfDay } from 'date-fns';
import { CheckCircle, Clock, X, Pencil, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import type { Reminder } from '../../types/reminder';

interface ReminderListProps {
  reminders: Reminder[];
  onMarkComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}

type ReminderTiming = 'overdue' | 'due-today' | 'future';

function getTiming(reminder: Reminder): ReminderTiming {
  const reminderDate = new Date(reminder.date);
  const today = startOfDay(new Date());
  if (isToday(reminderDate)) return 'due-today';
  if (isBefore(reminderDate, today)) return 'overdue';
  return 'future';
}

const timingBadge: Record<ReminderTiming, { variant: 'danger' | 'warning' | 'neutral'; label: string }> = {
  overdue: { variant: 'danger', label: 'Overdue' },
  'due-today': { variant: 'warning', label: 'Due Today' },
  future: { variant: 'neutral', label: 'Upcoming' },
};

export default function ReminderList({
  reminders,
  onMarkComplete,
  onSnooze,
  onDismiss,
  onEdit,
  onDelete,
}: ReminderListProps) {
  const sorted = useMemo(() => {
    const active = reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed');
    return [...active].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [reminders]);

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-sm text-text-secondary text-center py-8">No upcoming reminders.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((reminder) => {
        const timing = getTiming(reminder);
        const badge = timingBadge[timing];
        return (
          <Card key={reminder.id} className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-text-primary truncate">{reminder.title}</span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                {reminder.status === 'snoozed' && <Badge variant="info">Snoozed</Badge>}
              </div>
              {reminder.description && (
                <p className="text-sm text-text-secondary truncate">{reminder.description}</p>
              )}
              <p className="text-xs text-text-secondary mt-1">
                {format(new Date(reminder.date), 'MMM d, yyyy')} at {reminder.time}
                {reminder.recurrence !== 'one-time' && ` · ${reminder.recurrence}`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => onMarkComplete(reminder.id)} title="Complete">
                <CheckCircle size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSnooze(reminder.id)} title="Snooze 1 day">
                <Clock size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDismiss(reminder.id)} title="Dismiss">
                <X size={16} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(reminder)} title="Edit">
                <Pencil size={16} />
              </Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(reminder.id)} title="Delete">
                <Trash2 size={16} />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
