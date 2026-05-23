# Implementation Plan: Portfolio Management

## Overview

This plan implements multi-portfolio transaction tracking with brokerage statement import (PDF and CSV), fingerprint-based de-duplication, holdings computation, and performance metrics. The implementation builds on the existing Dexie/IndexedDB data layer, Zustand stores, and React component patterns. Key additions: a new `portfolioTransactions` Dexie table, a `transactionStore` (Zustand), a client-side PDF parsing pipeline (pdfjs-dist), strategy-pattern parsers (Tastytrade, Fidelity, CSV), and a dashboard with Holdings/Transactions tabs plus performance summary.

## Tasks

- [x] 1. Define transaction types, database schema, and repository
  - [x] 1.1 Create PortfolioTransaction type definitions and related types
    - Create `src/types/transaction.ts` with `PortfolioTransaction`, `TransactionType`, `AssetType`, `TransactionSource`, `ParseResult`, `ParseError`, `DuplicateReport`, `DuplicateEntry`, `TransactionFingerprint`, `Holding`, `PerformanceSummaryData`, `TransactionFilterState`, and `StatementParser` interfaces
    - Export all types for use across the codebase
    - _Requirements: 1.1, 4.1, 6.2, 7.5, 8.2_

  - [x] 1.2 Add portfolioTransactions table to Dexie schema
    - Update `src/db/database.ts` to add a new version with `portfolioTransactions` table indexed on `id, portfolioId, planId, transactionDate, symbol, transactionType, assetType, source`
    - Import the `PortfolioTransaction` type and add the table declaration to the DB class
    - _Requirements: 1.1, 7.1_

  - [x] 1.3 Create transactionRepository with CRUD operations
    - Create `src/db/transactionRepository.ts` with functions: `addTransaction`, `bulkAddTransactions`, `getTransactionsByPortfolio`, `getTransactionsByPortfolioFiltered`, `deleteTransactionsByPortfolio`, `countTransactionsByPortfolio`
    - Implement pagination support (offset/limit) in the filtered query
    - _Requirements: 1.5, 5.6, 7.1, 7.6_

  - [x] 1.4 Update portfolioRepository to cascade-delete transactions on portfolio delete
    - Modify `src/db/portfolioRepository.ts` `deletePortfolio` function to also call `deleteTransactionsByPortfolio` before removing the portfolio record
    - _Requirements: 1.5_

- [x] 2. Implement transaction fingerprint and de-duplication engine
  - [x] 2.1 Implement computeFingerprint utility function
    - Create `src/utils/fingerprint.ts` with `computeFingerprint(txn: PortfolioTransaction): string`
    - Format: `"YYYY-MM-DD|SYMBOL|TYPE|OPTION_TYPE|STRIKE(2dp)|PRICE(2dp)|QTY(4dp)"`
    - Normalize symbol to uppercase/trimmed, default optionType to 'None', default strikePrice to 0.00
    - _Requirements: 4.1, 4.6, 4.7_

  - [x] 2.2 Write property test for fingerprint determinism and field sensitivity
    - **Property 3: Transaction fingerprint determinism and field sensitivity**
    - **Validates: Requirements 4.1, 4.6, 4.7**

  - [x] 2.3 Implement de-duplication engine
    - Create `src/utils/deduplication.ts` with `findDuplicates(newTransactions, existingTransactions): DuplicateReport`
    - Build fingerprint set from existing transactions, compare each new transaction's fingerprint
    - Return `DuplicateReport` with `duplicates` and `unique` arrays
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 2.4 Write property test for duplicate detection correctness
    - **Property 4: Duplicate detection excludes transactions with matching fingerprints**
    - **Validates: Requirements 4.2, 5.6**

