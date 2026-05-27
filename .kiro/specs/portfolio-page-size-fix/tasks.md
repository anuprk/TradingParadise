# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Page Size Below 50
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples where PAGE_SIZE is not 50 in any of the three locations
  - **Scoped PBT Approach**: For each of the three files, assert the page size constant/default equals 50
  - Write a property-based test that verifies: for any page load operation, the limit passed to the DB is 50, the offset calculation uses 50, and the UI pagination divides by 50
  - Test file: `src/__tests__/portfolioPageSize.property.test.ts`
  - Assert `PAGE_SIZE === 50` in `transactionStore.ts`
  - Assert default `limit` parameter is `50` in `getTransactionsByPortfolioFiltered`
  - Assert `PAGE_SIZE === 50` in `TransactionsTab.tsx`
  - Assert for random `totalCount` values: `totalPages === Math.ceil(totalCount / 50)`
  - Assert for random page numbers: `offset === (page - 1) * 50`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS if any location still uses 20 (confirms the bug exists); test PASSES if all locations already use 50 (bug was already fixed by prior journal fix)
  - Document findings: which files have value 20 vs 50
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Pagination and Filter Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: filters (symbol, date range, transaction type, asset type) continue to narrow results correctly
  - Observe on UNFIXED code: default sort order is `transaction_date DESC` when no sort column is selected
  - Observe on UNFIXED code: page navigation calculates offset correctly as `(page - 1) * PAGE_SIZE`
  - Write property-based test: for all valid page numbers and totalCount values, pagination math produces correct totalPages and offset
  - Write property-based test: for all filter combinations, the query includes the correct filter predicates
  - Test file: `src/__tests__/portfolioPageSize.preservation.test.ts`
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix for portfolio page size consistency

  - [ ] 3.1 Verify and update PAGE_SIZE values to 50
    - Check `src/stores/transactionStore.ts` — if `PAGE_SIZE` is not 50, change it to 50
    - Check `src/db/transactionRepository.ts` — if default `limit` parameter is not 50, change it to 50
    - Check `src/components/portfolio/TransactionsTab.tsx` — if `PAGE_SIZE` is not 50, change it to 50
    - Note: these may already be 50 from a prior fix; verify and update only if needed
    - _Bug_Condition: isBugCondition(input) where totalRecords > pageSize AND pageSize < 50_
    - _Expected_Behavior: all three locations use PAGE_SIZE = 50 consistently_
    - _Preservation: pagination, filtering, CRUD reload, default sort order, sort indicators unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Page Size Is 50
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 asserts PAGE_SIZE === 50 in all locations
    - When this test passes, it confirms the page size is consistently 50
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms fix is applied)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Pagination and Filter Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm pagination math, filter behavior, and default sort order are unchanged

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
