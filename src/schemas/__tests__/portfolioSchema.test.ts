/**
 * Unit tests for Portfolio Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  portfolioSchema,
  portfolioMetricsSchema,
  openPositionSchema,
  portfolioNameSchema,
  portfolioDescriptionSchema,
  portfolioInitialBalanceSchema,
  createPortfolioFormSchema,
} from '../portfolioSchema';

describe('portfolioSchema', () => {
  it('accepts a valid portfolio', () => {
    const result = portfolioSchema.safeParse({
      id: 'p1',
      name: 'Main Account',
      description: 'My primary brokerage',
      initialBalance: 100000,
      planId: 'plan-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects portfolio with empty name', () => {
    const result = portfolioSchema.safeParse({
      id: 'p1',
      name: '',
      description: '',
      initialBalance: 100000,
      planId: 'plan-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects portfolio with negative initial balance', () => {
    const result = portfolioSchema.safeParse({
      id: 'p1',
      name: 'Account',
      description: '',
      initialBalance: -5000,
      planId: 'plan-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it('rejects portfolio with missing planId', () => {
    const result = portfolioSchema.safeParse({
      id: 'p1',
      name: 'Account',
      description: '',
      initialBalance: 100000,
      planId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });
});

describe('portfolioNameSchema', () => {
  it('accepts a valid name with 1 character', () => {
    expect(portfolioNameSchema.safeParse('A').success).toBe(true);
  });

  it('accepts a valid name with 100 characters', () => {
    expect(portfolioNameSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });

  it('rejects a name with 101 characters', () => {
    expect(portfolioNameSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(portfolioNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects a whitespace-only name', () => {
    expect(portfolioNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a name with only tabs and spaces', () => {
    expect(portfolioNameSchema.safeParse('\t  \t').success).toBe(false);
  });

  it('accepts a name with leading/trailing whitespace if non-whitespace content exists', () => {
    expect(portfolioNameSchema.safeParse('  My Portfolio  ').success).toBe(true);
  });
});

describe('portfolioDescriptionSchema', () => {
  it('accepts an empty description', () => {
    expect(portfolioDescriptionSchema.safeParse('').success).toBe(true);
  });

  it('accepts a description with 500 characters', () => {
    expect(portfolioDescriptionSchema.safeParse('x'.repeat(500)).success).toBe(true);
  });

  it('rejects a description with 501 characters', () => {
    expect(portfolioDescriptionSchema.safeParse('x'.repeat(501)).success).toBe(false);
  });
});

describe('portfolioInitialBalanceSchema', () => {
  it('accepts 0.00', () => {
    expect(portfolioInitialBalanceSchema.safeParse(0).success).toBe(true);
  });

  it('accepts 999999999.99', () => {
    expect(portfolioInitialBalanceSchema.safeParse(999_999_999.99).success).toBe(true);
  });

  it('rejects a negative balance', () => {
    expect(portfolioInitialBalanceSchema.safeParse(-0.01).success).toBe(false);
  });

  it('rejects a balance exceeding the maximum', () => {
    expect(portfolioInitialBalanceSchema.safeParse(1_000_000_000).success).toBe(false);
  });
});

describe('createPortfolioFormSchema', () => {
  it('accepts a valid form with unique name', () => {
    const schema = createPortfolioFormSchema(['Existing Portfolio']);
    const result = schema.safeParse({
      name: 'New Portfolio',
      description: 'A new one',
      initialBalance: 50000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a duplicate name (case-insensitive)', () => {
    const schema = createPortfolioFormSchema(['My Portfolio']);
    const result = schema.safeParse({
      name: 'my portfolio',
      description: '',
      initialBalance: 1000,
    });
    expect(result.success).toBe(false);
  });

  it('allows keeping the same name when editing', () => {
    const schema = createPortfolioFormSchema(['My Portfolio', 'Other'], 'My Portfolio');
    const result = schema.safeParse({
      name: 'My Portfolio',
      description: '',
      initialBalance: 1000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects duplicate name even with different whitespace', () => {
    const schema = createPortfolioFormSchema(['My Portfolio']);
    const result = schema.safeParse({
      name: '  My Portfolio  ',
      description: '',
      initialBalance: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe('portfolioMetricsSchema', () => {
  it('accepts valid metrics', () => {
    const result = portfolioMetricsSchema.safeParse({
      netLiquidation: 105000,
      totalRealizedPL: 3000,
      totalUnrealizedPL: 2000,
      totalPL: 5000,
      monthlyReturns: [{ month: '2025-01', dollarReturn: 5000, percentageReturn: 5 }],
      maxDrawdown: 3.2,
      cumulativeReturn: 5,
      winRate: 65,
      averageTradeReturn: 250,
      totalTrades: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects metrics with invalid month format', () => {
    const result = portfolioMetricsSchema.safeParse({
      netLiquidation: 105000,
      totalRealizedPL: 3000,
      totalUnrealizedPL: 2000,
      totalPL: 5000,
      monthlyReturns: [{ month: 'January', dollarReturn: 5000, percentageReturn: 5 }],
      maxDrawdown: 3.2,
      cumulativeReturn: 5,
      winRate: 65,
      averageTradeReturn: 250,
      totalTrades: 20,
    });
    expect(result.success).toBe(false);
  });
});

describe('openPositionSchema', () => {
  it('accepts a valid open position', () => {
    const result = openPositionSchema.safeParse({
      stockSymbol: 'TSLA',
      optionType: 'Call',
      strikePrice: 200,
      expirationDate: new Date('2025-03-21'),
      quantity: 1,
      entryPrice: 8.5,
      currentPrice: 10.2,
      unrealizedPL: 170,
    });
    expect(result.success).toBe(true);
  });

  it('rejects position with quantity < 1', () => {
    const result = openPositionSchema.safeParse({
      stockSymbol: 'TSLA',
      optionType: 'Call',
      strikePrice: 200,
      expirationDate: new Date('2025-03-21'),
      quantity: 0,
      entryPrice: 8.5,
      currentPrice: 10.2,
      unrealizedPL: 170,
    });
    expect(result.success).toBe(false);
  });
});
