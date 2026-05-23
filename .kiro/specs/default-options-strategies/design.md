# Design Document: Default Options Strategies

## Overview

This feature adds a static strategy library module containing 20 pre-defined options trading strategies and a Strategy Importer UI that lets traders populate their plans from this catalog. The library is a pure TypeScript data module (no database table) that exports `Strategy`-conformant objects organized by category. Two integration points exist: an opt-in prompt during plan creation, and an "Import Default Strategies" action on existing plans.

The design prioritizes zero-config usability (traders get a working strategy set immediately) while preserving full editability (imported strategies are indistinguishable from manually created ones after import).

## Architecture

```mermaid
graph TD
    subgraph "Data Layer (static module)"
        SL[strategyLibrary.ts]
        SL --> |exports| TEMPLATES[OptionsStrategyTemplate[]]
        SL --> |exports| CATEGORIES[StrategyCategory[]]
        SL --> |exports| getTemplatesByCategory
        SL --> |exports| getTemplateById
    end

    subgraph "Logic Layer"
        INST[strategyInstantiator.ts]
        INST --> |uses| SL
        INST --> |generates UUIDs| UUID[uuid v4]
        VAL[strategyValidator.ts]
        VAL --> |validates against| ZOD[Strategy Zod schema]
    end

    subgraph "UI Layer"
        PI[StrategyImporter modal]
        PI --> |calls| INST
        PE[PlanEditor]
        PE --> |shows prompt on create| PI
        PE --> |shows import button| PI
    end

    subgraph "State & Persistence"
        PS[planStore]
        PS --> |saves to| DB[(Supabase plans table)]
    end

    PI --> |dispatches strategies| PS
    PE --> |reads/writes| PS
```

The strategy library is a build-time constant. No network requests are needed to access it. The instantiation layer handles ID generation and duplicate detection. The UI layer presents the catalog and wires user selections into the existing plan store.

## Components and Interfaces

### Strategy Library Module (`src/data/strategyLibrary.ts`)

A static data module exporting the full catalog of strategy templates.

```typescript
import type { Strategy } from '../types/tradingPlan';

export interface StrategyCategory {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
}

export interface OptionsStrategyTemplate extends Omit<Strategy, 'id'> {
  templateId: string; // stable identifier, never changes between versions
}

export function getAllTemplates(): OptionsStrategyTemplate[];
export function getCategories(): StrategyCategory[];
export function getTemplatesByCategory(categoryId: string): OptionsStrategyTemplate[];
export function getTemplateById(templateId: string): OptionsStrategyTemplate | undefined;
```

The `templateId` is a human-readable slug (e.g., `"iron-condor"`, `"covered-call"`) that remains stable across app versions. This is distinct from the `id` field on instantiated `Strategy` objects, which is a UUID generated fresh each time a template is added to a plan.

### Strategy Instantiator (`src/utils/strategyInstantiator.ts`)

Handles converting templates into plan-ready `Strategy` objects with fresh IDs, and detecting duplicates.

```typescript
import type { Strategy } from '../types/tradingPlan';
import type { OptionsStrategyTemplate } from '../data/strategyLibrary';

export interface DuplicateConflict {
  template: OptionsStrategyTemplate;
  existingStrategy: Strategy;
}

export type DuplicateResolution = 'skip' | 'replace' | 'rename';

export function instantiateTemplate(template: OptionsStrategyTemplate): Strategy;
export function instantiateTemplates(templates: OptionsStrategyTemplate[]): Strategy[];
export function detectDuplicates(
  templates: OptionsStrategyTemplate[],
  existingStrategies: Strategy[],
): DuplicateConflict[];
export function resolveAndInstantiate(
  templates: OptionsStrategyTemplate[],
  existingStrategies: Strategy[],
  resolutions: Map<string, DuplicateResolution>,
): { toAdd: Strategy[]; toReplace: Strategy[] };
```

### Strategy Validator (`src/schemas/strategySchema.ts`)

Zod schema for validating strategy objects. Used both for runtime validation of the library data and for form validation in the StrategyEditor.

```typescript
import { z } from 'zod';

export const strategySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  classification: z.enum(['Core', 'Speculative']),
  description: z.string().min(1),
  variants: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
  })).optional(),
  entryCriteria: z.array(z.object({
    id: z.string().min(1),
    parameterName: z.string().min(1),
    value: z.string().min(1),
  })).min(1),
  managementRules: z.array(z.object({
    id: z.string().min(1),
    triggerCondition: z.string().min(1),
    actionDescription: z.string().min(1),
  })).min(1),
  profitTargets: z.array(z.object({
    id: z.string().min(1),
    targetValue: z.string().min(1),
    action: z.string().min(1),
  })).min(1),
  stopLosses: z.array(z.object({
    id: z.string().min(1),
    stopValue: z.string().min(1),
    action: z.string().min(1),
  })).min(1),
});

export const templateSchema = strategySchema.omit({ id: true }).extend({
  templateId: z.string().min(1),
});
```

