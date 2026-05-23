/**
 * Zod validation schema for OptionsStrategyTemplate objects.
 * Validates templates from the strategy library before they are
 * presented in the catalog or instantiated into plan strategies.
 */

import { z } from 'zod';
import {
  entryCriterionSchema,
  managementRuleSchema,
  profitTargetSchema,
  stopLossSchema,
  strategyVariantSchema,
} from './tradingPlanSchema';
import type { OptionsStrategyTemplate } from '../data/strategyLibrary';

export const templateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Template name is required'),
  classification: z.union([z.literal('Core'), z.literal('Speculative')]),
  description: z.string().min(1, 'Template description is required'),
  variants: z.array(strategyVariantSchema).optional(),
  entryCriteria: z.array(entryCriterionSchema).min(1, 'At least one entry criterion is required'),
  managementRules: z.array(managementRuleSchema).min(1, 'At least one management rule is required'),
  profitTargets: z.array(profitTargetSchema).min(1, 'At least one profit target is required'),
  stopLosses: z.array(stopLossSchema).min(1, 'At least one stop loss is required'),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export interface ValidationSuccess {
  success: true;
  data: TemplateInput;
}

export interface ValidationError {
  success: false;
  errors: z.ZodError;
}

export type ValidationResult = ValidationSuccess | ValidationError;

/**
 * Validates a single template against the templateSchema.
 * Returns a typed result indicating success with parsed data or failure with errors.
 */
export function validateTemplate(template: unknown): ValidationResult {
  const result = templateSchema.safeParse(template);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Filters an array of templates, returning only those that pass schema validation.
 * Logs a warning for each invalid template with the template name (if available)
 * and the validation errors.
 */
export function filterValidTemplates(templates: unknown[]): OptionsStrategyTemplate[] {
  const valid: OptionsStrategyTemplate[] = [];

  for (const template of templates) {
    const result = templateSchema.safeParse(template);
    if (result.success) {
      valid.push(template as OptionsStrategyTemplate);
    } else {
      const name =
        template && typeof template === 'object' && 'name' in template
          ? (template as { name: unknown }).name
          : 'unknown';
      console.warn(
        `[StrategyLibrary] Invalid template "${name}" excluded from catalog:`,
        result.error.issues.map((i) => i.message),
      );
    }
  }

  return valid;
}
