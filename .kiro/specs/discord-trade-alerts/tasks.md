# Implementation Plan: Discord Trade Alerts

## Overview

This plan implements the Discord Trade Alerts section: a Supabase-backed feature for ingesting pasted options trade alerts, parsing them into structured fields, reviewing/confirming, and storing them per-user with RLS. It follows the app's four-layer flow (UI → Zustand store → repository → Supabase) and reuses the already-built, validated parser POC at `src/utils/parsers/discordAlertParser.ts` as-is.

The build order is data layer first (migration `012_discord_trade_alerts.sql`), then the swappable ingestion source abstraction, then repository and store, then routing/sidebar, then UI components, and finally wiring/verification. The parser is not rebuilt — existing example tests already cover extraction; this plan only adds the fast-check property tests (Properties 1-6) that extend the existing parser test file.

All 14 correctness properties from the design are implemented as single fast-check properties (min 100 iterations), tagged with a `// Feature: discord-trade-alerts, Property N: <name>` comment.

## Tasks

- [x] 1. Create database migration for Discord alert tables
  - Create `supabase/migrations/012_discord_trade_alerts.sql` with the two tables from the design: `discord_alert_sources` (community/chat_room, 1..100 trimmed-length CHECKs, per-user expression-based unique index on `lower(btrim(...))`) and `discord_trade_alerts` (source_id FK `ON DELETE CASCADE`, message_id, raw_content, submission_timestamp, action_type, nullable structured fields, `links JSONB DEFAULT '[]'`, `extracted_any_field`, `UNIQUE(user_id, source_id, message_id)`)
  - Add `idx_discord_trade_alerts_source` index on `source_id`
  - Enable RLS on both tables and add the `FOR ALL USING (auth.uid() = user_id)` policies, mirroring `008_portfolio_holdings.sql`
  - _Requirements: 2.1, 2.4, 2.5, 2.7, 3.4, 4.6, 5.4, 5.7, 5.8, 6.1, 6.3, 6.4_

- [x] 2. Implement the ingestion source abstraction
  - [x] 2.1 Define ingestion types
    - Create `src/utils/ingestion/types.ts` with the `RawSubmission` interface (`rawContent`, `community`, `chatRoom`, optional `externalMessageId`) and the `AlertIngestionSource` interface (`kind`, `toRawSubmissions(input, source)`)
    - _Requirements: 3.6_

  - [x] 2.2 Implement ManualPasteSource with raw-content cap
    - Create `src/utils/ingestion/manualPasteSource.ts` with `ManualPasteSource implements AlertIngestionSource` (`kind = 'manual-paste'`), producing exactly one `RawSubmission` per call and capping `rawContent` at the first 10,000 characters
    - Export a small pure `capRawContent(input): string` helper (first 10,000 chars) for reuse by the store and property test
    - _Requirements: 3.1, 3.6_

  - [x]* 2.3 Write property test for raw-content cap
    - Create/extend `src/utils/ingestion/__tests__/manualPasteSource.test.ts`
    - **Property 9: Raw content capture is capped at 10,000 characters**
    - `// Feature: discord-trade-alerts, Property 9: Raw content capture is capped at 10,000 characters`
    - **Validates: Requirements 3.1**

