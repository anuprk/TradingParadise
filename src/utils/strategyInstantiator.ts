/**
 * Strategy Instantiator - Converts strategy templates into plan-ready Strategy objects
 * with fresh UUIDs, and handles duplicate detection/resolution during import.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Strategy } from '../types/tradingPlan';
import type { OptionsStrategyTemplate } from '../data/strategyLibrary';

export interface DuplicateConflict {
  template: OptionsStrategyTemplate;
  existingStrategy: Strategy;
}

export type DuplicateResolution = 'skip' | 'replace' | 'rename';

/**
 * Converts a single template into a plan-ready Strategy by generating a fresh UUID
 * and removing the templateId field.
 */
export function instantiateTemplate(template: OptionsStrategyTemplate): Strategy {
  const { templateId: _, ...rest } = template;
  return {
    ...rest,
    id: uuidv4(),
  };
}

/**
 * Batch instantiation of multiple templates into Strategy objects.
 */
export function instantiateTemplates(templates: OptionsStrategyTemplate[]): Strategy[] {
  return templates.map(instantiateTemplate);
}

/**
 * Detects duplicate strategies by comparing template names against existing strategy names
 * using case-insensitive matching.
 */
export function detectDuplicates(
  templates: OptionsStrategyTemplate[],
  existingStrategies: Strategy[],
): DuplicateConflict[] {
  const conflicts: DuplicateConflict[] = [];

  for (const template of templates) {
    const existing = existingStrategies.find(
      (s) => s.name.toLowerCase() === template.name.toLowerCase(),
    );
    if (existing) {
      conflicts.push({ template, existingStrategy: existing });
    }
  }

  return conflicts;
}

/**
 * Applies duplicate resolution logic and instantiates templates accordingly.
 *
 * - 'skip': template is not imported
 * - 'rename': template is imported with " (Imported)" appended to the name
 * - 'replace': template is instantiated with the existing strategy's ID (replaces in-place)
 *
 * Templates without conflicts are instantiated normally into toAdd.
 */
export function resolveAndInstantiate(
  templates: OptionsStrategyTemplate[],
  existingStrategies: Strategy[],
  resolutions: Map<string, DuplicateResolution>,
): { toAdd: Strategy[]; toReplace: Strategy[] } {
  const toAdd: Strategy[] = [];
  const toReplace: Strategy[] = [];

  const conflicts = detectDuplicates(templates, existingStrategies);
  const conflictTemplateIds = new Set(conflicts.map((c) => c.template.templateId));

  for (const template of templates) {
    if (!conflictTemplateIds.has(template.templateId)) {
      // No conflict — instantiate normally
      toAdd.push(instantiateTemplate(template));
      continue;
    }

    const resolution = resolutions.get(template.templateId);
    if (!resolution || resolution === 'skip') {
      continue;
    }

    if (resolution === 'rename') {
      const { templateId: _, ...rest } = template;
      toAdd.push({
        ...rest,
        id: uuidv4(),
        name: `${template.name} (Imported)`,
      });
    } else if (resolution === 'replace') {
      const conflict = conflicts.find((c) => c.template.templateId === template.templateId);
      if (conflict) {
        const { templateId: _, ...rest } = template;
        toReplace.push({
          ...rest,
          id: conflict.existingStrategy.id,
        });
      }
    }
  }

  return { toAdd, toReplace };
}
