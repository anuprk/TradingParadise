/**
 * Zod validation schema for Trade Journal Entry data model.
 * Validates all required fields and enforces type constraints.
 */

import { z } from 'zod';

export const optionTypeSchema = z.union([z.literal('Call'), z.literal('Put')]);
export const tradeDirectionSchema = z.union([z.literal('Buy'), z.literal('Sell')]);
export const tradeStatusSchema = z.union([
  z.literal('Open'),
  z.literal('Closed'),
  z.literal('Expired'),
  z.literal('Assigned'),
]);
export const winLossSchema = z.union([z.literal('Win'), z.literal('Loss'), z.null()]);

export const tradeJournalEntrySchema = z.object({
  id: z.string().nonempty('Journal entry ID is required'),
  stockSymbol: z.string().nonempty('Stock symbol is required').toUpperCase(),
  openDate: z.date(),
  expirationDate: z.date(),
  optionType: optionTypeSchema,
  direction: tradeDirectionSchema,
  stockPriceDOC: z.number().min(0, 'Stock price must be non-negative'),
  dte: z.number().int().min(0, 'DTE must be non-negative'),
  ditc: z.number().int().min(0, 'DITC must be non-negative'),
  currentStockPrice: z.number().min(0).optional(),
  breakEvenPrice: z.number(),
  strikePrice: z.number().min(0, 'Strike price must be non-negative'),
  premium: z.number().min(0, 'Premium must be non-negative'),
  cashReserve: z.number().min(0, 'Cash reserve must be non-negative'),
  marginCashReserve: z.number().min(0).optional(),
  fees: z.number().min(0, 'Fees must be non-negative'),
  exitPrice: z.number().min(0).optional(),
  closeDate: z.date().optional(),
  profitLoss: z.number().optional(),
  winLoss: winLossSchema,
  daysHeld: z.number().int().min(0).optional(),
  annualizedROR: z.number().optional(),
  marginAnnualizedROR: z.number().optional(),
  tradeStatus: tradeStatusSchema,
  portfolioId: z.string().optional(),
  strategyId: z.string().nonempty('Strategy ID is required'),
  planId: z.string().nonempty('Plan ID is required'),
  unrealizedPL: z.number().optional(),
  notes: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// --- Inferred types ---

export type OptionTypeInput = z.infer<typeof optionTypeSchema>;
export type TradeDirectionInput = z.infer<typeof tradeDirectionSchema>;
export type TradeStatusInput = z.infer<typeof tradeStatusSchema>;
export type WinLossInput = z.infer<typeof winLossSchema>;
export type TradeJournalEntryInput = z.infer<typeof tradeJournalEntrySchema>;
