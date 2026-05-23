/**
 * JSON serialization/deserialization utilities for Trading Plan data.
 * Handles Date ↔ ISO string conversion and Zod-based validation on import.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

import { z } from 'zod';
import type { TradingPlan } from '../types/tradingPlan';
import type { Portfolio } from '../types/portfolio';
import type { TradeJournalEntry } from '../types/journal';
import type { Reminder } from '../types/reminder';

// --- Custom ValidationError ---

export class ValidationError extends Error {
  public readonly fieldErrors: string[];

  constructor(message: string, fieldErrors: string[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

// --- Serialization-specific Zod schemas ---
// These accept ISO date strings and coerce them to Date objects.

const coercedDate = z.coerce.date();

const goalSerializedSchema = z.object({
  id: z.string().nonempty('Goal ID is required'),
  description: z.string().nonempty('Goal description is required'),
  targetValue: z.string().nonempty('Goal target value is required'),
});

const greeksTargetSerializedSchema = z.object({
  id: z.string().nonempty('Greeks target ID is required'),
  metricName: z.string().nonempty('Metric name is required'),
  targetDescription: z.string().nonempty('Target description is required'),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});

const bpThresholdSerializedSchema = z.object({
  id: z.string().nonempty('BP threshold ID is required'),
  percentage: z.number().min(0).max(100),
  actionDescription: z.string().nonempty('Action description is required'),
});

const positionLimitSerializedSchema = z.object({
  id: z.string().nonempty('Position limit ID is required'),
  strategyName: z.string().nonempty('Strategy name is required'),
  maxPositions: z.number().int().min(1),
  maxPerUnderlying: z.number().int().min(1),
});

const riskManagementSerializedSchema = z.object({
  bpThresholds: z.array(bpThresholdSerializedSchema),
  positionLimits: z.array(positionLimitSerializedSchema),
  maxLossPerTrade: z.number().optional(),
  maxLossPerPortfolio: z.number().optional(),
});

const tradeRuleSerializedSchema = z.object({
  id: z.string().nonempty('Trade rule ID is required'),
  order: z.number().int().min(0),
  text: z.string().nonempty('Trade rule text is required'),
  category: z.string().optional(),
});

const checklistItemSerializedSchema = z.object({
  id: z.string().nonempty('Checklist item ID is required'),
  order: z.number().int().min(0),
  description: z.string().nonempty('Checklist item description is required'),
  reviewType: z.union([z.literal('nightly'), z.literal('morning')]),
});

const dailyManagementSerializedSchema = z.object({
  nightlyReview: z.array(checklistItemSerializedSchema),
  morningReview: z.array(checklistItemSerializedSchema),
});

const vacationRuleSerializedSchema = z.object({
  id: z.string().nonempty('Vacation rule ID is required'),
  order: z.number().int().min(0),
  text: z.string().nonempty('Vacation rule text is required'),
});

const marketRegimeSerializedSchema = z.object({
  id: z.string().nonempty('Market regime ID is required'),
  name: z.string().nonempty('Market regime name is required'),
  conditions: z.string().nonempty('Market regime conditions are required'),
  strategyAdjustments: z.string().nonempty('Strategy adjustments are required'),
});

const strategyAllocationSerializedSchema = z.object({
  id: z.string().nonempty('Allocation ID is required'),
  categoryName: z.string().nonempty('Category name is required'),
  allocationPercentage: z.number().min(0).max(100),
  numberOfPositions: z.number().int().min(1).optional(),
  positionSizing: z.string().optional(),
});

const accountSizingSerializedSchema = z.object({
  totalAccountSize: z.number().min(0),
  allocations: z.array(strategyAllocationSerializedSchema),
});

const strategyVariantSerializedSchema = z.object({
  id: z.string().nonempty('Variant ID is required'),
  name: z.string().nonempty('Variant name is required'),
  description: z.string().nonempty('Variant description is required'),
});

const entryCriterionSerializedSchema = z.object({
  id: z.string().nonempty('Entry criterion ID is required'),
  parameterName: z.string().nonempty('Parameter name is required'),
  value: z.string().nonempty('Value is required'),
});

const managementRuleSerializedSchema = z.object({
  id: z.string().nonempty('Management rule ID is required'),
  triggerCondition: z.string().nonempty('Trigger condition is required'),
  actionDescription: z.string().nonempty('Action description is required'),
});

const profitTargetSerializedSchema = z.object({
  id: z.string().nonempty('Profit target ID is required'),
  targetValue: z.string().nonempty('Target value is required'),
  action: z.string().nonempty('Action is required'),
});

const stopLossSerializedSchema = z.object({
  id: z.string().nonempty('Stop loss ID is required'),
  stopValue: z.string().nonempty('Stop value is required'),
  action: z.string().nonempty('Action is required'),
});

const strategySerializedSchema = z.object({
  id: z.string().nonempty('Strategy ID is required'),
  name: z.string().nonempty('Strategy name is required'),
  classification: z.union([z.literal('Core'), z.literal('Speculative')]),
  description: z.string().nonempty('Strategy description is required'),
  variants: z.array(strategyVariantSerializedSchema).optional(),
  entryCriteria: z.array(entryCriterionSerializedSchema),
  managementRules: z.array(managementRuleSerializedSchema),
  profitTargets: z.array(profitTargetSerializedSchema),
  stopLosses: z.array(stopLossSerializedSchema),
});

const tradingPlanSerializedSchema = z.object({
  id: z.string().nonempty('Plan ID is required'),
  name: z.string().nonempty('Plan name is required'),
  author: z.string().nonempty('Author name is required'),
  year: z.number().int().min(2000).max(2100),
  createdAt: coercedDate,
  updatedAt: coercedDate,
  goals: z.array(goalSerializedSchema).min(1, 'At least one goal is required'),
  greeksTargets: z.array(greeksTargetSerializedSchema),
  riskManagement: riskManagementSerializedSchema,
  tradeRules: z.array(tradeRuleSerializedSchema).min(1).max(50),
  dailyManagement: dailyManagementSerializedSchema,
  vacationRules: z.array(vacationRuleSerializedSchema),
  marketRegimes: z.array(marketRegimeSerializedSchema).min(3).max(10),
  accountSizing: accountSizingSerializedSchema,
  coreStrategies: z.array(strategySerializedSchema),
  speculativeStrategies: z.array(strategySerializedSchema),
});

const optionTypeSerializedSchema = z.union([z.literal('Call'), z.literal('Put')]);
const tradeDirectionSerializedSchema = z.union([z.literal('Buy'), z.literal('Sell')]);
const tradeStatusSerializedSchema = z.union([
  z.literal('Open'),
  z.literal('Closed'),
  z.literal('Expired'),
  z.literal('Assigned'),
]);
const winLossSerializedSchema = z.union([z.literal('Win'), z.literal('Loss'), z.null()]);

const journalEntrySerializedSchema = z.object({
  id: z.string().nonempty('Journal entry ID is required'),
  stockSymbol: z.string().nonempty('Stock symbol is required'),
  openDate: coercedDate,
  expirationDate: coercedDate,
  optionType: optionTypeSerializedSchema,
  direction: tradeDirectionSerializedSchema,
  stockPriceDOC: z.number().min(0),
  dte: z.number().int().min(0),
  ditc: z.number().int().min(0),
  currentStockPrice: z.number().min(0).optional(),
  breakEvenPrice: z.number(),
  strikePrice: z.number().min(0),
  premium: z.number().min(0),
  cashReserve: z.number().min(0),
  marginCashReserve: z.number().min(0).optional(),
  fees: z.number().min(0),
  exitPrice: z.number().min(0).optional(),
  closeDate: coercedDate.optional(),
  profitLoss: z.number().optional(),
  winLoss: winLossSerializedSchema,
  daysHeld: z.number().int().min(0).optional(),
  annualizedROR: z.number().optional(),
  marginAnnualizedROR: z.number().optional(),
  tradeStatus: tradeStatusSerializedSchema,
  portfolioId: z.string().optional(),
  strategyId: z.string().nonempty('Strategy ID is required'),
  planId: z.string().nonempty('Plan ID is required'),
  unrealizedPL: z.number().optional(),
  notes: z.string(),
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

const portfolioSerializedSchema = z.object({
  id: z.string().nonempty('Portfolio ID is required'),
  name: z.string().nonempty('Portfolio name is required'),
  description: z.string(),
  initialBalance: z.number().min(0),
  planId: z.string().nonempty('Plan ID is required'),
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

const recurrencePatternSerializedSchema = z.union([
  z.literal('one-time'),
  z.literal('daily'),
  z.literal('weekly'),
  z.literal('monthly'),
]);

const reminderStatusSerializedSchema = z.union([
  z.literal('pending'),
  z.literal('completed'),
  z.literal('snoozed'),
  z.literal('dismissed'),
]);

const reminderSerializedSchema = z.object({
  id: z.string().nonempty('Reminder ID is required'),
  title: z.string().nonempty('Reminder title is required'),
  description: z.string(),
  strategyId: z.string().optional(),
  activityType: z.string().optional(),
  date: coercedDate,
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  recurrence: recurrencePatternSerializedSchema,
  status: reminderStatusSerializedSchema,
  planId: z.string().nonempty('Plan ID is required'),
  createdAt: coercedDate,
  updatedAt: coercedDate,
});

const serializedPlanDataSchema = z.object({
  version: z.string().nonempty('Version is required'),
  exportedAt: z.string().nonempty('Export timestamp is required'),
  plan: tradingPlanSerializedSchema,
  portfolios: z.array(portfolioSerializedSchema),
  journalEntries: z.array(journalEntrySerializedSchema),
  reminders: z.array(reminderSerializedSchema),
});

// --- Exported types ---

export type SerializedPlanData = z.infer<typeof serializedPlanDataSchema>;

// --- Public API ---

/**
 * Serializes a complete trading plan with associated data to a JSON string.
 * Converts Date objects to ISO strings during serialization.
 *
 * @param plan - The trading plan to serialize
 * @param portfolios - Associated portfolios
 * @param journalEntries - Associated trade journal entries
 * @param reminders - Associated reminders
 * @returns Pretty-printed JSON string
 */
export function serializePlan(
  plan: TradingPlan,
  portfolios: Portfolio[],
  journalEntries: TradeJournalEntry[],
  reminders: Reminder[],
): string {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    plan,
    portfolios,
    journalEntries,
    reminders,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Deserializes a JSON string into validated SerializedPlanData.
 * Converts ISO date strings back to Date objects via Zod coercion.
 * Throws a descriptive ValidationError if the data is invalid.
 *
 * @param json - The JSON string to parse and validate
 * @returns Validated SerializedPlanData with Date objects
 * @throws ValidationError with field-level messages on invalid input
 */
export function deserializePlan(json: string): SerializedPlanData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ValidationError('Invalid JSON: unable to parse the provided string');
  }

  const result = serializedPlanDataSchema.safeParse(parsed);
  if (!result.success) {
    const fieldErrors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    throw new ValidationError(
      `Invalid plan data: ${fieldErrors.join('; ')}`,
      fieldErrors,
    );
  }

  return result.data;
}