### Strategy Importer Component (`src/components/plan/StrategyImporter.tsx`)

A modal component that displays the strategy catalog organized by category, allows multi-select, handles duplicate detection, and dispatches the import.

```typescript
interface StrategyImporterProps {
  isOpen: boolean;
  onClose: () => void;
  existingStrategies: Strategy[];
  onImport: (strategies: Strategy[], replacements: Strategy[]) => void;
}
```

The modal has three states:
1. **Browse & Select** — category accordion with checkboxes per strategy, "Select All" per category
2. **Resolve Duplicates** — shown only if conflicts exist; per-conflict radio: Skip / Rename / Replace
3. **Confirm** — summary of what will be added/replaced

### Plan Creation Prompt

A small inline component shown in the plan creation flow (within PlanEditor when `isNewPlan` is true) that asks whether to include default strategies. Two buttons: "Include Defaults" and "Start Empty".

## Data Models

### Strategy Library Data Structure

The library is organized as a flat array of templates plus a separate category index:

```typescript
// Categories
const CATEGORIES: StrategyCategory[] = [
  { id: 'directional', name: 'Directional', description: 'Single-leg directional bets', templateIds: ['long-call', 'long-put'] },
  { id: 'premium-selling', name: 'Premium Selling', description: 'Selling premium for income', templateIds: ['short-call', 'short-put', 'covered-call'] },
  { id: 'vertical-spreads', name: 'Vertical Spreads', description: 'Defined-risk directional spreads', templateIds: ['bull-call-spread', 'bear-put-spread', 'bull-put-spread', 'bear-call-spread'] },
  { id: 'iron-strategies', name: 'Iron Strategies', description: 'Multi-leg neutral income strategies', templateIds: ['iron-condor', 'iron-butterfly'] },
  { id: 'volatility', name: 'Volatility', description: 'Volatility expansion and contraction plays', templateIds: ['long-straddle', 'short-straddle', 'long-strangle', 'short-strangle'] },
  { id: 'calendar-diagonal', name: 'Calendar and Diagonal', description: 'Time-based spreads', templateIds: ['calendar-spread', 'diagonal-spread'] },
  { id: 'advanced', name: 'Advanced', description: 'Complex multi-leg structures', templateIds: ['butterfly-spread', 'ratio-spread', 'collar'] },
];
```

### Template Example (Iron Condor)

```typescript
{
  templateId: 'iron-condor',
  name: 'Iron Condor',
  classification: 'Core',
  description: 'Neutral strategy selling an OTM put spread and OTM call spread simultaneously. Profits from time decay in low-volatility environments. Defined risk on both sides.',
  variants: [
    { id: 'ic-standard', name: 'Standard', description: 'Equal-width wings' },
    { id: 'ic-broken-wing', name: 'Broken Wing', description: 'Unequal wing widths for directional bias' },
  ],
  entryCriteria: [
    { id: 'ic-dte', parameterName: 'DTE', value: '30-45 days' },
    { id: 'ic-delta', parameterName: 'Short Strike Delta', value: '0.16 (1 SD)' },
    { id: 'ic-ivr', parameterName: 'IV Rank', value: 'Above 30' },
    { id: 'ic-width', parameterName: 'Wing Width', value: '$5 wide (adjust for underlying price)' },
  ],
  managementRules: [
    { id: 'ic-adj-1', triggerCondition: 'Short strike tested (delta > 0.30)', actionDescription: 'Roll untested side closer to collect additional credit' },
    { id: 'ic-adj-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close position to avoid gamma risk' },
  ],
  profitTargets: [
    { id: 'ic-pt-1', targetValue: '50% of max profit', action: 'Close entire position' },
  ],
  stopLosses: [
    { id: 'ic-sl-1', stopValue: '2x credit received', action: 'Close entire position' },
  ],
}
```

### Classification Mapping

| Classification | Strategies |
|---|---|
| Core | Short Put, Covered Call, Iron Condor, Iron Butterfly, Bull Put Spread, Bear Call Spread, Short Straddle, Short Strangle, Calendar Spread, Diagonal Spread, Butterfly Spread, Collar |
| Speculative | Long Call, Long Put, Short Call, Bull Call Spread, Bear Put Spread, Long Straddle, Long Strangle, Ratio Spread |

Design rationale: Premium-selling and defined-risk income strategies are classified as Core because they form the backbone of a consistent income-generating portfolio. Directional bets and strategies requiring large moves are Speculative because they depend on market timing.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Template Schema Validity

