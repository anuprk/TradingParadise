# Implementation Plan: TradingParadise — Trading Plan Application

## Overview

Implement TradingParadise as a responsive React + TypeScript + Tailwind CSS + Vite single-page application. The implementation follows an incremental approach: project scaffolding → data models & validation → database layer → state management → core UI components → feature modules → dashboards → integration & polish. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Project setup and foundational infrastructure
  - [x] 1.1 Initialize Vite + React + TypeScript project with Tailwind CSS
    - Run `npm create vite@latest` with React + TypeScript template
    - Install and configure Tailwind CSS 3+
    - Install core dependencies: `react-router-dom`, `zustand`, `dexie`, `zod`, `react-hook-form`, `@hookform/resolvers`, `date-fns`, `uuid`, `recharts`, `@tiptap/react`, `@tiptap/starter-kit`, `html2canvas`, `lucide-react`
    - Install dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
    - Configure Vitest in `vite.config.ts`
    - Set up base Tailwind config with responsive breakpoints
    - _Requirements: 1.1, 10.1_

  - [x] 1.2 Create TypeScript type definitions
    - Create `src/types/tradingPlan.ts` with all Trading Plan interfaces (TradingPlan, Goal, GreeksTarget, RiskManagement, BPThreshold, PositionLimit, TradeRule, DailyManagement, ChecklistItem, VacationRule, MarketRegime, AccountSizing, StrategyAllocation, Strategy, StrategyVariant, EntryCriterion, ManagementRule, ProfitTarget, StopLoss)
    - Create `src/types/journal.ts` with TradeJournalEntry, OptionType, TradeDirection, TradeStatus, WinLoss types
    - Create `src/types/portfolio.ts` with Portfolio, PortfolioMetrics, MonthlyReturn, OpenPosition types
    - Create `src/types/reminder.ts` with Reminder, RecurrencePattern, ReminderStatus types
    - Create `src/types/common.ts` with shared enums and utility types
    - _Requirements: 1.1, 2.1, 3.1, 9.1, 13.1, 17.1, 12.1_

  - [x] 1.3 Create Zod validation schemas
    - Create `src/schemas/tradingPlanSchema.ts` with validation for all plan sections including: required fields, BP threshold ascending order, allocation percentage sum check, min/max Greek range validation, trade rule count limits (1-50), market regime count limits (3-10), strategy requiring at least one entry criterion and one management rule
    - Create `src/schemas/journalSchema.ts` with validation for trade journal entries
    - Create `src/schemas/portfolioSchema.ts` with validation for portfolio data
    - Create `src/schemas/reminderSchema.ts` with validation for reminders
    - _Requirements: 1.5, 2.4, 3.5, 3.6, 4.4, 7.3, 8.3, 9.8, 16.4_

  - [x] 1.4 Write property tests for validation schemas
    - **Property 6: BP Threshold Ordering** — Generate random BP threshold arrays; verify non-ascending order triggers validation error
    - **Property 7: Strategy Allocation Sum Warning** — Generate random allocation sets; verify warning when sum ≠ 100%
    - **Validates: Requirements 3.5, 3.6, 8.3**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Database layer and utility functions
  - [x] 3.1 Implement Dexie.js database definition
    - Create `src/db/database.ts` with TradingParadiseDB class
    - Define tables: plans, portfolios, journalEntries, reminders with indexed fields
    - _Requirements: 14.1_

  - [x] 3.2 Implement repository modules
    - Create `src/db/planRepository.ts` with CRUD operations for trading plans (create, read, update, delete, list, getLastAccessed)
    - Create `src/db/journalRepository.ts` with CRUD operations for journal entries plus filtering (by strategy, portfolio, date range, symbol, option type, status, win/loss)
    - Create `src/db/portfolioRepository.ts` with CRUD operations for portfolios
    - Create `src/db/reminderRepository.ts` with CRUD operations for reminders plus query by status and date
    - _Requirements: 14.1, 14.2, 14.3, 13.12, 13.13_

  - [x] 3.3 Implement trade calculation utilities
    - Create `src/utils/calculations.ts` with functions: calculateDTE, calculateDITC, calculateBreakEvenPrice, calculateAnnualizedROR, calculateMarginAnnualizedROR, calculateProfitLoss, calculateWinLoss, calculateDaysHeld
    - Create `src/utils/dateUtils.ts` with date helper functions
    - Create `src/utils/formatters.ts` with currency, percentage, and number formatters
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x] 3.4 Write property tests for trade calculations
    - **Property 1: DTE Calculation Consistency** — For random valid date pairs, DTE is non-negative and equals calendar day difference
    - **Property 2: Break-Even Price Calculation** — For random strikePrice > 0 and premium > 0, verify Put = strike - premium, Call = strike + premium
    - **Property 3: Annualized ROR Formula** — For random premium > 0, cashReserve > 0, daysHeld > 0, verify formula correctness
    - **Property 4: Win/Loss Determination** — For random profitLoss values, verify Win when > 0, Loss when <= 0
    - **Validates: Requirements 13.4, 13.6, 13.7, 13.10**

  - [x] 3.5 Implement JSON serialization utilities
    - Create `src/utils/serialization.ts` with serializePlan and deserializePlan functions
    - Implement Zod-based validation on import with descriptive error messages
    - Handle date serialization/deserialization (ISO strings ↔ Date objects)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 3.6 Write property test for JSON round-trip
    - **Property 5: JSON Round-Trip Consistency** — Generate random valid TradingPlan objects; verify serialize then deserialize produces equivalent object
    - **Validates: Requirements 16.3**

  - [x] 3.7 Implement compliance checking utilities
    - Create `src/utils/compliance.ts` with checkTradeCompliance and calculateCompliancePercentage functions
    - Compare trade entry parameters against strategy entry criteria (DTE range, delta range, etc.)
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 3.8 Write property tests for compliance and aggregation
    - **Property 8: Compliance Check Determinism** — For random entry/strategy pairs, verify same inputs always produce same result
    - **Property 9: Premium Income Aggregation** — For random sets of closed entries, verify total equals sum of individual premiums
    - **Property 10: Portfolio Metrics Consistency** — For random portfolio entries, verify totalPL = realizedPL + unrealizedPL
    - **Validates: Requirements 15.1, 18.1, 17.3**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. State management
  - [x] 5.1 Implement Zustand stores
    - Create `src/stores/appStore.ts` with global app state (activePlanId, loading states, toast notifications)
    - Create `src/stores/planStore.ts` with plan state, CRUD actions, isDirty tracking for unsaved changes
    - Create `src/stores/journalStore.ts` with journal entries state, filtering, sorting, summary calculations
    - Create `src/stores/portfolioStore.ts` with portfolio state, metrics computation
    - Create `src/stores/reminderStore.ts` with reminder state, status management
    - _Requirements: 11.2, 14.2_

  - [x] 5.2 Implement custom React hooks
    - Create `src/hooks/useTradingPlan.ts` wrapping plan store with DB sync
    - Create `src/hooks/useJournal.ts` wrapping journal store with filtering and auto-calculations
    - Create `src/hooks/usePortfolio.ts` wrapping portfolio store with metrics
    - Create `src/hooks/useReminders.ts` wrapping reminder store with polling logic
    - Create `src/hooks/useNotes.ts` for TipTap editor integration
    - _Requirements: 13.4, 13.5, 13.9, 12.3, 17.8_

