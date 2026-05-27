# Bugfix Requirements Document

## Introduction

The portfolio transactions table sorting only applies to the current page of records rather than sorting the entire dataset at the database level before paginating. When a user clicks a column header to sort (e.g., by amount, symbol, or date), only the records fetched for the current page are reordered in memory. Navigating to another page returns results in the default `transaction_date DESC` order, making the sort useless for multi-page datasets.

The root cause: `transactionStore.ts` calls `getTransactionsByPortfolioFiltered` which always orders by `transaction_date DESC` at the DB level, then applies `sortTransactionsLocal` only to the returned page. The sort column and direction selected by the user are never passed to the repository query.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks a column header to sort portfolio transactions (e.g., amount descending) THEN the system only reorders the records currently loaded on the visible page via in-memory sort, not the full dataset

1.2 WHEN a user sorts by a column and then navigates to page 2 THEN the system fetches page 2 using the hardcoded `transaction_date DESC` order, ignoring the user's selected sort field and direction

1.3 WHEN a user changes the sort field or direction THEN the system does not pass the sort criteria to the database query; it only performs an in-memory sort of the current page's records via `sortTransactionsLocal`

### Expected Behavior (Correct)

2.1 WHEN a user clicks a column header to sort portfolio transactions THEN the system SHALL pass the selected sort field and direction to the database query, applying the sort to the entire filtered dataset before pagination, and display the first page of those sorted results

2.2 WHEN a user sorts by a column and then navigates to page 2 THEN the system SHALL fetch page 2 using the user's selected sort field and direction at the database level, maintaining consistent sort order across all pages

2.3 WHEN a user changes the sort field or direction THEN the system SHALL reset to page 1 and re-fetch data from the database with the new sort criteria applied server-side before pagination

### Unchanged Behavior (Regression Prevention)

3.1 WHEN no sort column is explicitly selected by the user THEN the system SHALL CONTINUE TO default to sorting by `transaction_date` descending

3.2 WHEN filters are applied (symbol, date range, transaction type, asset type) THEN the system SHALL CONTINUE TO apply those filters correctly alongside the sort order

3.3 WHEN a user changes filters THEN the system SHALL CONTINUE TO reset to page 1 and reload entries

3.4 WHEN transactions are added, updated, or deleted THEN the system SHALL CONTINUE TO reload the current page with the active sort and filter criteria preserved

3.5 WHEN the sort indicator (▲/▼) is displayed on a column header THEN the system SHALL CONTINUE TO visually reflect the active sort field and direction

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SortAction { field: SortField, direction: SortDirection, totalRecords: number }
  OUTPUT: boolean
  
  // The bug triggers whenever sorting is applied, because the sort is always
  // only in-memory on the current page rather than at the DB level
  RETURN X.field IS NOT NULL AND X.direction IS NOT NULL
END FUNCTION
```

```pascal
// Property: Fix Checking — Sort applies at DB level before pagination
FOR ALL X WHERE isBugCondition(X) DO
  result ← getTransactionsByPortfolioFiltered(portfolioId, filters, offset, limit, X.field, X.direction)
  ASSERT result IS ordered by X.field in X.direction across ALL records (not just current page)
  ASSERT navigating to page N returns records consistent with global sort order
END FOR
```

```pascal
// Property: Preservation Checking — Default behavior unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // When no explicit sort action is taken, transactions load in transaction_date DESC order
END FOR
```