- [x] 3. Implement transactionStore (Zustand)
  - [x] 3.1 Create transactionStore with state management
    - Create `src/stores/transactionStore.ts` with Zustand store
    - State: `transactions`, `holdings`, `performanceSummary`, `filters`, `sortColumn`, `sortDirection`, `currentPage`, `totalCount`, `isLoading`
    - Actions: `loadTransactions`, `addTransactions`, `deleteTransactionsByPortfolio`, `setFilters`, `setSort`, `setPage`, `computeHoldings`, `computePerformance`
    - Follow existing store patterns (see `portfolioStore.ts`)
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 8.3_

- [x] 4. Implement holdings computation and performance metrics
  - [x] 4.1 Implement holdings computation utility
    - Create `src/utils/holdings.ts` with `computeHoldings(transactions: PortfolioTransaction[]): Holding[]`
    - Filter Buy/Sell transactions, group by composite key (symbol, assetType, optionType, strikePrice, expirationDate)
    - Compute netQuantity, averageCostBasis (weighted average), totalCostBasis, currentValue, unrealizedPL
    - Exclude groups with netQuantity === 0, sort by symbol ascending
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 4.2 Write property test for holdings computation
    - **Property 7: Holdings computation produces correct aggregation**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x] 4.3 Implement performance metrics computation utility
    - Create `src/utils/metrics.ts` with `computePerformanceSummary(transactions: PortfolioTransaction[], initialBalance: number): PerformanceSummaryData`
    - Compute totalRealizedPL from matching Buy/Sell pairs, totalUnrealizedPL from open holdings
    - Compute totalPortfolioValue, overallReturnPercentage, winRate, totalTransactions
    - Handle edge cases: zero initial balance (return 0%), no transactions (all zeros)
    - _Requirements: 8.2, 8.5_

  - [x] 4.4 Write property test for performance metrics computation
    - **Property 10: Performance metrics computation correctness**
    - **Validates: Requirements 8.2**

- [x] 5. Implement transaction filtering and sorting utilities
  - [x] 5.1 Implement transaction filter and sort logic
    - Create `src/utils/transactionFilters.ts` with `filterTransactions(transactions, filters: TransactionFilterState): PortfolioTransaction[]` and `sortTransactions(transactions, column, direction): PortfolioTransaction[]`
    - Filter by symbol (case-insensitive contains), dateFrom/dateTo range, transactionType, assetType
    - Sort by any column in ascending or descending order
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 5.2 Write property test for transaction filtering
    - **Property 8: Transaction filtering returns only matching entries**
    - **Validates: Requirements 7.5**

  - [x] 5.3 Write property test for transaction sorting
    - **Property 9: Transaction sorting produces correct order**
    - **Validates: Requirements 7.3, 7.4**

- [x] 6. Checkpoint - Core data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement CSV parser
  - [x] 7.1 Implement CSV parser using strategy pattern
    - Create `src/utils/parsers/csvParser.ts` implementing `StatementParser` interface
    - Use existing `papaparse` dependency for CSV parsing
    - Map columns per design: Stock Symbol, Open Date, Expiration Date, Option Type, Direction, Stock Price DOC, Strike Price, Premium, Contracts, Fees, Exit Price, Close Date, Profit/Loss, etc.
    - Require at minimum Stock Symbol and Open Date columns
    - Skip rows with empty symbol or unparseable date, add to errors with row number and reason
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 7.2 Write property test for CSV parsing valid rows
    - **Property 5: CSV parsing extracts all valid rows with correct field mapping**
    - **Validates: Requirements 3.3, 3.4**

  - [x] 7.3 Write property test for CSV parser error reporting
    - **Property 6: CSV parser skips invalid rows with error reporting**
    - **Validates: Requirements 3.7**