- [x] 6. Layout and navigation shell
  - [x] 6.1 Implement app layout and routing
    - Create `src/App.tsx` with React Router configuration for all routes
    - Create `src/components/layout/AppShell.tsx` with responsive sidebar + main content area
    - Create `src/components/layout/Sidebar.tsx` with navigation links, collapsible on mobile to bottom nav
    - Create `src/components/layout/Header.tsx` with plan selector and app title
    - _Requirements: 10.3_

  - [x] 6.2 Create shared UI components
    - Create `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Modal.tsx`, `Table.tsx`, `Card.tsx`, `Badge.tsx`, `Toast.tsx`, `ConfirmDialog.tsx`
    - All components must be responsive and use Tailwind utility classes
    - _Requirements: 10.1, 10.4_

  - [x] 6.3 Create page route components
    - Create all page components in `src/pages/`: DashboardPage, PlanEditorPage, PlanViewerPage, JournalPage, PortfolioPage, OptionsDashboardPage, RemindersPage, SettingsPage
    - Wire pages to routes in App.tsx
    - _Requirements: 10.1_

- [x] 7. Trading Plan Editor
  - [x] 7.1 Implement PlanEditor container and section navigation
    - Create `src/components/plan/PlanEditor.tsx` as the main editor container with section tabs/accordion
    - Create `src/components/plan/SectionNav.tsx` for table of contents navigation between sections
    - Implement unsaved changes detection with `beforeunload` and React Router `useBlocker`
    - _Requirements: 1.1, 10.3, 11.1, 11.4, 11.5_

  - [x] 7.2 Implement plan metadata and Goals section
    - Add plan name, author, year fields to PlanEditor
    - Create `src/components/plan/GoalsSection.tsx` with add/edit/remove goals (description + target value)
    - _Requirements: 1.2, 1.3_

  - [x] 7.3 Implement Portfolio Greeks Targets section
    - Create `src/components/plan/GreeksSection.tsx` with Delta, Theta, Vega targets plus custom metrics
    - Implement min/max range validation (min must be <= max)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 7.4 Implement Risk Management section
    - Create `src/components/plan/RiskManagementSection.tsx` with BP thresholds (ascending order enforced), position limits, max loss thresholds
    - Validate ascending BP threshold percentages and duplicate detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.5 Implement Trade Rules section
    - Create `src/components/plan/TradeRulesSection.tsx` with ordered list of rules (add, edit, reorder, remove)
    - Support optional category labels, enforce 1-50 rule limit
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.6 Implement Daily Management and Vacation sections
    - Create `src/components/plan/DailyManagementSection.tsx` with separate nightly and morning checklists, reorderable items
    - Create `src/components/plan/VacationSection.tsx` with ordered vacation rules list
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [x] 7.7 Implement Market Regime Framework section
    - Create `src/components/plan/MarketRegimeSection.tsx` with regime categories (name, conditions, strategy adjustments)
    - Enforce 3-10 regime limit
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.8 Implement Account Sizing and Strategy Allocation section
    - Create `src/components/plan/AccountSizingSection.tsx` with total account size, allocation categories with percentages
    - Display calculated dollar amounts, show warning when allocations don't sum to 100%
    - Support number of positions and position sizing per allocation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 7.9 Implement Strategy Editor
    - Create `src/components/plan/StrategyEditor.tsx` for creating/editing strategies (Core or Speculative)
    - Capture strategy name, classification, description, variants, entry criteria, management rules, profit targets, stop losses
    - Validate at least one entry criterion and one management rule before save
    - Create `src/components/plan/StrategyCard.tsx` for displaying strategy summaries
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 7.10 Implement plan save with validation
    - Wire save button to persist plan via planRepository
    - Validate all required sections before save, highlight incomplete sections
    - Display confirmation message on successful save (within 2 seconds)
    - _Requirements: 1.4, 1.5, 11.2, 11.3_

  - [x] 7.11 Write unit tests for PlanEditor validation flows
    - Test required section validation and error highlighting
    - Test unsaved changes prompt
    - Test BP threshold ordering enforcement
    - _Requirements: 1.5, 3.5, 11.5_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Trading Plan Viewer
  - [x] 9.1 Implement PlanViewer with all sections
    - Create `src/components/plan/PlanViewer.tsx` displaying complete plan in structured, readable layout
    - Display all sections: Goals, Portfolio Greeks Targets, Risk Management, Trade Rules, Daily Portfolio Management, Vacation Trade Management, Market Regime Framework, Account Sizing & Strategy Allocation, Core Strategies, Speculative Strategies
    - Include section navigation (table of contents)
    - Display strategy details in tabular/card format with entry criteria, management rules, profit targets, stop losses
    - Display allocation percentages with calculated dollar amounts
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 10. Trade Journal
  - [x] 10.1 Implement Trade Entry Form
    - Create `src/components/journal/TradeEntryForm.tsx` with all 26 fields from Requirement 13.1
    - Implement auto-calculations: DTE, DITC, Break-Even Price, Annualized ROR, Margin Annualized ROR, P/L, Win/Loss, Days Held
    - Require linking to a Strategy and Portfolio
    - Include free-text notes field using TipTap rich text editor
    - Support create and edit modes
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 17.7_

  - [x] 10.2 Implement Trade Journal table view
    - Create `src/components/journal/TradeJournal.tsx` with tabular display of all journal entries (all 26 columns)
    - Default sort by Open Date descending
    - Support sorting by any column ascending/descending
    - Responsive: switch to card layout on mobile
    - _Requirements: 13.11, 13.13_

  - [x] 10.3 Implement journal filtering and summary
    - Create `src/components/journal/JournalFilters.tsx` with filters for Strategy, Account (Portfolio), date range, Stock Symbol, Option Type, Trade Status, Win/Loss
    - Create `src/components/journal/JournalSummary.tsx` displaying total trades, win rate %, total P/L, average P/L per trade, total fees
    - _Requirements: 13.12, 13.14_

  - [x] 10.4 Implement compliance indicators
    - Create `src/components/journal/ComplianceIndicator.tsx` to visually flag deviations from strategy parameters
    - Show compliance percentage in journal summary
    - Display deviations when viewing individual entries
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 10.5 Implement journal entry edit and delete
    - Add edit and delete actions to journal entries
    - Show confirmation dialog before delete
    - _Requirements: 13.15_

  - [x] 10.6 Wire journal to Plan Viewer and Portfolio Dashboard
    - When a strategy is selected in PlanViewer, display associated journal entries
    - When a portfolio is selected in PortfolioDashboard, display associated journal entries
    - _Requirements: 13.16, 13.17_

  - [x] 10.7 Write unit tests for trade entry auto-calculations
    - Test DTE, DITC, Break-Even, Annualized ROR, P/L, Win/Loss calculations in the form
    - Test form validation for required fields
    - _Requirements: 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