- [x] 3. Add fast-check property tests for the reused parser
  - [x]* 3.1 Add parser property tests (extend existing file)
    - Extend `src/utils/parsers/__tests__/discordAlertParser.test.ts` (do not rebuild the parser) with six single fast-check properties over arbitrary `rawContent` / source inputs, each min 100 iterations and tagged:
    - **Property 1: Parser determinism** — `// Feature: discord-trade-alerts, Property 1: Parser determinism` (_Validates: 4.2, 3.2_)
    - **Property 2: Action type is always in the fixed set** — tag Property 2 (_Validates: 4.1, 4.3_)
    - **Property 3: Parser preserves raw content exactly** — tag Property 3 (_Validates: 5.4, 5.5, 5.7_)
    - **Property 4: Parser output fields lie in their declared domains** — tag Property 4 (_Validates: 5.2, 5.3_)
    - **Property 5: `extractedAnyField` reflects extraction** — tag Property 5 (_Validates: 5.6_)
    - **Property 6: Link extraction is bounded, deduped, and order-preserving** — tag Property 6 (_Validates: 5.8_)
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 4. Implement the repository layer
  - [x] 4.1 Create repository row interfaces and mappers
    - Create `src/db/discordAlertsRepository.ts` importing the shared `supabase` client from `../lib/supabase` and `ParsedTradeAlert` from `../utils/parsers/discordAlertParser`
    - Define camelCase interfaces `DiscordAlertSource`, `DiscordTradeAlert`, `GroupedAlerts`; implement `fromSourceRow` and `fromAlertRow` (snake_case → camelCase, `links` as `string[]`), following `holdingsRepository.ts` conventions (resolve user via `supabase.auth.getUser()`, throw `'Not authenticated'` if missing)
    - _Requirements: 6.1_

  - [x] 4.2 Implement pure grouping and sorting helpers
    - In `src/db/discordAlertsRepository.ts` (or a small `src/db/discordAlertsHelpers.ts` module imported by it), implement pure `groupBySource(alerts, sources): GroupedAlerts[]` and `sortAlerts(alerts): DiscordTradeAlert[]` (submissionTimestamp descending, `id` as deterministic secondary key, idempotent)
    - _Requirements: 6.5, 7.1, 7.2, 7.3_

  - [x]* 4.3 Write property tests for grouping and sorting
    - Create `src/db/__tests__/discordAlertsHelpers.test.ts`
    - **Property 13: Grouping partitions alerts by source** — `// Feature: discord-trade-alerts, Property 13: Grouping partitions alerts by source` (_Validates: 6.5, 7.1_)
    - **Property 14: Sorting yields a descending permutation with a deterministic tie-break** — tag Property 14 (_Validates: 7.2, 7.3_)
    - _Requirements: 6.5, 7.1, 7.2, 7.3_

  - [x] 4.4 Implement source CRUD functions
    - Add `listSources`, `createSource(community, chatRoom)`, `updateSource(id, changes)`, `deleteSource(id)` (cascade removes alerts) to the repository, each throwing `new Error('Failed to ...: ' + error.message)` on Supabase error
    - _Requirements: 2.2, 2.4, 2.6, 2.7_

  - [x] 4.5 Implement alert query functions
    - Add `listAlertsBySource(sourceId)` (order by `submission_timestamp` desc, `id` secondary) and `listAlertsGrouped()` (returns `GroupedAlerts[]` via `groupBySource` + `sortAlerts`)
    - _Requirements: 6.5, 7.1, 7.2, 7.3_

  - [x] 4.6 Implement createAlert with retry, dedupe detection, and payload mapping
    - Add `createAlert(parsed, sourceId)`: build the insert row (always including `source_id`, `message_id`, `raw_content`, `submission_timestamp`, `action_type`, and the structured fields), wrap the insert in a `withRetry` helper (up to 3 attempts, not retrying unique violations per design), and detect the `(user_id, source_id, message_id)` unique violation to report `'duplicate'` instead of throwing
    - Add `deleteAlert(id)`
    - _Requirements: 2.4, 3.4, 6.1, 6.2, 6.3, 6.6, 6.7_

  - [x]* 4.7 Write property tests for insert payload and dedupe (mocked supabase)
    - Create `src/db/__tests__/discordAlertsRepository.test.ts` with a mocked `supabase` client
    - **Property 11: Insert payload is well-formed and always carries the source reference** — `// Feature: discord-trade-alerts, Property 11: ...` (_Validates: 2.4, 6.1_)
    - **Property 12: De-duplication persists at most one alert per (source, message id)** — tag Property 12 (_Validates: 3.4, 6.3_)
    - _Requirements: 2.4, 3.4, 6.1, 6.3_

  - [x]* 4.8 Write unit tests for repository CRUD and retry behavior
    - Extend `src/db/__tests__/discordAlertsRepository.test.ts` (mocked supabase): `listSources`/`createSource`/`updateSource`/`deleteSource`, `listAlertsGrouped`, `deleteAlert`, and `createAlert` retry-x3 (fail-twice-then-succeed = 3 attempts then success; always-fail = 3 attempts then recorded failure)
    - _Requirements: 2.2, 2.6, 2.7, 6.2, 6.5, 6.6_

