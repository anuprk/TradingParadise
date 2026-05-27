# Implementation Plan: Journal Sorting Fix (Page Size Increase)

## Overview

Increase the journal page size from 20 to 50 across three files to reduce the practical impact of client-side-only sorting. The fix is a constant change in `journalRepository.ts`, `journalStore.ts`, and `TradeJournal.tsx`. Property-based tests verify the new page size is applied consistently and that existing pagination/filter behavior is preserved.

## Tasks

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Page Size Is 20 (Too Small)
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the page size is 20 instead of 50
  - **Scoped PBT Approach**: Generate random page numbers and total counts, assert that offset = (page - 1) * 50 and totalPages = ceil(totalCount / 50)
  - Test that `filterJournalEntries` defaults to a limit of 50 (currently defaults to 20 — will fail)
  - Test that store methods (`loadEntries`, `setPage`) compute offset as `(page - 1) * 50` (currently uses 20 — will fail)
  - Test that `TradeJournal` computes `totalPages` as `Math.ceil(totalCount / 50)` (currently uses 20 — will fail)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the page size is still 20)
  - Document counterexamples found (e.g., "offset for page 2 is 20 instead of expected 50")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Pagination, Filtering, and CRUD Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: default sort order remains `open_date DESC` when no explicit sort is selected
  - Observe: filters (strategy, status, date range, symbol) continue to apply correctly alongside pagination
  - Observe: changing filters resets to page 1 and reloads entries
  - Observe: adding/updating/deleting entries reloads the current page with active filters preserved
  - Write property-based test: for all page/totalCount combinations, totalPages >= 1 and offset >= 0
  - Write property-based test: for all filter combinations, filter parameters are passed through to the repository unchanged
  - Verify tests pass on UNFIXED code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix page size from 20 to 50

  - [ ] 3.1 Update `src/db/journalRepository.ts`
    - Change default `limit` parameter in `filterJournalEntries` from `20` to `50`
    - _Bug_Condition: isBugCondition(input) where sortAction.field IS NOT NULL AND totalRecords > pageSize_
    - _Expected_Behavior: limit defaults to 50, fetching 50 records per page_
    - _Preservation: Query logic, filter application, and sort order unchanged_
    - _Requirements: 2.1, 3.1, 3.2_

  - [ ] 3.2 Update `src/stores/journalStore.ts`
    - Change offset calculations from `(page - 1) * 20` to `(page - 1) * 50` in all 5 methods: `loadEntries`, `addEntry`, `updateEntry`, `setFilters`, `setPage`
    - Change limit arguments from `20` to `50` in all 5 methods
    - _Bug_Condition: isBugCondition(input) where sortAction.field IS NOT NULL AND totalRecords > pageSize_
    - _Expected_Behavior: offset and limit use pageSize of 50_
    - _Preservation: Filter logic, CRUD reload behavior, and page reset on filter change unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.2, 3.3, 3.4_

  - [ ] 3.3 Update `src/components/journal/TradeJournal.tsx`
    - Change `Math.ceil(totalCount / 20)` to `Math.ceil(totalCount / 50)` in totalPages calculation
    - _Bug_Condition: isBugCondition(input) where sortAction.field IS NOT NULL AND totalRecords > pageSize_
    - _Expected_Behavior: totalPages = ceil(totalCount / 50)_
    - _Preservation: Sort indicators, pagination controls, and UI layout unchanged_
    - _Requirements: 2.1, 3.5_

  - [ ] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Page Size Is 50
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (page size of 50)
    - When this test passes, it confirms the page size has been updated correctly
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms fix is applied)
    - _Requirements: 2.1_

  - [ ] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Pagination, Filtering, and CRUD Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm no regressions
  - Verify page size of 50 is consistent across all three files
  - Ensure all tests pass, ask the user if questions arise

## Notes

- The fix is a constant change (20 → 50) in three files with no logic modifications
- Property-based tests use fast-check to generate random page/totalCount values for offset and totalPages assertions
- This is a workaround that reduces the impact of client-side sorting; a full server-side sort fix would be a separate effort

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["3.4", "3.5"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