- [x] 11. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Portfolio Management
  - [x] 12.1 Implement Portfolio creation and management
    - Create `src/components/portfolio/PortfolioForm.tsx` for creating/editing portfolios (name, description, initial balance, linked plan)
    - Implement portfolio list view on PortfolioPage
    - Handle portfolio deletion with confirmation when journal entries exist
    - _Requirements: 17.1, 17.2, 17.10_

  - [x] 12.2 Implement Portfolio Dashboard
    - Create `src/components/portfolio/PortfolioDashboard.tsx` displaying Net Liquidation, Realized P/L, Unrealized P/L, total P/L
    - Create `src/components/portfolio/PerformanceMetrics.tsx` with monthly returns, max drawdown, cumulative return, win rate, avg trade return, total trades
    - Create `src/components/portfolio/PositionsList.tsx` showing open positions with symbol, option type, strike, expiration, quantity, entry price, current price, unrealized P/L
    - Create `src/components/portfolio/StrategyBreakdown.tsx` showing P/L by strategy
    - Implement filtering and sorting for positions
    - _Requirements: 17.3, 17.4, 17.5, 17.6, 17.8, 17.9, 17.12_

  - [x] 12.3 Implement Portfolio performance chart
    - Create `src/components/portfolio/PerformanceChart.tsx` with historical Net Liquidation and cumulative P/L chart using Recharts
    - Support time period selection
    - _Requirements: 17.11_

  - [x] 12.4 Write unit tests for portfolio metrics calculations
    - Test Net Liquidation, drawdown, monthly returns, and strategy breakdown calculations
    - _Requirements: 17.3, 17.4, 17.9_