- [x] 8. Implement PDF parsers (Tastytrade and Fidelity)
  - [x] 8.1 Install pdfjs-dist and configure for Vite
    - Add `pdfjs-dist` as a dependency
    - Configure the PDF.js worker for Vite bundling (copy worker to public or use CDN worker URL)
    - Create `src/utils/parsers/pdfUtils.ts` with helper to extract text from PDF ArrayBuffer using pdfjs-dist
    - _Requirements: 2.1_

  - [x] 8.2 Implement format detector
    - Create `src/utils/parsers/formatDetector.ts` with `detectFormat(file: File): Promise<'tastytrade_pdf' | 'fidelity_pdf' | 'csv' | 'unknown'>`
    - Check file extension first (.pdf vs .csv)
    - For PDFs: extract first page text, scan for format-specific markers (tastytrade: "tastytrade"/"Account Activity"/"Transaction History"; Fidelity: "Fidelity"/"Transaction Detail")
    - _Requirements: 2.2, 2.3_

  - [x] 8.3 Write property test for format detection
    - **Property 13: Format detection correctness**
    - **Validates: Requirements 2.2**

  - [x] 8.4 Implement Tastytrade PDF parser
    - Create `src/utils/parsers/tastytradeParser.ts` implementing `StatementParser` interface
    - Extract text via pdfjs-dist, locate "Account Activity" or "Transaction History" section
    - Parse transaction rows: date, description, quantity, price, fees, amount
    - Parse options descriptions (e.g., "AAPL 03/15/24 P170") to extract symbol, expiration, strike, type
    - Skip subtotals, page headers/footers, blank lines
    - Map to PortfolioTransaction with source: 'tastytrade_pdf'
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 8.5 Write property test for Tastytrade parser round-trip
    - **Property 11: Tastytrade parser round-trip consistency**
    - **Validates: Requirements 9.8**

  - [x] 8.6 Implement Fidelity PDF parser
    - Create `src/utils/parsers/fidelityParser.ts` implementing `StatementParser` interface
    - Extract text via pdfjs-dist, locate "Transaction Detail" section
    - Parse rows: date (MM/DD/YYYY), action ("YOU BOUGHT"/"YOU SOLD"/"REINVESTMENT"/"DIVIDEND"), symbol, description, quantity, price, amount, fees
    - Map action to transactionType, extract option details from description
    - Map to PortfolioTransaction with source: 'fidelity_pdf'
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 8.7 Write property test for Fidelity parser round-trip
    - **Property 12: Fidelity parser round-trip consistency**
    - **Validates: Requirements 10.6**

  - [x] 8.8 Create parser registry and detectAndParse orchestrator
    - Create `src/utils/parsers/index.ts` that exports `detectAndParse(file: File, portfolioId: string, planId: string): Promise<ParseResult>`
    - Register all parsers in order: TastytradeParser, FidelityParser, CsvParser
    - Validate file size (≤10MB) and extension (.pdf or .csv) before parsing
    - _Requirements: 2.1, 2.2, 2.6, 3.1, 3.2_

