---
inclusion: always
---

# Table Conventions (TradingParadise)

These rules apply to every data table in the app. Follow them whenever adding or modifying a table.

## Sortability (required)

- Every data table MUST be sortable by clicking its column headers — this includes matrix/pivot tables such as campaign×month and symbol×month, not just row-per-record tables.
- Do NOT ship a table with static, non-clickable headers to "keep the change small."
- Reuse the existing patterns rather than inventing new ones:
  - Row-based tables: use the `useTableSort` hook (see `src/hooks/useTableSort.ts`; examples: Strategy Performance and Campaign Performance tables in `src/pages/DashboardPage.tsx`).
  - Month-matrix tables: use the `incomeSort` pattern — a `useState` of `{ key: <labelKey> | 'total' | number /* month index 0-11 */; dir: 'asc' | 'desc' }`, a handler that toggles direction on the same key (defaulting label columns to `'asc'` and numeric/month/total columns to `'desc'`), a memoized sorted copy of the data, and a small arrow helper returning `' ▲'` / `' ▼'` for the active column. Examples: "Income by Symbol" and "Campaign Monthly Performance" tables in `src/pages/DashboardPage.tsx`.
- Sortable header cells MUST include `cursor-pointer select-none hover:text-text-primary` and render a sort-arrow indicator next to the label.

## Formatting & color coding

- Profit/Loss and credit/debit values are color-coded: non-negative → `text-success` (green), negative → `text-error` (red). Neutral/zero can use `text-text-primary`.
- Format currency/P-L via the shared helpers in `src/utils/formatters.ts` (`formatCurrency`, `formatProfitLoss`).
- Editable trade-like tables use typed inputs (`type="date"`, `type="number"`) and match the inline-edit + debounced-save pattern in `src/components/portfolio/HoldingsTab.tsx` / `TransactionsTab.tsx`.

## Structure

- Wrap tables in `overflow-x-auto`. For wide matrix tables, keep the first column sticky (`sticky left-0 bg-surface-secondary z-10`) and provide a totals row/column where meaningful.
- Use the app's theme tokens (`text-text-primary`, `text-text-secondary`, `bg-surface-secondary`, `bg-surface-tertiary`, `border-border`, `text-text-accent`, `text-success`, `text-error`).
