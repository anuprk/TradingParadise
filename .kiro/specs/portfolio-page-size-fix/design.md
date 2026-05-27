# Portfolio Page Size Fix — Bugfix Design

## Overview

The portfolio transactions table sorts only the current page of records in-memory rather than sorting the full dataset server-side. As a quick workaround (matching the journal fix), we increase the page size from 20 to 50 rows per page. This reduces the practical impact of client-side-only sorting by showing more records at once, making the sort more useful without requiring server-side sorting changes.

## Glossary

- **Bug_Condition (C)**: The condition where sorting applies only to the visible page — any sort action on a paginated dataset with more than `PAGE_SIZE` records
- **Property (P)**: After the fix, each page displays 50 records instead of 20, reducing the number of pages and making client-side sort cover more data
- **Preservation**: Pagination, filtering, data loading, holdings computation, and all other portfolio functionality must continue working identically
- **PAGE_SIZE**: The constant controlling how many transaction rows are fetched per page and used for pagination math
- **getTransactionsByPortfolioFiltered**: The function in `src/db/transactionRepository.ts` that queries Supabase with offset/limit pagination
- **sortTransactionsLocal**: The function in `src/stores/transactionStore.ts` that sorts the fetched page in memory

## Bug Details

### Bug Condition

The bug manifests when a user sorts a column and the dataset has more than the page size number of records. The `loadTransactions` method fetches a page of records from the database (always ordered by `transaction_date DESC`), then applies `sortTransactionsLocal` only to that page. By increasing the page size to 50, users see more records per page and the client-side sort covers a larger portion of their data.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sortAction: SortAction, totalRecords: number, pageSize: number }
  OUTPUT: boolean
  
  RETURN input.sortAction.field IS NOT NULL
         AND input.totalRecords > input.pageSize
         AND sort is applied only to current page (client-side via sortTransactionsLocal)
END FUNCTION
```

### Examples

- User has 80 transactions, sorts by amount descending. With page size 20, they see only 20 records sorted on the visible page. With page size 50, they see 50 records sorted correctly.
- User has 45 transactions total. With page size 50, all transactions fit on one page and client-side sort works perfectly across the full dataset.
- User has 150 transactions. With page size 50, they have 3 pages instead of 8 — fewer page transitions where sort order breaks.
- User has 10 transactions. Page size is irrelevant — all records fit on one page regardless.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pagination controls (Previous/Next) must continue to work correctly
- All filters (symbol, date range, transaction type, asset type) must continue to apply correctly
- Adding, updating, and deleting transactions must continue to reload the current page
- The default sort order (`transaction_date DESC`) from the database must remain unchanged
- Sort indicators (▲/▼) on column headers must continue to display correctly
- Holdings computation and performance summary must remain unaffected
- The `sortTransactionsLocal` function behavior must remain unchanged

**Scope:**
This fix changes only the number of records fetched per page. No query logic, sort behavior, filter behavior, or UI layout changes are needed.

## Hypothesized Root Cause

The page size value controls how many records are fetched and displayed. If set to 20, the in-memory sort only covers 20 records per page. The value appears in up to three locations:

1. **Store constant**: `src/stores/transactionStore.ts` — `const PAGE_SIZE = 50` used for offset calculation in `loadTransactions`
2. **Repository default parameter**: `src/db/transactionRepository.ts` — `getTransactionsByPortfolioFiltered(..., limit = 50)` default limit
3. **UI page calculation**: `src/components/portfolio/TransactionsTab.tsx` — `const PAGE_SIZE = 50` used in `Math.ceil(totalCount / PAGE_SIZE)`

All three must use the value `50` for consistency.

## Correctness Properties

Property 1: Bug Condition - Page Size Set to 50

_For any_ portfolio transaction data fetch (load, filter change, page navigation, add/update/delete reload), the system SHALL request 50 records per page from the database and compute pagination based on a page size of 50.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Existing Functionality Unchanged

_For any_ operation that does not involve the page size value (filtering, sorting UI, transaction CRUD, holdings computation, performance summary, default sort order), the system SHALL produce the same behavior as before the change, preserving all existing portfolio functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming the page size was previously 20 in any of these locations:

**File**: `src/stores/transactionStore.ts`

**Constant**: `PAGE_SIZE`

**Specific Changes**:
1. **PAGE_SIZE constant**: Ensure `const PAGE_SIZE = 50` (change from 20 if it was 20)

---

**File**: `src/db/transactionRepository.ts`

**Function**: `getTransactionsByPortfolioFiltered`

**Specific Changes**:
1. **Default limit parameter**: Ensure `limit = 50` in the function signature (change from 20 if it was 20)

---

**File**: `src/components/portfolio/TransactionsTab.tsx`

**Constant**: `PAGE_SIZE`

**Specific Changes**:
1. **PAGE_SIZE constant**: Ensure `const PAGE_SIZE = 50` (change from 20 if it was 20)

## Testing Strategy

### Validation Approach

This is a constant-value change. Testing focuses on verifying the page size is 50 consistently across all three locations and that no functionality regresses.

### Exploratory Bug Condition Checking

**Goal**: Confirm the page size is 20 (pre-fix) and that sorting only applies to those records.

**Test Cases**:
1. **Verify current limit**: Load portfolio with >20 transactions, confirm only 20 appear per page (will show the bug on unfixed code)
2. **Sort scope**: Sort by amount, confirm only the visible records reorder (will show the bug on unfixed code)

**Expected Counterexamples**:
- Page shows only 20 records even when 50+ exist
- Sorting reorders only the visible 20, not the full dataset

### Fix Checking

**Goal**: Verify that after the fix, 50 records load per page.

**Pseudocode:**
```
FOR ALL pageLoad WHERE totalRecords > 0 DO
  result := getTransactionsByPortfolioFiltered(portfolioId, filters, offset, limit)
  ASSERT result.length <= 50
  ASSERT offset calculation uses pageSize of 50
  ASSERT totalPages = ceil(totalCount / 50)
END FOR
```

### Preservation Checking

**Goal**: Verify that filtering, CRUD operations, holdings, and navigation continue to work.

**Pseudocode:**
```
FOR ALL operation WHERE operation IS NOT page-size-related DO
  ASSERT behavior_before = behavior_after
END FOR
```

**Testing Approach**: Manual verification and existing test suite. The change is a single constant so property-based testing adds limited value here.

**Test Cases**:
1. **Filter preservation**: Apply filters (symbol, date range, transaction type), confirm results are correct
2. **CRUD preservation**: Add, edit, and delete transactions, confirm page reloads correctly
3. **Navigation preservation**: Navigate between pages, confirm offset calculations are correct with page size 50
4. **Holdings preservation**: Confirm holdings tab and performance summary remain accurate

### Unit Tests

- Verify `getTransactionsByPortfolioFiltered` defaults to limit of 50
- Verify store offset calculations use PAGE_SIZE of 50
- Verify `TransactionsTab` totalPages computation uses PAGE_SIZE of 50

### Property-Based Tests

- Generate random `totalCount` values and verify `totalPages = ceil(totalCount / 50)`
- Generate random page numbers and verify offset = `(page - 1) * 50`

### Integration Tests

- Load portfolio with 60+ transactions, confirm first page shows 50
- Navigate to page 2, confirm remaining transactions appear
- Apply filter that reduces results to <50, confirm single page with all results
