import { useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useReminders } from '../../hooks/useReminders';

/**
 * App-level component that monitors due reminders and fires
 * both in-app notification banners and browser Notification API alerts.
 *
 * Requirements: 12.3
 */
export default function ReminderNotification() {
  const { dueReminders, markComplete, dismiss } = useReminders();
  const notifiedRef = useRef<Set<string>>(new Set());

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fire browser notifications for newly due reminders
  useEffect(() => {
    for (const reminder of dueReminders) {
      if (notifiedRef.current.has(reminder.id)) continue;
      notifiedRef.current.add(reminder.id);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(reminder.title, {
          body: reminder.description || 'Reminder is due',
          icon: '/favicon.svg',
        });
      }
    }
  }, [dueReminders]);

  if (dueReminders.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {dueReminders.map((reminder) => (
        <div
          key={reminder.id}
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 shadow-md"
        >
          <Bell size={18} className="shrink-0 text-warning mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">{reminder.title}</p>
            {reminder.description && (
              <p className="text-xs text-warning mt-0.5 truncate">{reminder.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => markComplete(reminder.id)}
              className="text-xs text-warning hover:text-amber-900 underline"
            >
              Done
            </button>
            <button
              onClick={() => dismiss(reminder.id)}
              className="text-amber-400 hover:text-warning"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