- [x] 9. Checkpoint - Import pipeline logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement ImportPanel UI component
  - [x] 10.1 Create FileUpload component
    - Create `src/components/portfolio/ImportPanel/FileUpload.tsx`
    - Accept PDF and CSV files via file input or drag-and-drop
    - Validate file extension and size (≤10MB) before processing
    - Display error messages for invalid files
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 10.2 Create ImportPreview component with stats, duplicates list, and preview table
    - Create `src/components/portfolio/ImportPanel/ImportPreview.tsx`
    - Display total transactions, duplicate count, error count
    - Show paginated preview table (max 50 rows) with date, symbol, type, quantity, price, fees
    - Visually distinguish duplicates and error rows
    - Allow user to override individual duplicate detections (checkbox to include)
    - _Requirements: 4.3, 4.5, 5.1, 5.2, 5.3_

  - [x] 10.3 Create ImportPanel container with full import flow
    - Create `src/components/portfolio/ImportPanel/ImportPanel.tsx`
    - Orchestrate: file upload → format detection → parsing → de-duplication → preview → confirm/cancel
    - On confirm: save non-duplicate transactions via transactionStore, show success message with count
    - On cancel: discard parsed data, return to upload screen
    - Handle partial save failures with error message showing saved count
    - _Requirements: 2.7, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 11. Implement Portfolio Dashboard UI components
  - [x] 11.1 Create PerformanceSummary component
    - Create `src/components/portfolio/PerformanceSummary.tsx`
    - Display metrics cards: total portfolio value, realized P/L, unrealized P/L, overall return %, win rate
    - Color-code P/L values: green for positive, red for negative, neutral for zero
    - Show $0.00 / 0.0% when no transactions exist
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 11.2 Create HoldingsTab component
    - Create `src/components/portfolio/HoldingsTab.tsx`
    - Display holdings table: symbol, quantity, average cost basis, current value, unrealized P/L
    - Sort by symbol ascending
    - Show empty state message when no open positions exist
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 11.3 Create TransactionsTab component with filters, sorting, and pagination
    - Create `src/components/portfolio/TransactionsTab.tsx`
    - Display transactions table: date, symbol, option type, direction, strike, premium, fees, P/L, status
    - Default sort by date descending; allow sorting by any column
    - Filter controls: symbol text input, date range, transaction type dropdown, asset type dropdown
    - Pagination: 50 records per page with navigation controls
    - Show empty state when no transactions match
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 11.4 Create TabNavigation component with keyboard accessibility
    - Create `src/components/portfolio/TabNavigation.tsx`
    - Two tabs: "Holdings" and "Transactions"
    - Visually distinguish active tab (border/background/font weight)
    - Support keyboard navigation: Tab to focus, Enter/Space to activate
    - Default to Holdings tab on initial load
    - Preserve active tab when metrics update
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 11.5 Update PortfolioDashboard page to wire all components together
    - Update `src/pages/PortfolioDashboardPage.tsx` to compose: PerformanceSummary + TabNavigation + HoldingsTab/TransactionsTab + ImportPanel
    - Load transactions on mount via transactionStore
    - Compute holdings and performance on transaction changes
    - Handle "portfolio not found" with error message and link back to list
    - _Requirements: 8.1, 8.3, 11.1, 11.4_

- [x] 12. Implement portfolio validation schema
  - [x] 12.1 Update portfolio validation schema for transaction-aware rules
    - Update `src/schemas/portfolioSchema.ts` to ensure name validation (1-100 chars, not whitespace-only), description (≤500 chars), initial balance (0.00 to 999,999,999.99), and unique name within plan
    - _Requirements: 1.1, 1.6, 1.7_

  - [x] 12.2 Write property test for portfolio validation
    - **Property 1: Portfolio validation accepts valid inputs and rejects invalid inputs**
    - **Validates: Requirements 1.1, 1.6**

- [x] 13. Implement cascade delete integration
  - [x] 13.1 Wire cascade delete in portfolioStore and verify integration
    - Update `src/stores/portfolioStore.ts` `deletePortfolio` action to also clear transactions from transactionStore state when the deleted portfolio is currently selected
    - Ensure the repository-level cascade (task 1.4) is called correctly
    - _Requirements: 1.5_

  - [x] 13.2 Write property test for cascading portfolio delete
    - **Property 2: Cascading portfolio delete removes all associated transactions**
    - **Validates: Requirements 1.5**

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project already has `fast-check`, `papaparse`, `vitest`, and `@testing-library/react` installed
- `pdfjs-dist` is the only new dependency required (task 8.1)
- All parsers follow the `StatementParser` strategy interface for consistency and extensibility

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "12.1"] },
    { "id": 2, "tasks": ["1.4", "2.2", "2.3", "3.1", "12.2"] },
    { "id": 3, "tasks": ["2.4", "4.1", "4.3", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.4", "5.2", "5.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.4", "8.6"] },
    { "id": 7, "tasks": ["8.3", "8.5", "8.7", "8.8"] },
    { "id": 8, "tasks": ["10.1", "11.1", "11.2", "11.4"] },
    { "id": 9, "tasks": ["10.2", "11.3"] },
    { "id": 10, "tasks": ["10.3", "11.5", "13.1"] },
    { "id": 11, "tasks": ["13.2"] }
  ]
}
```
