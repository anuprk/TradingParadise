/**
 * Property-based tests for Trading Plan validation schemas.
 * Uses fast-check to verify universal properties across random inputs.
 *
 * Validates: Requirements 3.5, 3.6, 8.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { riskManagementSchema, validateAllocationSum } from '../tradingPlanSchema';

// --- Generators ---

/** Generate an array of unique, strictly ascending BP threshold percentages. */
const arbAscendingPercentages = fc
  .uniqueArray(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), {
    minLength: 2,
    maxLength: 10,
    comparator: (a, b) => a === b,
  })
  .map((arr) => [...arr].sort((a, b) => a - b));

/** Generate an array of BP thresholds that is NOT in strictly ascending order. */
const arbNonAscendingThresholds = fc
  .array(
    fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    { minLength: 2, maxLength: 10 }
  )
  .filter((arr) => {
    // Keep only arrays where at least one adjacent pair is not strictly ascending
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] <= arr[i - 1]) return true;
    }
    return false;
  })
  .map((percentages) =>
    percentages.map((pct, i) => ({
      id: `bp-${i}`,
      percentage: pct,
      actionDescription: `Action at ${pct}%`,
    }))
  );

/** Generate a strategy allocation with a given percentage. */
function arbAllocation(percentage: fc.Arbitrary<number>) {
  return fc.record({
    id: fc.uuid(),
    categoryName: fc.string({ minLength: 1 }),
    allocationPercentage: percentage,
  });
}

// --- Property 6: BP Threshold Ordering ---

describe('Property 6: BP Threshold Ordering', () => {
  /**
   * Validates: Requirements 3.5
   * Non-ascending BP threshold arrays must trigger a validation error.
   */
  it('rejects BP thresholds that are not in strictly ascending order', () => {
    fc.assert(
      fc.property(arbNonAscendingThresholds, (thresholds) => {
        const result = riskManagementSchema.safeParse({
          bpThresholds: thresholds,
          positionLimits: [],
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 3.5, 3.6
   * Strictly ascending, unique BP threshold arrays must pass validation.
   */
  it('accepts BP thresholds in strictly ascending order with unique values', () => {
    fc.assert(
      fc.property(arbAscendingPercentages, (percentages) => {
        const thresholds = percentages.map((pct, i) => ({
          id: `bp-${i}`,
          percentage: pct,
          actionDescription: `Action at ${pct}%`,
        }));

        const result = riskManagementSchema.safeParse({
          bpThresholds: thresholds,
          positionLimits: [],
        });
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});

// --- Property 7: Strategy Allocation Sum Warning ---

describe('Property 7: Strategy Allocation Sum Warning', () => {
  /**
   * Validates: Requirements 8.3
   * When allocation percentages do not sum to 100%, a warning is produced.
   */
  it('returns warning when allocation sum ≠ 100%', () => {
    fc.assert(
      fc.property(
        fc.array(
          arbAllocation(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })),
          { minLength: 1, maxLength: 10 }
        ),
        (allocations) => {
          const sum = allocations.reduce((acc, a) => acc + a.allocationPercentage, 0);
          const roundedSum = Math.round(sum * 100) / 100;

          // Only test cases where sum ≠ 100
          fc.pre(roundedSum !== 100);

          const result = validateAllocationSum(allocations);
          expect(result.isValid).toBe(false);
          expect(result.warning).toBeDefined();
          expect(typeof result.warning).toBe('string');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Validates: Requirements 8.3
   * When allocation percentages sum to exactly 100%, no warning is produced.
   */
  it('returns valid when allocation sum === 100%', () => {
    fc.assert(
      fc.property(
        fc
          .array(
            fc.double({ min: 0.01, max: 99.99, noNaN: true, noDefaultInfinity: true }),
            { minLength: 1, maxLength: 9 }
          )
          .map((partials) => {
            // Force the last allocation to make the sum exactly 100
            const partialSum = partials.reduce((a, b) => a + b, 0);
            const roundedPartialSum = Math.round(partialSum * 100) / 100;
            const remainder = Math.round((100 - roundedPartialSum) * 100) / 100;
            // Only valid if remainder is in [0, 100]
            if (remainder < 0 || remainder > 100) return null;
            return [...partials, remainder];
          })
          .filter((arr): arr is number[] => arr !== null),
        (percentages) => {
          const allocations = percentages.map((pct, i) => ({
            id: `a-${i}`,
            categoryName: `Category ${i}`,
            allocationPercentage: pct,
          }));

          const result = validateAllocationSum(allocations);
          expect(result.isValid).toBe(true);
          expect(result.warning).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });
});
