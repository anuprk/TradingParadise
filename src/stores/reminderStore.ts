import { create } from 'zustand';
import type { Reminder } from '../types/reminder';
import * as reminderRepo from '../db/reminderRepository';
import { useAppStore } from './appStore';

interface ReminderState {
  reminders: Reminder[];
  isLoading: boolean;

  loadReminders: (planId: string) => Promise<void>;
  createReminder: (reminder: Reminder) => Promise<string>;
  updateReminder: (id: string, changes: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
  markComplete: (id: string) => Promise<void>;
  snooze: (id: string, newDate: Date) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  reminders: [],
  isLoading: false,

  loadReminders: async (planId) => {
    set({ isLoading: true });
    try {
      const reminders = await reminderRepo.listReminders(planId);
      set({ reminders });
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to load reminders',
        'error',
      );
    } finally {
      set({ isLoading: false });
    }
  },

  createReminder: async (reminder) => {
    try {
      const id = await reminderRepo.createReminder(reminder);
      const reminders = await reminderRepo.listReminders(reminder.planId);
      set({ reminders });
      return id;
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to create reminder',
        'error',
      );
      return '';
    }
  },

  updateReminder: async (id, changes) => {
    try {
      await reminderRepo.updateReminder(id, changes);
      // Find the planId from the existing reminder to reload the list
      const existing = get().reminders.find((r) => r.id === id);
      if (existing) {
        const reminders = await reminderRepo.listReminders(existing.planId);
        set({ reminders });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to update reminder',
        'error',
      );
    }
  },

  deleteReminder: async (id) => {
    try {
      await reminderRepo.deleteReminder(id);
      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
      }));
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to delete reminder',
        'error',
      );
    }
  },

  markComplete: async (id) => {
    try {
      await reminderRepo.updateReminder(id, { status: 'completed' });
      const existing = get().reminders.find((r) => r.id === id);
      if (existing) {
        const reminders = await reminderRepo.listReminders(existing.planId);
        set({ reminders });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to mark reminder complete',
        'error',
      );
    }
  },

  snooze: async (id, newDate) => {
    try {
      await reminderRepo.updateReminder(id, { status: 'snoozed', date: newDate });
      const existing = get().reminders.find((r) => r.id === id);
      if (existing) {
        const reminders = await reminderRepo.listReminders(existing.planId);
        set({ reminders });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to snooze reminder',
        'error',
      );
    }
  },

  dismiss: async (id) => {
    try {
      await reminderRepo.updateReminder(id, { status: 'dismissed' });
      const existing = get().reminders.find((r) => r.id === id);
      if (existing) {
        const reminders = await reminderRepo.listReminders(existing.planId);
        set({ reminders });
      }
    } catch (err) {
      useAppStore.getState().addToast(
        err instanceof Error ? err.message : 'Failed to dismiss reminder',
        'error',
      );
    }
  },
}));