- [x] 5. Checkpoint - Data, ingestion, and repository layers complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the Zustand store
  - [x] 6.1 Create store state and source/alert loading actions
    - Create `src/stores/discordAlertsStore.ts` following `portfolioStore.ts`: state `sources`, `grouped`, `currentSourceId`, `pendingReview`, `isLoading`; actions `loadSources`, `createSource`, `updateSource`, `deleteSource`, `selectSource`, `loadAlerts`, `deleteAlert`, routing errors to `useAppStore.getState().addToast(message, 'error')` and toggling `isLoading` in `finally`
    - On `loadAlerts` failure, set an error indication in state and keep nav selection intact
    - _Requirements: 1.5, 6.5, 6.6_

  - [x] 6.2 Implement pure validation and initial-build gate helpers
    - In the store module (or `src/stores/discordAlertsHelpers.ts`), implement pure `isValidSourceName(name): boolean` (trimmed length 1..100), `isDuplicateSource(candidate, existing): boolean` (case-insensitive, trim-insensitive), and `isPersistableInInitialBuild(parsed): boolean` (`actionType === 'Open'`)
    - _Requirements: 2.1, 2.3, 2.5, 4.4, 4.5_

  - [x]* 6.3 Write property tests for validation and initial-build gate
    - Create `src/stores/__tests__/discordAlertsHelpers.test.ts`
    - **Property 7: Source-name validation respects length bounds** — `// Feature: discord-trade-alerts, Property 7: ...` (_Validates: 2.1, 2.3_)
    - **Property 8: Duplicate-source detection is case-insensitive and trim-insensitive** — tag Property 8 (_Validates: 2.5_)
    - **Property 10: Initial-build gate persists only Open alerts** — tag Property 10 (_Validates: 4.4, 4.5_)
    - _Requirements: 2.1, 2.3, 2.5, 4.4, 4.5_

  - [x] 6.4 Implement submitAlert and confirmSaveAlert (parse-then-review)
    - Add `submitAlert(rawContent)`: run the selected source through `ManualPasteSource`, reject empty/whitespace-only with `{ status: 'invalid' }` (no persistence), cap at 10,000 chars, run `parseDiscordAlert`, set `pendingReview`, return `{ status: 'review' }` (synchronous, no I/O)
    - Add `confirmSaveAlert(edited)`: gate via `isPersistableInInitialBuild` (non-Open → `{ status: 'not-open' }`), else call `repo.createAlert`, refresh `grouped`, clear `pendingReview`, return `stored`/`duplicate`; clear `pendingReview` on cancel/source switch
    - _Requirements: 3.1, 3.3, 3.5, 4.4, 4.5_

  - [x]* 6.5 Write unit tests for store submission flow
    - Create `src/stores/__tests__/discordAlertsStore.test.ts`: `submitAlert` sets `pendingReview` and rejects empty/whitespace; `confirmSaveAlert` gates non-Open, persists Open, reports stored/duplicate/invalid/not-open; parse-then-review preserves edited fields while `messageId` stays fixed
    - _Requirements: 3.3, 3.5, 4.4, 4.5_

- [x] 7. Add routing and sidebar navigation
  - [x] 7.1 Register the lazy DiscordAlertsPage route
    - In `src/App.tsx`, add `const DiscordAlertsPage = lazyWithRetry(() => import('./pages/DiscordAlertsPage'));` and a protected child route `{ path: 'discord-alerts', element: <Suspense fallback={<LoadingFallback />}><DiscordAlertsPage /></Suspense> }` matching the existing pattern
    - _Requirements: 1.2, 1.4_

  - [x] 7.2 Add the sidebar nav item within the mobile-visible slice
    - In `src/components/layout/Sidebar.tsx`, add a `navItems` entry `{ to: '/discord-alerts', label: 'Alerts', icon: BellRing }` (import `BellRing` from `lucide-react`), inserted within `navItems.slice(0, 5)` (e.g. right after Journal) so it appears in the mobile bottom nav; active-state/single-selection comes from the existing `NavLink`/`linkClass` logic
    - _Requirements: 1.1, 1.3_

