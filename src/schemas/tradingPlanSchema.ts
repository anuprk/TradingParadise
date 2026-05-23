/**
 * Zod validation schemas for Trading Plan data models.
 * Validates all plan sections with business rules:
 * - BP thresholds: ascending order, no duplicates
 * - Greek targets: min <= max when both provided
 * - Trade rules: 1-50 count
 * - Market regimes: 3-10 count
 * - Strategies: at least 1 entry criterion and 1 management rule
 * - Allocation percentages: warning (not error) when sum != 100%
 */

import { z } from 'zod';

// --- Leaf schemas ---

export const goalSchema = z.object({
  id: z.string().nonempty('Goal ID is required'),
  description: z.string().nonempty('Goal description is required'),
  targetValue: z.string().nonempty('Goal target value is required'),
});

export const greeksTargetSchema = z
  .object({
    id: z.string().nonempty('Greeks target ID is required'),
    metricName: z.string().nonempty('Metric name is required'),
    targetDescription: z.string().nonempty('Target description is required'),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
  })
  .check((ctx) => {
    if (
      ctx.value.minValue !== undefined &&
      ctx.value.maxValue !== undefined &&
      ctx.value.minValue > ctx.value.maxValue
    ) {
      ctx.issues.push({
        code: 'custom',
        message: `Minimum value (${ctx.value.minValue}) must be less than or equal to maximum value (${ctx.value.maxValue})`,
        path: ['minValue'],
        input: ctx.value,
      });
    }
  });

export const bpThresholdSchema = z.object({
  id: z.string().nonempty('BP threshold ID is required'),
  percentage: z.number().min(0, 'Percentage must be >= 0').max(100, 'Percentage must be <= 100'),
  actionDescription: z.string().nonempty('Action description is required'),
});

export const positionLimitSchema = z.object({
  id: z.string().nonempty('Position limit ID is required'),
  strategyName: z.string().nonempty('Strategy name is required'),
  maxPositions: z.number().int().min(1, 'Max positions must be at least 1'),
  maxPerUnderlying: z.number().int().min(1, 'Max per underlying must be at least 1'),
});

export const riskManagementSchema = z
  .object({
    bpThresholds: z.array(bpThresholdSchema),
    positionLimits: z.array(positionLimitSchema),
    maxLossPerTrade: z.number().optional(),
    maxLossPerPortfolio: z.number().optional(),
  })
  .check((ctx) => {
    const thresholds = ctx.value.bpThresholds;
    // Check ascending order
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i].percentage <= thresholds[i - 1].percentage) {
        ctx.issues.push({
          code: 'custom',
          message: `BP thresholds must be in ascending order. Threshold at index ${i} (${thresholds[i].percentage}%) is not greater than threshold at index ${i - 1} (${thresholds[i - 1].percentage}%)`,
          path: ['bpThresholds', i, 'percentage'],
          input: ctx.value,
        });
      }
    }
    // Check duplicates
    const seen = new Set<number>();
    for (let i = 0; i < thresholds.length; i++) {
      if (seen.has(thresholds[i].percentage)) {
        ctx.issues.push({
          code: 'custom',
          message: `Duplicate BP threshold percentage: ${thresholds[i].percentage}%`,
          path: ['bpThresholds', i, 'percentage'],
          input: ctx.value,
        });
      }
      seen.add(thresholds[i].percentage);
    }
  });

export const tradeRuleSchema = z.object({
  id: z.string().nonempty('Trade rule ID is required'),
  order: z.number().int().min(0),
  text: z.string().nonempty('Trade rule text is required'),
  category: z.string().optional(),
});

export const checklistItemSchema = z.object({
  id: z.string().nonempty('Checklist item ID is required'),
  order: z.number().int().min(0),
  description: z.string().nonempty('Checklist item description is required'),
  reviewType: z.union([z.literal('nightly'), z.literal('morning')]),
});

export const dailyManagementSchema = z.object({
  nightlyReview: z.array(checklistItemSchema),
  morningReview: z.array(checklistItemSchema),
});

export const vacationRuleSchema = z.object({
  id: z.string().nonempty('Vacation rule ID is required'),
  order: z.number().int().min(0),
  text: z.string().nonempty('Vacation rule text is required'),
});

export const marketRegimeSchema = z.object({
  id: z.string().nonempty('Market regime ID is required'),
  name: z.string().nonempty('Market regime name is required'),
  conditions: z.string().nonempty('Market regime conditions are required'),
  strategyAdjustments: z.string().nonempty('Strategy adjustments are required'),
});

export const strategyAllocationSchema = z.object({
  id: z.string().nonempty('Allocation ID is required'),
  categoryName: z.string().nonempty('Category name is required'),
  allocationPercentage: z.number().min(0, 'Allocation must be >= 0').max(100, 'Allocation must be <= 100'),
  numberOfPositions: z.number().int().min(1).optional(),
  positionSizing: z.string().optional(),
});

export const accountSizingSchema = z.object({
  totalAccountSize: z.number().min(0, 'Account size must be non-negative'),
  allocations: z.array(strategyAllocationSchema),
});

export const strategyVariantSchema = z.object({
  id: z.string().nonempty('Variant ID is required'),
  name: z.string().nonempty('Variant name is required'),
  description: z.string().nonempty('Variant description is required'),
});

