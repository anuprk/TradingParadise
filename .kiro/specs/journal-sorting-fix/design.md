# Journal Sorting Fix — Page Size Increase Design

## Overview

The journal table sorts only the current page of 20 records in-memory rather than sorting the full dataset server-side. As a quick workaround, we increase the page size from 20 to 50 rows per page. This reduces the practical impact of client-side-only sorting by showing more records at once, making the sort more useful without requiring server-side sorting changes.

## Glossary

- **Bug_Condition (C)**: The condition where sorting applies only to the visible page — any sort action on a paginated dataset with more than `PAGE_SIZE` records
- **Property (P)**: After the fix, each page displays 50 records instead of 20, reducing the number of pages and making client-side sort cover more data
- **Preservation**: Pagination, filtering, data loading, and all other journal functionality must continue working identically
- **PAGE_SIZE**: The hardcoded value `20` used across the journal store, repository, and UI component for pagination calculations
- **filterJournalEntries**: The function in `src/db/journalRepository.ts` that queries Supabase with offset/limit pagination

## Bug Details

### Bug Condition

The bug manifests when a user sorts a column and the dataset has more than 20 records. The sort only reorders the 20 records on the current page. By increasing the page size to 50, users see more records per page and the client-side sort covers a larger portion of their data.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sortAction: SortAction, totalRecords: number, pageSize: number }
  OUTPUT: boolean
  
  RETURN input.sortAction.field IS NOT NULL
         AND input.totalRecords > input.pageSize
         AND sort is applied only to current page (client-side)
END FUNCTION
```

### Examples

- User has 80 trades, sorts by P/L descending. With page size 20, they see only the top 20 of the first arbitrary page. With page size 50, they see 50 records sorted correctly on the visible page.
- User has 45 trades total. With page size 50, all trades fit on one page and client-side sort works perfectly across the full dataset.
- User has 120 trades. With page size 50, they have 3 pages instead of 6 — fewer page transitions where sort order breaks.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pagination controls must continue to work (next/previous page navigation)
- All filters (strategy, status, date range, symbol, option type, win/loss) must continue to apply correctly
- Adding, updating, and deleting entries must continue to reload the current page
- The default sort order (`open_date DESC`) from the database must remain unchanged
- Sort indicators (▲/▼) on column headers must continue to display correctly
- Stats, summary calculations, and performance banner must remain unaffected

**Scope:**
This fix changes only the number of records fetched per page. No query logic, sort behavior, filter behavior, or UI layout changes are needed.

## Hypothesized Root Cause

The page size of `20` is hardcoded in three locations:

1. **Repository default parameter**: `src/db/journalRepository.ts` — `filterJournalEntries(filters, offset = 0, limit = 20)` uses `20` as the default limit
2. **Store offset calculations**: `src/stores/journalStore.ts` — multiple methods compute `offset = (page - 1) * 20` and pass `20` as the limit
3. **UI page calculation**: `src/components/journal/TradeJournal.tsx` — `Math.ceil(totalCount / 20)` computes total pages

All three must be updated to `50` for consistency.

## Correctness Properties

Property 1: Bug Condition - Page Size Increased to 50

_For any_ journal data fetch (load, filter change, page navigation, add/update/delete reload), the system SHALL request 50 records per page from the database and compute pagination based on a page size of 50.

**Validates: Requirements 2.1**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ operation that does not involve the page size value (filtering, sorting UI, entry CRUD, stats loading, default sort order), the system SHALL produce the same behavior as before the change, preserving all existing journal functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `src/db/journalRepository.ts`

**Function**: `filterJournalEntries`

**Specific Changes**:
1. **Default limit parameter**: Change `limit = 20` to `limit = 50` in the function signature

---

**File**: `src/stores/journalStore.ts`

**Functions**: `loadEntries`, `addEntry`, `updateEntry`, `setFilters`, `setPage`

**Specific Changes**:
1. **loadEntries**: Change `(currentPage - 1) * 20` to `(currentPage - 1) * 50` and the limit argument from `20` to `50`
2. **addEntry**: Change `(currentPage - 1) * 20` to `(currentPage - 1) * 50` and the limit argument from `20` to `50`
3. **updateEntry**: Change `(currentPage - 1) * 20` to `(currentPage - 1) * 50` and the limit argument from `20` to `50`
4. **setFilters**: Change the limit argument from `20` to `50`
5. **setPage**: Change `(page - 1) * 20` to `(page - 1) * 50` and the limit argument from `20` to `50`

---

**File**: `src/components/journal/TradeJournal.tsx`

**Line**: `const totalPages = Math.max(1, Math.ceil(totalCount / 20));`

**Specific Changes**:
1. **Page calculation**: Change `totalCount / 20` to `totalCount / 50`

## Testing Strategy

### Validation Approach

This is a constant-value change. Testing focuses on verifying the new page size is applied consistently and that no functionality regresses.

### Exploratory Bug Condition Checking

**Goal**: Confirm the current page size is 20 and that sorting only applies to those 20 records.

**Test Cases**:
1. **Verify current limit**: Load journal with >20 entries, confirm only 20 appear per page (will show the bug on unfixed code)
2. **Sort scope**: Sort by P/L, confirm only the visible 20 records reorder (will show the bug on unfixed code)

**Expected Counterexamples**:
- Page shows only 20 records even when 50+ exist
- Sorting reorders only the visible 20, not the full dataset

### Fix Checking

**Goal**: Verify that after the fix, 50 records load per page.

**Pseudocode:**
```
FOR ALL pageLoad WHERE totalRecords > 0 DO
  result := filterJournalEntries(filters, offset, limit)
  ASSERT result.entries.length <= 50
  ASSERT offset calculation uses pageSize of 50
  ASSERT totalPages = ceil(totalCount / 50)
END FOR
```

### Preservation Checking

**Goal**: Verify that filtering, CRUD operations, stats, and navigation continue to work.

**Pseudocode:**
```
FOR ALL operation WHERE operation IS NOT page-size-related DO
  ASSERT behavior_before = behavior_after
END FOR
```

**Testing Approach**: Manual verification and existing test suite. The change is a single constant so property-based testing adds limited value here.

**Test Cases**:
1. **Filter preservation**: Apply filters (status, symbol, date range), confirm results are correct
2. **CRUD preservation**: Add, edit, and delete entries, confirm page reloads correctly
3. **Navigation preservation**: Navigate between pages, confirm offset calculations are correct with new page size
4. **Stats preservation**: Confirm performance banner and yearly P/L remain accurate

### Unit Tests

- Verify `filterJournalEntries` defaults to limit of 50
- Verify store offset calculations use 50
- Verify `totalPages` computation uses 50

### Property-Based Tests

- Generate random `totalCount` values and verify `totalPages = ceil(totalCount / 50)`
- Generate random page numbers and verify offset = `(page - 1) * 50`

### Integration Tests

- Load journal with 60+ entries, confirm first page shows 50
- Navigate to page 2, confirm remaining entries appear
- Apply filter that reduces results to <50, confirm single page with all results
