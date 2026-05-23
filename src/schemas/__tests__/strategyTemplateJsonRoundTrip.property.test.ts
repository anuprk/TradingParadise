// Feature: default-options-strategies, Property 6: JSON Serialization Round-Trip

/**
 * Property-based test for JSON serialization round-trip.
 * Verifies that for any template in the strategy library, serializing to JSON
 * and deserializing produces a deep-equal object.
 *
 * **Validates: Requirements 6.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getAllTemplates } from '../../data/strategyLibrary';

describe('Property 6: JSON Serialization Round-Trip', () => {
  const templates = getAllTemplates();

  it('for any template, JSON.parse(JSON.stringify(template)) deep-equals the original', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...templates),
        (template) => {
          const serialized = JSON.stringify(template);
          const deserialized = JSON.parse(serialized);
          expect(deserialized).toEqual(template);
        },
      ),
      { numRuns: 100 },
    );
  });
});