export const entryCriterionSchema = z.object({
  id: z.string().nonempty('Entry criterion ID is required'),
  parameterName: z.string().nonempty('Parameter name is required'),
  value: z.string().nonempty('Value is required'),
});

export const managementRuleSchema = z.object({
  id: z.string().nonempty('Management rule ID is required'),
  triggerCondition: z.string().nonempty('Trigger condition is required'),
  actionDescription: z.string().nonempty('Action description is required'),
});

export const profitTargetSchema = z.object({
  id: z.string().nonempty('Profit target ID is required'),
  targetValue: z.string().nonempty('Target value is required'),
  action: z.string().nonempty('Action is required'),
});

export const stopLossSchema = z.object({
  id: z.string().nonempty('Stop loss ID is required'),
  stopValue: z.string().nonempty('Stop value is required'),
  action: z.string().nonempty('Action is required'),
});

export const strategySchema = z
  .object({
    id: z.string().nonempty('Strategy ID is required'),
    name: z.string().nonempty('Strategy name is required'),
    classification: z.union([z.literal('Core'), z.literal('Speculative')]),
    description: z.string().nonempty('Strategy description is required'),
    variants: z.array(strategyVariantSchema).optional(),
    entryCriteria: z.array(entryCriterionSchema),
    managementRules: z.array(managementRuleSchema),
    profitTargets: z.array(profitTargetSchema),
    stopLosses: z.array(stopLossSchema),
  })
  .check((ctx) => {
    if (ctx.value.entryCriteria.length < 1) {
      ctx.issues.push({
        code: 'custom',
        message: 'Strategy must have at least one entry criterion',
        path: ['entryCriteria'],
        input: ctx.value,
      });
    }
    if (ctx.value.managementRules.length < 1) {
      ctx.issues.push({
        code: 'custom',
        message: 'Strategy must have at least one management rule',
        path: ['managementRules'],
        input: ctx.value,
      });
    }
  });

// --- Main Trading Plan schema ---

export const tradingPlanSchema = z
  .object({
    id: z.string().nonempty('Plan ID is required'),
    name: z.string().nonempty('Plan name is required'),
    author: z.string().nonempty('Author name is required'),
    year: z.number().int().min(2000).max(2100),
    createdAt: z.date(),
    updatedAt: z.date(),
    goals: z.array(goalSchema).min(1, 'At least one goal is required'),
    greeksTargets: z.array(greeksTargetSchema),
    riskManagement: riskManagementSchema,
    tradeRules: z
      .array(tradeRuleSchema)
      .min(1, 'At least 1 trade rule is required')
      .max(50, 'Maximum 50 trade rules allowed'),
    dailyManagement: dailyManagementSchema,
    vacationRules: z.array(vacationRuleSchema),
    marketRegimes: z
      .array(marketRegimeSchema)
      .min(3, 'At least 3 market regimes are required')
      .max(10, 'Maximum 10 market regimes allowed'),
    accountSizing: accountSizingSchema,
    coreStrategies: z.array(strategySchema),
    speculativeStrategies: z.array(strategySchema),
  });

// --- Allocation sum validation helper ---

export interface AllocationValidationResult {
  isValid: boolean;
  sum: number;
  warning?: string;
}

/**
 * Checks if allocation percentages sum to 100%.
 * Returns a warning (not an error) when they don't.
 */
export function validateAllocationSum(
  allocations: z.infer<typeof strategyAllocationSchema>[]
): AllocationValidationResult {
  const sum = allocations.reduce((acc, a) => acc + a.allocationPercentage, 0);
  const roundedSum = Math.round(sum * 100) / 100;

  if (roundedSum !== 100) {
    return {
      isValid: false,
      sum: roundedSum,
      warning: `Strategy allocations sum to ${roundedSum}%, expected 100%`,
    };
  }

  return { isValid: true, sum: roundedSum };
}

// --- Inferred types ---

export type GoalInput = z.infer<typeof goalSchema>;
export type GreeksTargetInput = z.infer<typeof greeksTargetSchema>;
export type BPThresholdInput = z.infer<typeof bpThresholdSchema>;
export type PositionLimitInput = z.infer<typeof positionLimitSchema>;
export type RiskManagementInput = z.infer<typeof riskManagementSchema>;
export type TradeRuleInput = z.infer<typeof tradeRuleSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type DailyManagementInput = z.infer<typeof dailyManagementSchema>;
export type VacationRuleInput = z.infer<typeof vacationRuleSchema>;
export type MarketRegimeInput = z.infer<typeof marketRegimeSchema>;
export type StrategyAllocationInput = z.infer<typeof strategyAllocationSchema>;
export type AccountSizingInput = z.infer<typeof accountSizingSchema>;
export type StrategyVariantInput = z.infer<typeof strategyVariantSchema>;
export type EntryCriterionInput = z.infer<typeof entryCriterionSchema>;
export type ManagementRuleInput = z.infer<typeof managementRuleSchema>;
export type ProfitTargetInput = z.infer<typeof profitTargetSchema>;
export type StopLossInput = z.infer<typeof stopLossSchema>;
export type StrategyInput = z.infer<typeof strategySchema>;
export type TradingPlanInput = z.infer<typeof tradingPlanSchema>;