- [x] 13. Options Dashboard
  - [x] 13.1 Implement Premium Income displays
    - Create `src/components/options-dashboard/OptionsDashboard.tsx` as the main dashboard container
    - Create `src/components/options-dashboard/PremiumIncome.tsx` showing daily, weekly, and monthly premium income totals
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 13.2 Implement income and performance charts
    - Create `src/components/options-dashboard/IncomeChart.tsx` with daily premium income trend chart and monthly bar chart
    - Create `src/components/options-dashboard/CumulativePLChart.tsx` with cumulative P/L line chart
    - Support time period selection (30d, 90d, 6m, 1y, all time)
    - _Requirements: 18.4, 18.5, 18.11_

  - [x] 13.3 Implement performance metrics and strategy breakdown
    - Display aggregated metrics: total trades, win rate, total P/L, avg P/L, avg Annualized ROR, avg Margin Annualized ROR, total fees
    - Create `src/components/options-dashboard/PerformanceByStrategy.tsx` with per-strategy breakdown
    - _Requirements: 18.6, 18.7, 18.10_

  - [x] 13.4 Implement dashboard filtering and empty state
    - Add filters for Account, Strategy, Stock Symbol, Option Type, date range
    - Recalculate all metrics when filters change or journal data changes
    - Display "no data available" message when no entries match filters
    - _Requirements: 18.8, 18.9, 18.12_

  - [x] 13.5 Write unit tests for dashboard aggregation logic
    - Test premium income calculations for day/week/month periods
    - Test strategy performance breakdown
    - Test empty state handling
    - _Requirements: 18.1, 18.6, 18.12_

