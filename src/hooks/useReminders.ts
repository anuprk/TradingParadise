import { useEffect, useRef, useCallback } from 'react';
import { useReminderStore } from '../stores/reminderStore';
import { useAppStore } from '../stores/appStore';
import type { Reminder } from '../types/reminder';

const POLL_INTERVAL_MS = 60_000; // 60 seconds

/**
 * Custom hook wrapping the reminder store with polling logic.
 * Polls every 60 seconds to check for due reminders.
 *
 * Requirements: 12.3
 */
export function useReminders() {
  const activePlanId = useAppStore((s) => s.activePlanId);
  const {
    reminders,
    isLoading,
    loadReminders,
    createReminder,
    updateReminder,
    deleteReminder,
    markComplete,
    snooze,
    dismiss,
  } = useReminderStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load reminders when planId changes
  useEffect(() => {
    if (activePlanId) {
      loadReminders(activePlanId);
    }
  }, [activePlanId, loadReminders]);

  // Poll for due reminders every 60 seconds
  useEffect(() => {
    if (!activePlanId) return;

    const poll = () => {
      loadReminders(activePlanId);
    };

    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activePlanId, loadReminders]);

  /**
   * Returns reminders that are currently due (date/time <= now, status pending).
   */
  const getDueReminders = useCallback((): Reminder[] => {
    const now = new Date();
    return reminders.filter((r) => {
      if (r.status !== 'pending') return false;
      const reminderDate = new Date(r.date);
      const [hours, minutes] = r.time.split(':').map(Number);
      reminderDate.setHours(hours, minutes, 0, 0);
      return reminderDate <= now;
    });
  }, [reminders]);

  return {
    reminders,
    isLoading,
    dueReminders: getDueReminders(),
    createReminder,
    updateReminder,
    deleteReminder,
    markComplete,
    snooze,
    dismiss,
  };
}
