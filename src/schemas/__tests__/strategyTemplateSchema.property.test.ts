// Feature: default-options-strategies, Property 1: Template Schema Validity

/**
 * Property-based test for template schema validity.
 * Verifies all 20 templates in the library pass templateSchema validation.
 *
 * **Validates: Requirements 1.3, 6.1**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getAllTemplates } from '../../data/strategyLibrary';
import { templateSchema } from '../strategyTemplateSchema';

// Feature: default-options-strategies, Property 2: Template Content Completeness

const MARKET_OUTLOOK_TERMS = ['bullish', 'bearish', 'neutral', 'volatility'];
const RISK_PROFILE_TERMS = ['defined risk', 'undefined risk'];

function containsMarketOutlookTerm(description: string): boolean {
  const lower = description.toLowerCase();
  return MARKET_OUTLOOK_TERMS.some((term) => lower.includes(term));
}

function containsRiskProfileTerm(description: string): boolean {
  const lower = description.toLowerCase();
  return RISK_PROFILE_TERMS.some((term) => lower.includes(term));
}

describe('Property 1: Template Schema Validity', () => {
  const allTemplates = getAllTemplates();

  /**
   * **Validates: Requirements 1.3, 6.1**
   * For any template selected from the library, it should pass templateSchema validation.
   */
  it('all templates in the library pass templateSchema validation', () => {
    fc.assert(
      fc.property(fc.constantFrom(...allTemplates), (template) => {
        const result = templateSchema.safeParse(template);
        if (!result.success) {
          const errors = result.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
          );
          expect.fail(
            `Template "${template.name}" (${template.templateId}) failed validation:\n${errors.join('\n')}`
          );
        }
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('library contains exactly 20 templates', () => {
    expect(allTemplates.length).toBe(20);
  });
});

describe('Property 2: Template Content Completeness', () => {
  const templates = getAllTemplates();

  /**
   * **Validates: Requirements 2.5**
   * Every template description contains at least one market outlook term and one risk profile term.
   */
  it('every template description contains at least one market outlook term and one risk profile term', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...templates),
        (template) => {
          const description = template.description;

          expect(
            containsMarketOutlookTerm(description),
          ).toBe(true);

          expect(
            containsRiskProfileTerm(description),
          ).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
