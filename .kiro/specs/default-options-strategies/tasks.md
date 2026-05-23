# Implementation Plan: Default Options Strategies

## Overview

This plan implements a static strategy library of 20 pre-defined options trading templates, a strategy instantiator for converting templates to plan-ready strategies, a Zod-based template validator, a StrategyImporter modal component, and a plan creation prompt for auto-populating defaults. The implementation builds incrementally: data layer first, then logic utilities, then UI components, and finally integration wiring.

## Tasks

- [x] 1. Create strategy library data module
  - [x] 1.1 Create `src/data/strategyLibrary.ts` with interfaces, category definitions, and all 20 strategy templates
    - Define `OptionsStrategyTemplate` interface (extends Strategy minus `id`, adds `templateId`)
    - Define `StrategyCategory` interface with `id`, `name`, `description`, `templateIds`
    - Export the 7 categories: Directional, Premium Selling, Vertical Spreads, Iron Strategies, Volatility, Calendar and Diagonal, Advanced
    - Implement all 20 templates with complete entry criteria, management rules, profit targets, and stop losses
    - Each template must have a stable `templateId` slug (e.g., `"iron-condor"`, `"covered-call"`)
    - Classify per requirements: Core for premium-selling/income strategies, Speculative for directional/timing-dependent
    - Each description must include market outlook (bullish/bearish/neutral/volatility) and risk profile (defined/undefined risk)
    - Export helper functions: `getAllTemplates()`, `getCategories()`, `getTemplatesByCategory(categoryId)`, `getTemplateById(templateId)`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 6.3_

- [x] 2. Create strategy template validator schema
  - [x] 2.1 Create `src/schemas/strategyTemplateSchema.ts` with Zod schema for template validation
    - Define `templateSchema` that validates all template fields (name, classification, description, entryCriteria min 1, managementRules min 1, profitTargets min 1, stopLosses min 1, templateId)
    - Export a `validateTemplate` function that returns a typed result with success/error
    - Export a `filterValidTemplates` function that takes an array of templates, validates each, logs warnings for invalid ones, and returns only valid templates
    - Reuse existing sub-schemas from `tradingPlanSchema.ts` where possible (entryCriterionSchema, managementRuleSchema, etc.)
    - _Requirements: 6.1, 6.4_

  - [x] 2.2 Write property test for template schema validity (Property 1)
    - **Property 1: Template Schema Validity**
    - **Validates: Requirements 1.3, 6.1**
    - Verify all 20 templates in the library pass `templateSchema` validation

  - [x] 2.3 Write property test for template content completeness (Property 2)
    - **Property 2: Template Content Completeness**
    - **Validates: Requirements 2.5**
    - Verify all template descriptions contain at least one market outlook term and one risk profile term

  - [x] 2.4 Write property test for JSON round-trip (Property 6)
    - **Property 6: JSON Serialization Round-Trip**
    - **Validates: Requirements 6.2**
    - For each template, verify `JSON.parse(JSON.stringify(template))` deep-equals the original

  - [x] 2.5 Write property test for invalid template exclusion (Property 7)
    - **Property 7: Invalid Template Exclusion**
    - **Validates: Requirements 6.4**
    - Generate arbitrary invalid templates mixed with valid ones, verify `filterValidTemplates` returns exactly the valid subset

- [x] 3. Create strategy instantiator utility
  - [x] 3.1 Create `src/utils/strategyInstantiator.ts` with template-to-strategy conversion and duplicate detection
    - Implement `instantiateTemplate(template)`: copies all fields, generates a fresh UUID `id`, removes `templateId`
    - Implement `instantiateTemplates(templates)`: batch instantiation returning `Strategy[]`
    - Implement `detectDuplicates(templates, existingStrategies)`: case-insensitive name matching, returns `DuplicateConflict[]`
    - Implement `resolveAndInstantiate(templates, existingStrategies, resolutions)`: applies skip/rename/replace logic, returns `{ toAdd, toReplace }`
    - Rename appends " (Imported)" suffix to the strategy name
    - _Requirements: 3.3, 4.5, 4.6_

  - [x] 3.2 Write property test for unique ID generation (Property 4)
    - **Property 4: Unique ID Generation**
    - **Validates: Requirements 3.3, 4.6**
    - Instantiate random subsets of templates multiple times, verify all IDs are unique and don't collide with existing plan IDs

  - [x] 3.3 Write property test for duplicate detection (Property 5)
    - **Property 5: Duplicate Detection by Name**
    - **Validates: Requirements 4.5**
    - Generate random existing strategy name lists and template selections, verify name-based collision detection is correct (case-insensitive)

  - [x] 3.4 Write property test for classification-based routing (Property 3)
    - **Property 3: Classification-Based Routing**
    - **Validates: Requirements 3.2, 4.4**
    - Instantiate random template subsets, partition by classification, verify Core goes to coreStrategies and Speculative goes to speculativeStrategies with no overlap

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create StrategyImporter modal component
  - [x] 5.1 Create `src/components/plan/StrategyImporter.tsx` with category browsing, multi-select, duplicate resolution, and import confirmation
    - Accept props: `isOpen`, `onClose`, `existingStrategies`, `onImport`
    - Implement three-state flow: Browse & Select (category accordion with checkboxes), Resolve Duplicates (skip/rename/replace per conflict), Confirm (summary)
    - Display strategies grouped by category with "Select All" per category
    - Show strategy name, classification badge, and description preview in each row
    - Disable confirm button when no strategies are selected
    - Call `detectDuplicates` when moving from select to confirm; skip duplicate step if no conflicts
    - On confirm, call `resolveAndInstantiate` and pass results to `onImport` callback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Write unit tests for StrategyImporter component
    - Test renders categories and strategy checkboxes
    - Test multi-select and "Select All" per category
    - Test duplicate conflict UI appears when conflicts exist
    - Test confirm dispatches correct strategies to onImport
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 6. Integrate plan creation prompt and import button
  - [x] 6.1 Add default strategies prompt to PlanEditor for new plan creation
    - When `isNewPlan` is true, show an inline prompt with "Include Default Strategies" and "Start Empty" buttons
    - "Include Defaults" instantiates all templates, partitions by classification, and populates `coreStrategies` and `speculativeStrategies` on the plan
    - "Start Empty" leaves strategy arrays empty (current behavior)
    - Prompt disappears after selection
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Add "Import Default Strategies" button to PlanViewer strategy section
    - Add a button in the strategy section of PlanViewer that opens the StrategyImporter modal
    - Wire the `onImport` callback to update the plan store: add `toAdd` strategies to the appropriate arrays, replace `toReplace` strategies in-place
    - _Requirements: 4.1, 4.4, 5.1, 5.2, 5.3_

  - [x] 6.3 Write integration tests for import and plan creation flows
    - Test plan creation with defaults: verify strategies appear in correct arrays
    - Test import into existing plan: open importer, select, confirm, verify plan state
    - Test imported strategy is editable via StrategyEditor
    - _Requirements: 3.1, 3.2, 4.1, 4.4, 5.1, 5.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `strategySchema` in `src/schemas/tradingPlanSchema.ts` already validates instantiated strategies; the new `templateSchema` validates templates (which lack the `id` field but have `templateId`)
- The `src/data/` directory does not yet exist and will be created in task 1.1
- fast-check v4.7.0 is already available as a dev dependency

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1", "6.2"] },
    { "id": 5, "tasks": ["6.3"] }
  ]
}
```
