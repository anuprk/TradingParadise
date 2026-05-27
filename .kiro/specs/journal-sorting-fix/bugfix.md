# Bugfix Requirements Document

## Introduction

The journal table's column sorting only applies to the currently visible page of records (20 entries) rather than sorting the entire dataset at the database level before paginating. When a user clicks a column header to sort (e.g., by P/L, symbol, or date), only the 20 records on the current page are reordered. Navigating to another page returns results in the default `open_date DESC` order, making the sort effectively useless for multi-page datasets.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks a column header to sort (e.g., P/L descending) THEN the system only reorders the 20 entries currently loaded on the visible page, not the full dataset

1.2 WHEN a user sorts by a column and then navigates to page 2 THEN the system fetches page 2 using the hardcoded `open_date DESC` order, ignoring the user's selected sort field and direction

1.3 WHEN a user changes the sort field or direction THEN the system does not re-fetch data from the database with the new sort applied; it only performs an in-memory sort of the current page's entries

### Expected Behavior (Correct)

2.1 WHEN a user clicks a column header to sort THEN the system SHALL query the database with the selected sort field and direction applied to the entire filtered dataset, and display the first page of those sorted results

2.2 WHEN a user sorts by a column and then navigates to page 2 THEN the system SHALL fetch page 2 using the user's selected sort field and direction, maintaining consistent sort order across all pages

2.3 WHEN a user changes the sort field or direction THEN the system SHALL reset to page 1 and re-fetch data from the database with the new sort criteria applied server-side before pagination

### Unchanged Behavior (Regression Prevention)

3.1 WHEN no sort column is explicitly selected by the user THEN the system SHALL CONTINUE TO default to sorting by `open_date` descending

3.2 WHEN filters are applied (strategy, status, date range, symbol, etc.) THEN the system SHALL CONTINUE TO apply those filters correctly alongside the sort order

3.3 WHEN a user changes filters THEN the system SHALL CONTINUE TO reset to page 1 and reload entries

3.4 WHEN entries are added, updated, or deleted THEN the system SHALL CONTINUE TO reload the current page with the active sort and filter criteria preserved

3.5 WHEN the sort indicator (▲/▼) is displayed on a column header THEN the system SHALL CONTINUE TO visually reflect the active sort field and direction

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SortAction { field: SortField, direction: SortDirection, totalRecords: number }
  OUTPUT: boolean
  
  // The bug triggers whenever sorting is applied to a dataset that spans multiple pages
  // (or any dataset, since the sort is always only in-memory on the current page)
  RETURN X.field IS NOT NULL AND X.direction IS NOT NULL
END FUNCTION
```

```pascal
// Property: Fix Checking — Sort applies globally before pagination
FOR ALL X WHERE isBugCondition(X) DO
  result ← fetchPage(page=1, sortField=X.field, sortDirection=X.direction)
  ASSERT result IS ordered by X.field in X.direction across ALL records (not just current page)
  ASSERT navigating to page N returns records consistent with global sort order
END FOR
```

```pascal
// Property: Preservation Checking — Default behavior unchanged
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // When no explicit sort action is taken, entries load in open_date DESC order
END FOR
```