- [x] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Reminders
  - [x] 15.1 Implement Reminder creation and management
    - Create `src/components/reminders/ReminderForm.tsx` for creating/editing reminders (title, description, strategy/activity link, date, time, recurrence)
    - Create `src/components/reminders/ReminderList.tsx` displaying upcoming reminders sorted by date/time ascending
    - Visually distinguish overdue, due-today, and future reminders using color-coded badges
    - Support mark complete, snooze, dismiss, edit, and delete actions
    - _Requirements: 12.1, 12.2, 12.4, 12.5, 12.6, 12.7_

  - [x] 15.2 Implement Reminder notification engine
    - Create `src/components/reminders/ReminderNotification.tsx` for in-app notification display
    - Implement polling logic (60-second interval) in useReminders hook to check for due reminders
    - Trigger browser Notification API when a reminder is due
    - _Requirements: 12.3_

- [x] 16. Notes and Screenshots
  - [x] 16.1 Implement rich text notes editor
    - Create `src/components/notes/NotesEditor.tsx` using TipTap with basic formatting (bold, italic, lists, headings)
    - Integrate into TradeEntryForm for trade notes
    - _Requirements: 13.3_

  - [x] 16.2 Implement screenshot capture
    - Create `src/components/notes/ScreenshotCapture.tsx` using html2canvas
    - Allow capturing and embedding screenshots into notes as base64 images
    - _Requirements: (User-requested feature for notes with screenshots)_

- [x] 17. Data management and import/export
  - [x] 17.1 Implement plan management (multi-plan support)
    - Add plan list, rename, and delete functionality to SettingsPage
    - Implement delete confirmation with warning about associated journal entries
    - Restore most recently accessed plan on app load
    - _Requirements: 14.2, 14.3, 14.4_

  - [x] 17.2 Implement JSON import/export
    - Add export button that serializes complete plan data (plan + portfolios + journal entries + reminders) to JSON file download
    - Add import button that reads JSON file, validates with Zod, and loads into PlanEditor
    - Display descriptive error messages for invalid/malformed JSON
    - Do not modify existing data on import failure
    - _Requirements: 14.5, 16.1, 16.2, 16.3, 16.4_

  - [x] 17.3 Write unit tests for import/export
    - Test successful round-trip serialization
    - Test error handling for malformed JSON
    - Test that existing data is not modified on import failure
    - _Requirements: 16.3, 16.4_

- [x] 18. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Integration, responsive polish, and final wiring
  - [x] 19.1 Wire Dashboard page
    - Create DashboardPage showing overview: active plan summary, recent journal entries, upcoming reminders, quick portfolio metrics
    - Link to all major sections
    - _Requirements: 10.1, 14.2_

  - [x] 19.2 Responsive design polish
    - Verify and fix responsive layouts across all pages at sm, md, lg, xl breakpoints
    - Ensure tables switch to card layout on mobile
    - Ensure sidebar collapses to bottom navigation on mobile
    - Verify charts resize properly
    - _Requirements: 10.1 (responsive)_

  - [x] 19.3 Final integration pass
    - Verify all cross-component data flows (journal ↔ portfolio ↔ plan ↔ dashboard)
    - Verify all auto-calculations trigger correctly
    - Verify compliance indicators appear in journal views
    - Verify reminder notifications fire correctly
    - _Requirements: 13.16, 13.17, 15.1, 17.8, 18.9_

- [x] 20. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The tech stack is React + TypeScript + Tailwind CSS + Vite with Dexie.js for local persistence
- All code examples and implementations should use TypeScript
