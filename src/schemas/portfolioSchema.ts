/**
 * Zod validation schema for Portfolio data models.
 * Validates portfolio creation and metrics data.
 */

import { z } from 'zod';
import { optionTypeSchema } from './journalSchema';

/**
 * Portfolio name validation:
 * - 1 to 100 characters after trimming
 * - Cannot be whitespace-only
 */
export const portfolioNameSchema = z
  .string()
  .min(1, 'Portfolio name is required')
  .max(100, 'Portfolio name must be 100 characters or less')
  .refine((val) => val.trim().length > 0, {
    message: 'Portfolio name cannot be whitespace only',
  });

/**
 * Portfolio description validation:
 * - Optional (can be empty string)
 * - Maximum 500 characters
 */
export const portfolioDescriptionSchema = z
  .string()
  .max(500, 'Description must be 500 characters or less');

/**
 * Portfolio initial balance validation:
 * - Must be between 0.00 and 999,999,999.99 inclusive
 */
export const portfolioInitialBalanceSchema = z
  .number()
  .min(0, 'Initial balance must be at least $0.00')
  .max(999_999_999.99, 'Initial balance must be at most $999,999,999.99');

export const portfolioSchema = z.object({
  id: z.string().nonempty('Portfolio ID is required'),
  name: portfolioNameSchema,
  description: portfolioDescriptionSchema,
  initialBalance: portfolioInitialBalanceSchema,
  planId: z.string().nonempty('Plan ID is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Creates a portfolio form validation schema that checks for unique names
 * within the same trading plan.
 *
 * @param existingNames - Array of portfolio names already in the plan (case-insensitive comparison)
 * @param currentName - Optional current name when editing (excluded from uniqueness check)
 */
export function createPortfolioFormSchema(
  existingNames: string[],
  currentName?: string,
) {
  return z.object({
    name: portfolioNameSchema.refine(
      (val) => {
        const trimmed = val.trim().toLowerCase();
        // When editing, allow keeping the same name
        if (currentName && trimmed === currentName.trim().toLowerCase()) {
          return true;
        }
        return !existingNames.some(
          (existing) => existing.trim().toLowerCase() === trimmed,
        );
      },
      {
        message: 'A portfolio with this name already exists in this plan',
      },
    ),
    description: portfolioDescriptionSchema,
    initialBalance: portfolioInitialBalanceSchema,
  });
}

export const monthlyReturnSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  dollarReturn: z.number(),
  percentageReturn: z.number(),
});

export const portfolioMetricsSchema = z.object({
  netLiquidation: z.number(),
  totalRealizedPL: z.number(),
  totalUnrealizedPL: z.number(),
  totalPL: z.number(),
  monthlyReturns: z.array(monthlyReturnSchema),
  maxDrawdown: z.number(),
  cumulativeReturn: z.number(),
  winRate: z.number().min(0).max(100),
  averageTradeReturn: z.number(),
  totalTrades: z.number().int().min(0),
});

export const openPositionSchema = z.object({
  stockSymbol: z.string().nonempty('Stock symbol is required'),
  optionType: optionTypeSchema,
  strikePrice: z.number().min(0, 'Strike price must be non-negative'),
  expirationDate: z.date(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  entryPrice: z.number().min(0, 'Entry price must be non-negative'),
  currentPrice: z.number().min(0, 'Current price must be non-negative'),
  unrealizedPL: z.number(),
});

// --- Inferred types ---

export type PortfolioInput = z.infer<typeof portfolioSchema>;
export type PortfolioFormInput = z.infer<ReturnType<typeof createPortfolioFormSchema>>;
export type MonthlyReturnInput = z.infer<typeof monthlyReturnSchema>;
export type PortfolioMetricsInput = z.infer<typeof portfolioMetricsSchema>;
export type OpenPositionInput = z.infer<typeof openPositionSchema>;
