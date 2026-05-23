/**
 * TypeScript type definitions for Reminder data models.
 * Matches the design document data model specification exactly.
 */

export type RecurrencePattern = 'one-time' | 'daily' | 'weekly' | 'monthly';
export type ReminderStatus = 'pending' | 'completed' | 'snoozed' | 'dismissed';

export interface Reminder {
  id: string;
  title: string;
  description: string;
  strategyId?: string;
  activityType?: string;
  date: Date;
  time: string;                        // "HH:mm"
  recurrence: RecurrencePattern;
  status: ReminderStatus;
  planId: string;
  createdAt: Date;
  updatedAt: Date;
}