- [x] 8. Implement the UI components
  - [x] 8.1 Create AlertSourceManager
    - Create `src/components/discordAlerts/AlertSourceManager.tsx`: list/create/edit/delete sources with inline length validation (1..100 trimmed) and case-insensitive duplicate detection before calling the store; delete shows the associated alert count and a confirmation warning, retaining data until confirmed; use existing Tailwind theme tokens
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7_

  - [x]* 8.2 Write component tests for AlertSourceManager
    - Create `src/components/discordAlerts/__tests__/AlertSourceManager.test.tsx`: duplicate + length validation messages; delete-confirmation showing associated alert count and retaining data until confirm
    - _Requirements: 2.3, 2.5, 2.7_

  - [x] 8.3 Create AlertSubmissionForm (parse-then-review)
    - Create `src/components/discordAlerts/AlertSubmissionForm.tsx`: paste box → `submitAlert` → editable review form of parsed fields → `confirmSaveAlert`, surfacing the outcome (stored / duplicate / invalid / not-open) inline
    - _Requirements: 3.1, 3.3, 3.5, 4.4, 4.5, 5.1_

  - [x]* 8.4 Write component tests for AlertSubmissionForm
    - Create `src/components/discordAlerts/__tests__/AlertSubmissionForm.test.tsx`: empty submission validation, review form renders parsed fields, confirm persists edited values, non-Open outcome message
    - _Requirements: 3.3, 3.5, 4.5_

  - [x] 8.5 Create AlertViewer
    - Create `src/components/discordAlerts/AlertViewer.tsx`: alerts grouped by Community/Chat_Room with labels, reverse-chronological by `submissionTimestamp` (`id` secondary), each alert showing extracted fields (name + value), an Action_Type badge, a reveal control for full `rawContent`, links as navigable anchors, and an empty state when a source has no alerts
    - _Requirements: 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x]* 8.6 Write component tests for AlertViewer
    - Create `src/components/discordAlerts/__tests__/AlertViewer.test.tsx`: grouped rendering with labels, Action_Type badge, reveal-raw control, links as anchors, empty state
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7_

  - [x] 8.7 Create the DiscordAlertsPage container
    - Create `src/pages/DiscordAlertsPage.tsx`: on mount call `loadSources` + `loadAlerts`; render the source selector, `AlertSourceManager`, `AlertSubmissionForm`, and `AlertViewer` as the active content; show an error indication if `loadAlerts` fails while keeping nav selected
    - _Requirements: 1.2, 1.4, 1.5, 6.5_

  - [x]* 8.8 Write component tests for DiscordAlertsPage
    - Create `src/pages/__tests__/DiscordAlertsPage.test.tsx`: nav presence and active state, load-failure error indication retaining nav selection
    - _Requirements: 1.1, 1.3, 1.5_

- [x] 9. Final checkpoint - Integration, wiring, and verification
  - Run `npm run build` and `npm run test`; ensure the new suite is green and types compile
  - Confirm the migration `012_discord_trade_alerts.sql` number is still free (bump only if another migration landed first)
  - Note RLS cross-user scoping (a second authenticated user cannot read or delete the first user's `discord_alert_sources` / `discord_trade_alerts` rows) as an integration/manual verification item
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.4, 6.7_

## Notes

- Tasks marked with `*` are optional (test sub-tasks) and can be skipped for a faster MVP; core implementation tasks are never optional
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The parser POC (`src/utils/parsers/discordAlertParser.ts`, its fixtures, tests, and `scripts/discord-alert-poc.ts`) already exists and is reused as-is — no task rebuilds it; task 3.1 only adds the fast-check property tests (Properties 1-6) to the existing parser test file
- The migration is `012_discord_trade_alerts.sql` because `011_add_stock_transaction_support.sql` already exists
- Property-based tests use fast-check (each a single property, min 100 iterations, tagged with a `// Feature: discord-trade-alerts, Property N: <name>` comment); Properties 11-12 run against a mocked `supabase` client
- Tooling already present: Vitest, @testing-library/react, and fast-check
- RLS behavior (Requirements 6.4, 6.7) and the retry side-effect (6.2) are covered by integration/example tests rather than property tests, per the design

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "4.1", "4.2"] },
    { "id": 2, "tasks": ["2.3", "4.3", "4.4", "4.5", "4.6", "7.1", "7.2"] },
    { "id": 3, "tasks": ["4.7", "4.8", "6.1", "6.2"] },
    { "id": 4, "tasks": ["6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "8.1", "8.3", "8.5", "8.7"] },
    { "id": 6, "tasks": ["8.2", "8.4", "8.6", "8.8"] }
  ]
}
```
