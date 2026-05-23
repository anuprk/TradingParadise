/**
 * Property-based tests for Strategy Instantiator.
 * Uses fast-check to verify classification routing and duplicate detection.
 *
 * Validates: Requirements 3.2, 4.4, 4.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getAllTemplates } from '../../data/strategyLibrary';
import { instantiateTemplates, detectDuplicates } from '../strategyInstantiator';
import type { Strategy } from '../../types/tradingPlan';
import type { OptionsStrategyTemplate } from '../../data/strategyLibrary';

// Feature: default-options-strategies, Property 3: Classification-Based Routing

describe('Property 3: Classification-Based Routing', () => {
  const allTemplates = getAllTemplates();

  /**
   * Validates: Requirements 3.2, 4.4
   *
   * For any random subset of templates from the library, when instantiated
   * and partitioned by classification field, every strategy with classification
   * 'Core' should be in the core partition and every strategy with classification
   * 'Speculative' should be in the speculative partition. No strategy should
   * appear in both or neither.
   */
  it('partitioning instantiated strategies by classification places each in exactly one array', () => {
    fc.assert(
      fc.property(fc.subarray(allTemplates), (templateSubset) => {
        const strategies = instantiateTemplates(templateSubset);

        // Partition by classification
        const coreStrategies = strategies.filter(
          (s) => s.classification === 'Core'
        );
        const speculativeStrategies = strategies.filter(
          (s) => s.classification === 'Speculative'
        );

        // Every strategy must appear in exactly one partition
        expect(coreStrategies.length + speculativeStrategies.length).toBe(
          strategies.length
        );

        // No overlap: a strategy cannot be in both
        const coreIds = new Set(coreStrategies.map((s) => s.id));
        const specIds = new Set(speculativeStrategies.map((s) => s.id));
        for (const id of coreIds) {
          expect(specIds.has(id)).toBe(false);
        }

        // Every Core-classified strategy is in the core partition
        for (const strategy of strategies) {
          if (strategy.classification === 'Core') {
            expect(coreIds.has(strategy.id)).toBe(true);
          }
        }

        // Every Speculative-classified strategy is in the speculative partition
        for (const strategy of strategies) {
          if (strategy.classification === 'Speculative') {
            expect(specIds.has(strategy.id)).toBe(true);
          }
        }

        // No strategy in neither partition
        for (const strategy of strategies) {
          expect(
            coreIds.has(strategy.id) || specIds.has(strategy.id)
          ).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('classification field is preserved through instantiation', () => {
    fc.assert(
      fc.property(fc.subarray(allTemplates), (templateSubset) => {
        const strategies = instantiateTemplates(templateSubset);

        // Each instantiated strategy retains the classification from its template
        for (let i = 0; i < templateSubset.length; i++) {
          expect(strategies[i].classification).toBe(
            templateSubset[i].classification
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('classification values are exclusively Core or Speculative', () => {
    fc.assert(
      fc.property(fc.subarray(allTemplates), (templateSubset) => {
        const strategies = instantiateTemplates(templateSubset);

        for (const strategy of strategies) {
          expect(['Core', 'Speculative']).toContain(strategy.classification);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: default-options-strategies, Property 5: Duplicate Detection by Name
/**
 * Property-based test for duplicate detection by name.
 * Verifies that detectDuplicates correctly identifies name-based collisions
 * (case-insensitive) between templates and existing strategies.
 *
 * **Validates: Requirements 4.5**
 */

// --- Generators ---

/** Generate a random strategy name (1-30 alphanumeric chars with spaces). */
const arbStrategyName: fc.Arbitrary<string> = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,29}$/);

/** Build a minimal valid Strategy from a name and id. */
function makeStrategy(name: string, id: string): Strategy {
  return {
    id,
    name,
    classification: 'Core',
    description: 'Test strategy',
    entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30 days' }],
    managementRules: [{ id: 'mr-1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }],
    profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
    stopLosses: [{ id: 'sl-1', stopValue: '2x', action: 'Close' }],
  };
}

/** Build a minimal valid OptionsStrategyTemplate from a name. */
function makeTemplate(name: string, templateId: string): OptionsStrategyTemplate {
  return {
    templateId,
    name,
    classification: 'Core',
    description: 'Test template',
    entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30 days' }],
    managementRules: [{ id: 'mr-1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }],
    profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
    stopLosses: [{ id: 'sl-1', stopValue: '2x', action: 'Close' }],
  };
}

describe('Property 5: Duplicate Detection by Name', () => {
  /**
   * **Validates: Requirements 4.5**
   *
   * For any set of templates and existing strategies, if a template's name matches
   * an existing strategy's name (case-insensitive), detectDuplicates should flag it
   * as a conflict. Names that only appear on one side should not produce conflicts.
   */
  it('templates whose names match existing strategies (case-insensitive) are flagged as conflicts', () => {
    fc.assert(
      fc.property(
        // Generate pools of unique base names, then assign some to both sides to create known conflicts
        fc.array(arbStrategyName, { minLength: 1, maxLength: 10 }),
        fc.array(arbStrategyName, { minLength: 0, maxLength: 5 }),
        fc.array(arbStrategyName, { minLength: 0, maxLength: 5 }),
        (sharedNames, templateOnlyNames, existingOnlyNames) => {
          // Deduplicate base names (case-insensitive) to avoid ambiguity
          const seen = new Set<string>();
          const uniqueShared: string[] = [];
          for (const n of sharedNames) {
            const lower = n.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              uniqueShared.push(n);
            }
          }
          const uniqueTemplateOnly: string[] = [];
          for (const n of templateOnlyNames) {
            const lower = n.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              uniqueTemplateOnly.push(n);
            }
          }
          const uniqueExistingOnly: string[] = [];
          for (const n of existingOnlyNames) {
            const lower = n.toLowerCase();
            if (!seen.has(lower)) {
              seen.add(lower);
              uniqueExistingOnly.push(n);
            }
          }

          // Build templates: shared names (uppercase variant) + template-only names
          const templates: OptionsStrategyTemplate[] = [
            ...uniqueShared.map((name, i) => makeTemplate(name.toUpperCase(), `shared-tmpl-${i}`)),
            ...uniqueTemplateOnly.map((name, i) => makeTemplate(name, `only-tmpl-${i}`)),
          ];

          // Build existing strategies: shared names (lowercase variant) + existing-only names
          const existingStrategies: Strategy[] = [
            ...uniqueShared.map((name, i) => makeStrategy(name.toLowerCase(), `shared-strat-${i}`)),
            ...uniqueExistingOnly.map((name, i) => makeStrategy(name, `only-strat-${i}`)),
          ];

          const conflicts = detectDuplicates(templates, existingStrategies);

          // Every shared name should produce exactly one conflict
          expect(conflicts.length).toBe(uniqueShared.length);

          // Each conflict's template name should case-insensitively match the existing strategy name
          for (const conflict of conflicts) {
            expect(conflict.template.name.toLowerCase()).toBe(
              conflict.existingStrategy.name.toLowerCase(),
            );
          }

          // Template-only names should NOT appear in conflicts
          const conflictTemplateIds = new Set(conflicts.map((c) => c.template.templateId));
          for (const tmpl of templates) {
            if (tmpl.templateId.startsWith('only-tmpl-')) {
              expect(conflictTemplateIds.has(tmpl.templateId)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * Detection is case-insensitive: the same name in different cases always produces a conflict.
   */
  it('detection is case-insensitive: same name in different cases always produces a conflict', () => {
    fc.assert(
      fc.property(
        arbStrategyName,
        (baseName) => {
          const template = makeTemplate(baseName.toUpperCase(), 'test-tmpl');
          const existing = makeStrategy(baseName.toLowerCase(), 'test-strat');

          const conflicts = detectDuplicates([template], [existing]);

          expect(conflicts.length).toBe(1);
          expect(conflicts[0].template.templateId).toBe('test-tmpl');
          expect(conflicts[0].existingStrategy.id).toBe('test-strat');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.5**
   *
   * No conflicts are reported when template names do not match any existing strategy names.
   */
  it('no conflicts are reported when template names do not match any existing strategy names', () => {
    fc.assert(
      fc.property(
        fc.array(arbStrategyName, { minLength: 1, maxLength: 10 }),
        fc.array(arbStrategyName, { minLength: 1, maxLength: 10 }),
        (templateNames, existingNames) => {
          // Ensure no overlap by prefixing each side differently
          const templates = templateNames.map((name, i) =>
            makeTemplate(`TMPL_${name}`, `tmpl-${i}`),
          );
          const existingStrategies = existingNames.map((name, i) =>
            makeStrategy(`EXIST_${name}`, `strat-${i}`),
          );

          const conflicts = detectDuplicates(templates, existingStrategies);

          expect(conflicts.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
