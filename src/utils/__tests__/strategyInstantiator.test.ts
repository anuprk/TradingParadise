import { describe, it, expect } from 'vitest';
import {
  instantiateTemplate,
  instantiateTemplates,
  detectDuplicates,
  resolveAndInstantiate,
} from '../strategyInstantiator';
import type { OptionsStrategyTemplate } from '../../data/strategyLibrary';
import type { Strategy } from '../../types/tradingPlan';

const makeTemplate = (overrides: Partial<OptionsStrategyTemplate> = {}): OptionsStrategyTemplate => ({
  templateId: 'test-template',
  name: 'Test Strategy',
  classification: 'Core',
  description: 'A test strategy',
  entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30 days' }],
  managementRules: [{ id: 'mr-1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }],
  profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
  stopLosses: [{ id: 'sl-1', stopValue: '2x credit', action: 'Close' }],
  ...overrides,
});

const makeStrategy = (overrides: Partial<Strategy> = {}): Strategy => ({
  id: 'existing-id-1',
  name: 'Existing Strategy',
  classification: 'Core',
  description: 'An existing strategy',
  entryCriteria: [{ id: 'ec-1', parameterName: 'DTE', value: '30 days' }],
  managementRules: [{ id: 'mr-1', triggerCondition: 'At 21 DTE', actionDescription: 'Close' }],
  profitTargets: [{ id: 'pt-1', targetValue: '50%', action: 'Close' }],
  stopLosses: [{ id: 'sl-1', stopValue: '2x credit', action: 'Close' }],
  ...overrides,
});

describe('strategyInstantiator', () => {
  describe('instantiateTemplate', () => {
    it('generates a UUID id and removes templateId', () => {
      const template = makeTemplate();
      const strategy = instantiateTemplate(template);

      expect(strategy.id).toBeDefined();
      expect(strategy.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect((strategy as Record<string, unknown>)['templateId']).toBeUndefined();
    });

    it('preserves all other fields from the template', () => {
      const template = makeTemplate({
        name: 'Iron Condor',
        classification: 'Core',
        description: 'Neutral strategy',
        variants: [{ id: 'v1', name: 'Standard', description: 'Equal wings' }],
      });
      const strategy = instantiateTemplate(template);

      expect(strategy.name).toBe('Iron Condor');
      expect(strategy.classification).toBe('Core');
      expect(strategy.description).toBe('Neutral strategy');
      expect(strategy.variants).toEqual([{ id: 'v1', name: 'Standard', description: 'Equal wings' }]);
      expect(strategy.entryCriteria).toEqual(template.entryCriteria);
      expect(strategy.managementRules).toEqual(template.managementRules);
      expect(strategy.profitTargets).toEqual(template.profitTargets);
      expect(strategy.stopLosses).toEqual(template.stopLosses);
    });

    it('generates unique IDs on each call', () => {
      const template = makeTemplate();
      const s1 = instantiateTemplate(template);
      const s2 = instantiateTemplate(template);

      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('instantiateTemplates', () => {
    it('returns an array of strategies with unique IDs', () => {
      const templates = [
        makeTemplate({ templateId: 'a', name: 'A' }),
        makeTemplate({ templateId: 'b', name: 'B' }),
        makeTemplate({ templateId: 'c', name: 'C' }),
      ];
      const strategies = instantiateTemplates(templates);

      expect(strategies).toHaveLength(3);
      const ids = strategies.map((s) => s.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('returns empty array for empty input', () => {
      expect(instantiateTemplates([])).toEqual([]);
    });
  });

  describe('detectDuplicates', () => {
    it('detects exact name match', () => {
      const templates = [makeTemplate({ name: 'Iron Condor' })];
      const existing = [makeStrategy({ name: 'Iron Condor' })];

      const conflicts = detectDuplicates(templates, existing);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].template.name).toBe('Iron Condor');
      expect(conflicts[0].existingStrategy.name).toBe('Iron Condor');
    });

    it('detects case-insensitive name match', () => {
      const templates = [makeTemplate({ name: 'iron condor' })];
      const existing = [makeStrategy({ name: 'Iron Condor' })];

      const conflicts = detectDuplicates(templates, existing);
      expect(conflicts).toHaveLength(1);
    });

    it('returns empty array when no duplicates exist', () => {
      const templates = [makeTemplate({ name: 'Iron Condor' })];
      const existing = [makeStrategy({ name: 'Covered Call' })];

      const conflicts = detectDuplicates(templates, existing);
      expect(conflicts).toHaveLength(0);
    });

    it('handles multiple conflicts', () => {
      const templates = [
        makeTemplate({ templateId: 'a', name: 'Iron Condor' }),
        makeTemplate({ templateId: 'b', name: 'Covered Call' }),
      ];
      const existing = [
        makeStrategy({ id: '1', name: 'Iron Condor' }),
        makeStrategy({ id: '2', name: 'Covered Call' }),
      ];

      const conflicts = detectDuplicates(templates, existing);
      expect(conflicts).toHaveLength(2);
    });
  });

  describe('resolveAndInstantiate', () => {
    it('adds non-conflicting templates to toAdd', () => {
      const templates = [makeTemplate({ templateId: 'a', name: 'New Strategy' })];
      const existing = [makeStrategy({ name: 'Other Strategy' })];

      const result = resolveAndInstantiate(templates, existing, new Map());
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].name).toBe('New Strategy');
      expect(result.toReplace).toHaveLength(0);
    });

    it('skips templates with skip resolution', () => {
      const templates = [makeTemplate({ templateId: 'a', name: 'Iron Condor' })];
      const existing = [makeStrategy({ name: 'Iron Condor' })];
      const resolutions = new Map([['a', 'skip' as const]]);

      const result = resolveAndInstantiate(templates, existing, resolutions);
      expect(result.toAdd).toHaveLength(0);
      expect(result.toReplace).toHaveLength(0);
    });

    it('renames templates with rename resolution by appending " (Imported)"', () => {
      const templates = [makeTemplate({ templateId: 'a', name: 'Iron Condor' })];
      const existing = [makeStrategy({ name: 'Iron Condor' })];
      const resolutions = new Map([['a', 'rename' as const]]);

      const result = resolveAndInstantiate(templates, existing, resolutions);
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].name).toBe('Iron Condor (Imported)');
      expect(result.toReplace).toHaveLength(0);
    });

    it('replaces templates with replace resolution, preserving existing ID', () => {
      const templates = [makeTemplate({ templateId: 'a', name: 'Iron Condor' })];
      const existing = [makeStrategy({ id: 'keep-this-id', name: 'Iron Condor' })];
      const resolutions = new Map([['a', 'replace' as const]]);

      const result = resolveAndInstantiate(templates, existing, resolutions);
      expect(result.toAdd).toHaveLength(0);
      expect(result.toReplace).toHaveLength(1);
      expect(result.toReplace[0].id).toBe('keep-this-id');
      expect(result.toReplace[0].name).toBe('Iron Condor');
    });

    it('handles mixed resolutions correctly', () => {
      const templates = [
        makeTemplate({ templateId: 'a', name: 'Iron Condor' }),
        makeTemplate({ templateId: 'b', name: 'Covered Call' }),
        makeTemplate({ templateId: 'c', name: 'New Strategy' }),
      ];
      const existing = [
        makeStrategy({ id: 'id-1', name: 'Iron Condor' }),
        makeStrategy({ id: 'id-2', name: 'Covered Call' }),
      ];
      const resolutions = new Map<string, 'skip' | 'replace' | 'rename'>([
        ['a', 'skip'],
        ['b', 'replace'],
      ]);

      const result = resolveAndInstantiate(templates, existing, resolutions);
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].name).toBe('New Strategy');
      expect(result.toReplace).toHaveLength(1);
      expect(result.toReplace[0].id).toBe('id-2');
      expect(result.toReplace[0].name).toBe('Covered Call');
    });

    it('treats missing resolution as skip for conflicting templates', () => {
      const templates = [makeTemplate({ templateId: 'a', name: 'Iron Condor' })];
      const existing = [makeStrategy({ name: 'Iron Condor' })];

      const result = resolveAndInstantiate(templates, existing, new Map());
      expect(result.toAdd).toHaveLength(0);
      expect(result.toReplace).toHaveLength(0);
    });
  });
});
