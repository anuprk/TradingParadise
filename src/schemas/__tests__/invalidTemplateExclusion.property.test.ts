// Feature: default-options-strategies, Property 7: Invalid Template Exclusion

/**
 * Property-based test for invalid template exclusion.
 * Given a mix of valid templates (from the library) and generated invalid templates
 * (missing required fields, empty arrays, etc.), filterValidTemplates should return
 * exactly the valid ones and exclude the invalid ones.
 *
 * **Validates: Requirements 6.4**
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { getAllTemplates } from '../../data/strategyLibrary';
import { filterValidTemplates } from '../strategyTemplateSchema';

// Suppress console.warn during tests (filterValidTemplates logs warnings for invalid templates)
vi.spyOn(console, 'warn').mockImplementation(() => {});

// --- Generators for invalid template-like objects ---

/**
 * Generates an object that looks like a template but is missing one or more required fields,
 * has empty arrays where min(1) is required, or has invalid field types.
 */
const arbInvalidTemplate = fc.oneof(
  // Missing templateId entirely
  fc.record({
    name: fc.string({ minLength: 1 }),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Empty name (fails min(1) validation)
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.constant(''),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Invalid classification value
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    classification: fc.string({ minLength: 1 }).filter((s) => s !== 'Core' && s !== 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Empty entryCriteria array (fails min(1))
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Empty managementRules array (fails min(1))
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Empty profitTargets array (fails min(1))
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([]),
    stopLosses: fc.constant([{ id: 's1', stopValue: '2x', action: 'Close' }]),
  }),

  // Empty stopLosses array (fails min(1))
  fc.record({
    templateId: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    classification: fc.constantFrom('Core', 'Speculative'),
    description: fc.string({ minLength: 1 }),
    entryCriteria: fc.constant([{ id: 'e1', parameterName: 'DTE', value: '30 days' }]),
    managementRules: fc.constant([{ id: 'm1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }]),
    profitTargets: fc.constant([{ id: 'p1', targetValue: '50%', action: 'Close' }]),
    stopLosses: fc.constant([]),
  }),

  // Completely wrong shape (random object)
  fc.object(),
);

describe('Property 7: Invalid Template Exclusion', () => {
  const allValidTemplates = getAllTemplates();

  it('filterValidTemplates returns exactly the valid subset when mixed with invalid templates', () => {
    fc.assert(
      fc.property(
        // Pick a random subset of valid templates
        fc.subarray(allValidTemplates, { minLength: 0 }),
        // Generate 1-5 invalid templates
        fc.array(arbInvalidTemplate, { minLength: 1, maxLength: 5 }),
        (validSubset, invalidTemplates) => {
          // Mix valid and invalid in a random order
          const mixed: unknown[] = [...validSubset, ...invalidTemplates];

          const result = filterValidTemplates(mixed);

          // Result should contain exactly the valid templates (same count)
          expect(result.length).toBe(validSubset.length);

          // Every returned template should be one of the valid ones we put in
          for (const returned of result) {
            const found = validSubset.some(
              (v) => v.templateId === returned.templateId && v.name === returned.name,
            );
            expect(found).toBe(true);
          }

          // None of the invalid templates should appear in the result
          for (const invalid of invalidTemplates) {
            const invalidInResult = result.some(
              (r) =>
                'templateId' in (invalid as object) &&
                r.templateId === (invalid as { templateId: string }).templateId,
            );
            // If the invalid template happened to have a templateId, it still shouldn't pass validation
            // (because it's missing other required fields or has invalid values)
            if (invalidInResult) {
              // Double-check: this should not happen since our generators produce invalid objects
              expect(invalidInResult).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('filterValidTemplates returns empty array when given only invalid templates', () => {
    fc.assert(
      fc.property(
        fc.array(arbInvalidTemplate, { minLength: 1, maxLength: 10 }),
        (invalidTemplates) => {
          const result = filterValidTemplates(invalidTemplates);
          expect(result.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