*For any* template in the strategy library, it should pass the `templateSchema` Zod validation (non-empty name, non-empty description, valid classification, at least one entry criterion, at least one management rule, at least one profit target, and at least one stop loss).

**Validates: Requirements 1.3, 6.1**

### Property 2: Template Content Completeness

*For any* template in the strategy library, the description should contain at least one market outlook indicator (bullish, bearish, neutral, or volatility-related term) and at least one risk profile indicator (defined risk or undefined risk).

**Validates: Requirements 2.5**

### Property 3: Classification-Based Routing

*For any* set of templates selected for import, when instantiated and added to a plan, each strategy should appear in `coreStrategies` if its classification is `'Core'` and in `speculativeStrategies` if its classification is `'Speculative'`. No strategy should appear in both arrays or in neither.

**Validates: Requirements 3.2, 4.4**

### Property 4: Unique ID Generation

*For any* number of templates instantiated (whether during plan creation or import), all generated strategy `id` values should be unique — no two instantiated strategies share the same ID, and no instantiated ID collides with any existing strategy ID in the target plan.

**Validates: Requirements 3.3, 4.6**

### Property 5: Duplicate Detection by Name

*For any* plan with existing strategies and any set of templates selected for import, if a template's `name` matches an existing strategy's `name` (case-insensitive), the duplicate detection function should flag that template as a conflict.

**Validates: Requirements 4.5**

### Property 6: JSON Serialization Round-Trip

*For any* template in the strategy library, serializing to JSON via `JSON.stringify` and then deserializing via `JSON.parse` should produce an object with all fields equivalent to the original template.

**Validates: Requirements 6.2**

### Property 7: Invalid Template Exclusion

*For any* library dataset where one or more templates fail schema validation, the filtering function should return all valid templates and exclude only the invalid ones — the count of valid results should equal the total count minus the number of invalid templates.

**Validates: Requirements 6.4**

## Error Handling

| Scenario | Handling |
|---|---|
| Template fails schema validation at load time | Log warning with template name and validation errors. Exclude from catalog. Other templates remain available. |
| Duplicate name detected during import | Show conflict resolution UI. User chooses skip, rename, or replace per conflict. No silent overwrites. |
| UUID generation collision (astronomically unlikely) | The `uuid` library guarantees v4 uniqueness. No additional handling needed. |
| Plan save fails after import | Standard plan store error handling applies — toast notification with error message, plan state remains dirty so user can retry. |
| Empty selection on import confirm | Disable the confirm button when no strategies are selected. |

## Testing Strategy

### Property-Based Tests (fast-check + Vitest)

The following properties will be tested with fast-check, running a minimum of 100 iterations each:

1. **Template schema validity** — Generate arbitrary subsets of the library and verify all pass validation.
2. **Classification routing** — Generate random selections of templates, instantiate them, and verify correct array placement.
3. **Unique ID generation** — Instantiate templates multiple times and verify no ID collisions.
4. **Duplicate detection** — Generate random existing strategy lists and import selections, verify name-based collision detection is correct.
5. **JSON round-trip** — For each template, verify `JSON.parse(JSON.stringify(t))` deep-equals `t`.
6. **Invalid template exclusion** — Inject invalid templates into a library copy and verify filtering removes exactly the invalid ones.
7. **Content completeness** — Verify all templates contain required description keywords.

Each property test will be tagged with a comment referencing the design property:
```typescript
// Feature: default-options-strategies, Property 1: Template Schema Validity
```

Configuration: minimum 100 iterations per property via `fc.assert(property, { numRuns: 100 })`.

### Unit Tests (Vitest)

- Library exports exactly 20 templates with the correct names
- Categories contain the correct template IDs
- Classification mapping matches requirements (specific named strategies checked)
- `instantiateTemplate` produces a valid `Strategy` with a UUID `id` field
- Duplicate resolution: skip removes from import list, rename appends suffix, replace returns replacement
- Plan creation prompt: renders two options, "Include Defaults" triggers population, "Start Empty" leaves arrays empty
- Strategy Importer modal: renders categories, supports multi-select, shows conflict UI when duplicates exist

### Integration Tests

- Import flow end-to-end: open importer, select strategies, confirm, verify plan state updated
- Plan creation with defaults: create plan with defaults enabled, verify strategies appear in plan viewer
- Imported strategy is editable: import a strategy, open StrategyEditor on it, modify a field, save

### Library: fast-check

The project already uses `fast-check` (v4.7.0) as a dev dependency. Property tests will use `fc.assert` with `fc.property` and custom arbitraries for generating template subsets and strategy name lists.
