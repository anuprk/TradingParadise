/**
 * Zod validation schema for Reminder data models.
 * Validates reminder creation and status management.
 */

import { z } from 'zod';

export const recurrencePatternSchema = z.union([
  z.literal('one-time'),
  z.literal('daily'),
  z.literal('weekly'),
  z.literal('monthly'),
]);

export const reminderStatusSchema = z.union([
  z.literal('pending'),
  z.literal('completed'),
  z.literal('snoozed'),
  z.literal('dismissed'),
]);

export const reminderSchema = z.object({
  id: z.string().nonempty('Reminder ID is required'),
  title: z.string().nonempty('Reminder title is required'),
  description: z.string(),
  strategyId: z.string().optional(),
  activityType: z.string().optional(),
  date: z.date(),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  recurrence: recurrencePatternSchema,
  status: reminderStatusSchema,
  planId: z.string().nonempty('Plan ID is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// --- Inferred types ---

export type RecurrencePatternInput = z.infer<typeof recurrencePatternSchema>;
export type ReminderStatusInput = z.infer<typeof reminderStatusSchema>;
export type ReminderInput = z.infer<typeof reminderSchema>;
