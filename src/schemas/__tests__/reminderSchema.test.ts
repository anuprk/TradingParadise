/**
 * Unit tests for Reminder Zod validation schema.
 */

import { describe, it, expect } from 'vitest';
import { reminderSchema } from '../reminderSchema';

function makeValidReminder(overrides = {}) {
  return {
    id: 'r1',
    title: 'Check positions',
    description: 'Review open positions before close',
    date: new Date('2025-06-15'),
    time: '16:00',
    recurrence: 'daily' as const,
    status: 'pending' as const,
    planId: 'plan-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('reminderSchema', () => {
  it('accepts a valid reminder', () => {
    const result = reminderSchema.safeParse(makeValidReminder());
    expect(result.success).toBe(true);
  });

  it('accepts reminder with optional strategyId', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ strategyId: 's1' }));
    expect(result.success).toBe(true);
  });

  it('accepts reminder with optional activityType', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ activityType: 'nightly-review' }));
    expect(result.success).toBe(true);
  });

  it('rejects reminder with empty title', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ title: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects reminder with invalid time format', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ time: '4pm' }));
    expect(result.success).toBe(false);
  });

  it('accepts valid time format HH:mm', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ time: '09:30' }));
    expect(result.success).toBe(true);
  });

  it('rejects reminder with invalid recurrence', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ recurrence: 'yearly' }));
    expect(result.success).toBe(false);
  });

  it('rejects reminder with invalid status', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ status: 'active' }));
    expect(result.success).toBe(false);
  });

  it('accepts all valid recurrence patterns', () => {
    for (const recurrence of ['one-time', 'daily', 'weekly', 'monthly'] as const) {
      const result = reminderSchema.safeParse(makeValidReminder({ recurrence }));
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid statuses', () => {
    for (const status of ['pending', 'completed', 'snoozed', 'dismissed'] as const) {
      const result = reminderSchema.safeParse(makeValidReminder({ status }));
      expect(result.success).toBe(true);
    }
  });

  it('rejects reminder with missing planId', () => {
    const result = reminderSchema.safeParse(makeValidReminder({ planId: '' }));
    expect(result.success).toBe(false);
  });
});
