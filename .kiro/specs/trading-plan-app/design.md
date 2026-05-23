# Design Document: TradingParadise — Trading Plan Application

## Overview

TradingParadise is a responsive, single-page web application built with React + TypeScript + Tailwind CSS + Vite. It enables options traders to create structured trading plans, journal trades, manage portfolios, and track performance through dashboards. The application uses local persistence (IndexedDB via Dexie.js) with JSON import/export, designed for future migration to React Native (mobile) and Tauri/Electron (desktop).

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TradingParadise App                   │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │  Plan    │ │  Trade   │ │Portfolio │ │  Options  │  │
│  │  Editor/ │ │  Journal │ │Dashboard │ │ Dashboard │  │
│  │  Viewer  │ │          │ │          │ │           │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       │             │            │              │        │
│  ┌────┴─────────────┴────────────┴──────────────┴────┐  │
│  │              State Management (Zustand)            │  │
│  └────┬──────────────────────────────────────────────┘  │
│       │                                                 │
│  ┌────┴──────────────────────────────────────────────┐  │
│  │           Data Layer (Dexie.js / IndexedDB)       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Reminder Engine (Notification API)         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Notes Engine (Rich Text + Screenshots)     │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 18+ | Component-based UI |
| Language | TypeScript 5+ | Type safety |
| Styling | Tailwind CSS 3+ | Responsive design |
| Build Tool | Vite 5+ | Fast dev/build |
| State Management | Zustand | Lightweight global state |
| Persistence | Dexie.js (IndexedDB) | Local database |
| Routing | React Router v6 | SPA navigation |
| Rich Text | TipTap | Notes and journaling |
| Charts | Recharts | Dashboard visualizations |
| Screenshots | html2canvas | Screenshot capture for notes |
| Date Handling | date-fns | Date calculations |
| Form Validation | Zod + React Hook Form | Schema validation |
| Testing | Vitest + fast-check | Unit + property-based tests |
| Icons | Lucide React | UI icons |

### Project Structure

```
src/
├── main.tsx                    # App entry point
├── App.tsx                     # Root component with routing
├── types/                      # TypeScript type definitions
│   ├── tradingPlan.ts          # Plan, Strategy, Rule types
│   ├── journal.ts              # Trade journal entry types
│   ├── portfolio.ts            # Portfolio types
│   ├── reminder.ts             # Reminder types
│   └── common.ts               # Shared types (enums, etc.)
├── schemas/                    # Zod validation schemas
│   ├── tradingPlanSchema.ts
│   ├── journalSchema.ts
│   ├── portfolioSchema.ts
│   └── reminderSchema.ts
├── db/                         # Database layer
│   ├── database.ts             # Dexie database definition
│   ├── planRepository.ts       # Plan CRUD operations
│   ├── journalRepository.ts    # Journal CRUD operations
│   ├── portfolioRepository.ts  # Portfolio CRUD operations
│   └── reminderRepository.ts   # Reminder CRUD operations
├── stores/                     # Zustand stores
│   ├── planStore.ts
│   ├── journalStore.ts
│   ├── portfolioStore.ts
│   ├── reminderStore.ts
│   └── appStore.ts             # Global app state (active plan, etc.)
├── hooks/                      # Custom React hooks
│   ├── useTradingPlan.ts
│   ├── useJournal.ts
│   ├── usePortfolio.ts
│   ├── useReminders.ts
│   └── useNotes.ts
├── components/                 # React components
│   ├── layout/
│   │   ├── AppShell.tsx        # Main layout with sidebar
│   │   ├── Sidebar.tsx
│   │   └── Header.tsx
│   ├── plan/
│   │   ├── PlanEditor.tsx      # Plan creation/editing
│   │   ├── PlanViewer.tsx      # Read-only plan display
│   │   ├── SectionNav.tsx      # Table of contents navigation
│   │   ├── GoalsSection.tsx
│   │   ├── GreeksSection.tsx
│   │   ├── RiskManagementSection.tsx
│   │   ├── TradeRulesSection.tsx
│   │   ├── DailyManagementSection.tsx
│   │   ├── VacationSection.tsx
│   │   ├── MarketRegimeSection.tsx
│   │   ├── AccountSizingSection.tsx
│   │   ├── StrategyEditor.tsx
│   │   └── StrategyCard.tsx
│   ├── journal/
│   │   ├── TradeJournal.tsx    # Journal table view
│   │   ├── TradeEntryForm.tsx  # Create/edit trade entry
│   │   ├── JournalFilters.tsx
│   │   ├── JournalSummary.tsx
│   │   └── ComplianceIndicator.tsx
│   ├── portfolio/
│   │   ├── PortfolioDashboard.tsx
│   │   ├── PortfolioForm.tsx
│   │   ├── PositionsList.tsx
│   │   ├── PerformanceMetrics.tsx
│   │   ├── PerformanceChart.tsx
│   │   └── StrategyBreakdown.tsx
│   ├── options-dashboard/
│   │   ├── OptionsDashboard.tsx
│   │   ├── PremiumIncome.tsx
│   │   ├── IncomeChart.tsx
│   │   ├── PerformanceByStrategy.tsx
│   │   └── CumulativePLChart.tsx
│   ├── reminders/
│   │   ├── ReminderList.tsx
│   │   ├── ReminderForm.tsx
│   │   └── ReminderNotification.tsx
│   ├── notes/
│   │   ├── NotesEditor.tsx     # TipTap rich text editor
│   │   └── ScreenshotCapture.tsx
│   └── ui/                     # Shared UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Modal.tsx
│       ├── Table.tsx
│       ├── Card.tsx
│       ├── Badge.tsx
│       ├── Toast.tsx
│       └── ConfirmDialog.tsx
├── utils/                      # Utility functions
│   ├── calculations.ts         # Trade calculations (ROR, P/L, etc.)
│   ├── compliance.ts           # Plan compliance checking
│   ├── serialization.ts        # JSON import/export
│   ├── dateUtils.ts            # Date helpers
│   └── formatters.ts           # Number/currency formatting
└── pages/                      # Route pages
    ├── DashboardPage.tsx
    ├── PlanEditorPage.tsx
    ├── PlanViewerPage.tsx
    ├── JournalPage.tsx
    ├── PortfolioPage.tsx
    ├── OptionsDashboardPage.tsx
    ├── RemindersPage.tsx
    └── SettingsPage.tsx
```

## Data Models

### Trading Plan

```typescript
interface TradingPlan {
  id: string;                          // UUID
  name: string;                        // Plan name
  author: string;                      // Author name
  year: number;                        // Plan year
  createdAt: Date;
  updatedAt: Date;
  goals: Goal[];
  greeksTargets: GreeksTarget[];
  riskManagement: RiskManagement;
  tradeRules: TradeRule[];
  dailyManagement: DailyManagement;
  vacationRules: VacationRule[];
  marketRegimes: MarketRegime[];
  accountSizing: AccountSizing;
  coreStrategies: Strategy[];
  speculativeStrategies: Strategy[];
}

interface Goal {
  id: string;
  description: string;
  targetValue: string;
}

interface GreeksTarget {
  id: string;
  metricName: string;                  // "Delta", "Theta", "Vega", or custom
  targetDescription: string;
  minValue?: number;
  maxValue?: number;
}

interface RiskManagement {
  bpThresholds: BPThreshold[];
  positionLimits: PositionLimit[];
  maxLossPerTrade?: number;
  maxLossPerPortfolio?: number;
}

interface BPThreshold {
  id: string;
  percentage: number;                  // 0-100
  actionDescription: string;
}

interface PositionLimit {
  id: string;
  strategyName: string;
  maxPositions: number;
  maxPerUnderlying: number;
}

interface TradeRule {
  id: string;
  order: number;
  text: string;
  category?: string;
}

interface DailyManagement {
  nightlyReview: ChecklistItem[];
  morningReview: ChecklistItem[];
}

interface ChecklistItem {
  id: string;
  order: number;
  description: string;
  reviewType: 'nightly' | 'morning';
}

interface VacationRule {
  id: string;
  order: number;
  text: string;
}

interface MarketRegime {
  id: string;
  name: string;                        // "Bullish", "Neutral", "Bearish", etc.
  conditions: string;
  strategyAdjustments: string;
}

interface AccountSizing {
  totalAccountSize: number;
  allocations: StrategyAllocation[];
}

interface StrategyAllocation {
  id: string;
  categoryName: string;
  allocationPercentage: number;
  numberOfPositions?: number;
  positionSizing?: string;
}

interface Strategy {
  id: string;
  name: string;
  classification: 'Core' | 'Speculative';
  description: string;
  variants?: StrategyVariant[];
  entryCriteria: EntryCriterion[];
  managementRules: ManagementRule[];
  profitTargets: ProfitTarget[];
  stopLosses: StopLoss[];
}

interface StrategyVariant {
  id: string;
  name: string;
  description: string;
}

interface EntryCriterion {
  id: string;
  parameterName: string;
  value: string;
}

interface ManagementRule {
  id: string;
  triggerCondition: string;
  actionDescription: string;
}

interface ProfitTarget {
  id: string;
  targetValue: string;                 // Percentage or dollar
  action: string;
}

interface StopLoss {
  id: string;
  stopValue: string;                   // Percentage or dollar
  action: string;
}
```

### Trade Journal Entry

```typescript
type OptionType = 'Call' | 'Put';
type TradeDirection = 'Buy' | 'Sell';
type TradeStatus = 'Open' | 'Closed' | 'Expired' | 'Assigned';
type WinLoss = 'Win' | 'Loss' | null;

interface TradeJournalEntry {
  id: string;
  stockSymbol: string;
  openDate: Date;
  expirationDate: Date;
  optionType: OptionType;
  direction: TradeDirection;
  stockPriceDOC: number;
  dte: number;                         // Auto-calculated
  ditc: number;                        // Auto-calculated for open trades
  currentStockPrice?: number;
  breakEvenPrice: number;              // Auto-calculated
  strikePrice: number;
  premium: number;
  cashReserve: number;
  marginCashReserve?: number;
  fees: number;
  exitPrice?: number;
  closeDate?: Date;
  profitLoss?: number;                 // Auto-calculated on close
  winLoss: WinLoss;                    // Auto-calculated on close
  daysHeld?: number;                   // Auto-calculated on close
  annualizedROR?: number;              // Auto-calculated
  marginAnnualizedROR?: number;        // Auto-calculated
  tradeStatus: TradeStatus;
  portfolioId: string;                 // Linked Portfolio
  strategyId: string;                  // Linked Strategy
  planId: string;                      // Linked Trading Plan
  unrealizedPL?: number;              // Auto-calculated for open trades
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Portfolio

```typescript
interface Portfolio {
  id: string;
  name: string;
  description: string;
  initialBalance: number;
  planId: string;                      // Linked Trading Plan
  createdAt: Date;
  updatedAt: Date;
}

// Computed from journal entries — not stored
interface PortfolioMetrics {
  netLiquidation: number;
  totalRealizedPL: number;
  totalUnrealizedPL: number;
  totalPL: number;
  monthlyReturns: MonthlyReturn[];
  maxDrawdown: number;
  cumulativeReturn: number;
  winRate: number;
  averageTradeReturn: number;
  totalTrades: number;
}

interface MonthlyReturn {
  month: string;                       // "YYYY-MM"
  dollarReturn: number;
  percentageReturn: number;
}

interface OpenPosition {
  stockSymbol: string;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: Date;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
}
```

### Reminder

```typescript
type RecurrencePattern = 'one-time' | 'daily' | 'weekly' | 'monthly';
type ReminderStatus = 'pending' | 'completed' | 'snoozed' | 'dismissed';

interface Reminder {
  id: string;
  title: string;
  description: string;
  strategyId?: string;
  activityType?: string;
  date: Date;
  time: string;                        // "HH:mm"
  recurrence: RecurrencePattern;
  status: ReminderStatus;
  planId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Key Algorithms

### Trade Calculations (utils/calculations.ts)

```typescript
function calculateDTE(openDate: Date, expirationDate: Date): number {
  return differenceInCalendarDays(expirationDate, openDate);
}

function calculateDITC(openDate: Date): number {
  return differenceInCalendarDays(new Date(), openDate);
}

function calculateBreakEvenPrice(
  strikePrice: number,
  premium: number,
  optionType: OptionType
): number {
  return optionType === 'Put'
    ? strikePrice - premium
    : strikePrice + premium;
}

function calculateAnnualizedROR(
  premium: number,
  cashReserve: number,
  daysHeld: number
): number {
  if (cashReserve === 0 || daysHeld === 0) return 0;
  return (premium / cashReserve) * (365 / daysHeld) * 100;
}

function calculateProfitLoss(
  entryPremium: number,
  exitPrice: number,
  direction: TradeDirection,
  fees: number
): number {
  const gross = direction === 'Sell'
    ? entryPremium - exitPrice
    : exitPrice - entryPremium;
  return gross - fees;
}

function calculateWinLoss(profitLoss: number): WinLoss {
  return profitLoss > 0 ? 'Win' : 'Loss';
}
```

### Plan Compliance Checking (utils/compliance.ts)

```typescript
interface ComplianceResult {
  isCompliant: boolean;
  deviations: ComplianceDeviation[];
}

interface ComplianceDeviation {
  field: string;
  expected: string;
  actual: string;
  severity: 'warning' | 'violation';
}

function checkTradeCompliance(
  entry: TradeJournalEntry,
  strategy: Strategy
): ComplianceResult {
  const deviations: ComplianceDeviation[] = [];

  for (const criterion of strategy.entryCriteria) {
    // Compare entry parameters against strategy criteria
    // e.g., check DTE range, delta range, etc.
    const deviation = compareEntryCriterion(entry, criterion);
    if (deviation) deviations.push(deviation);
  }

  return {
    isCompliant: deviations.length === 0,
    deviations,
  };
}

function calculateCompliancePercentage(
  entries: TradeJournalEntry[],
  strategies: Strategy[]
): number {
  if (entries.length === 0) return 100;
  const compliantCount = entries.filter(entry => {
    const strategy = strategies.find(s => s.id === entry.strategyId);
    if (!strategy) return false;
    return checkTradeCompliance(entry, strategy).isCompliant;
  }).length;
  return (compliantCount / entries.length) * 100;
}
```

### JSON Serialization (utils/serialization.ts)

```typescript
interface SerializedPlanData {
  version: string;
  exportedAt: string;
  plan: TradingPlan;
  portfolios: Portfolio[];
  journalEntries: TradeJournalEntry[];
  reminders: Reminder[];
}

function serializePlan(
  plan: TradingPlan,
  portfolios: Portfolio[],
  entries: TradeJournalEntry[],
  reminders: Reminder[]
): string {
  const data: SerializedPlanData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    plan,
    portfolios,
    journalEntries: entries,
    reminders,
  };
  return JSON.stringify(data, null, 2);
}

function deserializePlan(json: string): SerializedPlanData {
  const parsed = JSON.parse(json);
  const result = serializedPlanSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(
      `Invalid plan data: ${result.error.issues.map(i => i.message).join(', ')}`
    );
  }
  return result.data;
}
```

### Options Dashboard Aggregations (computed in store/hooks)

```typescript
function calculatePremiumIncome(
  entries: TradeJournalEntry[],
  period: 'day' | 'week' | 'month',
  referenceDate: Date
): number {
  const filtered = entries.filter(e =>
    e.tradeStatus === 'Closed' && isWithinPeriod(e.closeDate!, period, referenceDate)
  );
  return filtered.reduce((sum, e) => sum + e.premium, 0);
}

function calculatePerformanceByStrategy(
  entries: TradeJournalEntry[],
  strategies: Strategy[]
): StrategyPerformance[] {
  return strategies.map(strategy => {
    const strategyEntries = entries.filter(e => e.strategyId === strategy.id);
    const closedEntries = strategyEntries.filter(e => e.tradeStatus === 'Closed');
    const wins = closedEntries.filter(e => e.winLoss === 'Win');
    return {
      strategyId: strategy.id,
      strategyName: strategy.name,
      totalTrades: closedEntries.length,
      winRate: closedEntries.length > 0 ? (wins.length / closedEntries.length) * 100 : 0,
      totalPL: closedEntries.reduce((sum, e) => sum + (e.profitLoss ?? 0), 0),
      avgAnnualizedROR: average(closedEntries.map(e => e.annualizedROR ?? 0)),
    };
  });
}
```

## Database Schema (Dexie.js)

```typescript
class TradingParadiseDB extends Dexie {
  plans!: Table<TradingPlan, string>;
  portfolios!: Table<Portfolio, string>;
  journalEntries!: Table<TradeJournalEntry, string>;
  reminders!: Table<Reminder, string>;

  constructor() {
    super('TradingParadiseDB');
    this.version(1).stores({
      plans: 'id, name, year, updatedAt',
      portfolios: 'id, name, planId',
      journalEntries: 'id, planId, portfolioId, strategyId, stockSymbol, openDate, tradeStatus, optionType, winLoss',
      reminders: 'id, planId, date, status',
    });
  }
}
```

## Component Design

### Routing

```
/                          → DashboardPage (overview)
/plans/new                 → PlanEditorPage (create)
/plans/:id/edit            → PlanEditorPage (edit)
/plans/:id                 → PlanViewerPage (read-only)
/journal                   → JournalPage
/journal/new               → TradeEntryForm
/journal/:id/edit          → TradeEntryForm
/portfolios                → PortfolioPage (list)
/portfolios/:id            → PortfolioDashboard
/options-dashboard         → OptionsDashboardPage
/reminders                 → RemindersPage
/settings                  → SettingsPage (import/export)
```

### Responsive Design Strategy

- Mobile-first approach using Tailwind breakpoints (sm, md, lg, xl)
- Sidebar collapses to bottom navigation on mobile
- Tables switch to card layout on small screens
- Charts resize responsively via Recharts ResponsiveContainer
- Forms stack vertically on mobile, use grid on desktop

### Unsaved Changes Detection

The PlanEditor tracks a `isDirty` flag in the plan store. On route navigation, a `beforeunload` event listener and React Router's `useBlocker` hook prompt the user to save or discard changes.

## Correctness Properties

### Property 1: DTE Calculation Consistency
For any valid openDate and expirationDate where expirationDate >= openDate, `calculateDTE(openDate, expirationDate)` SHALL return a non-negative integer equal to the calendar day difference.

### Property 2: Break-Even Price Calculation
For any strikePrice > 0 and premium > 0:
- For Put options: `calculateBreakEvenPrice(strikePrice, premium, 'Put')` === strikePrice - premium
- For Call options: `calculateBreakEvenPrice(strikePrice, premium, 'Call')` === strikePrice + premium

### Property 3: Annualized ROR Formula
For any premium > 0, cashReserve > 0, and daysHeld > 0:
`calculateAnnualizedROR(premium, cashReserve, daysHeld)` === (premium / cashReserve) * (365 / daysHeld) * 100

### Property 4: Win/Loss Determination
For any closed trade with a calculated profitLoss:
- profitLoss > 0 → winLoss === 'Win'
- profitLoss <= 0 → winLoss === 'Loss'

### Property 5: JSON Round-Trip Consistency
For any valid TradingPlan object P:
`deserializePlan(serializePlan(P))` produces an object equivalent to P (all fields match).

### Property 6: BP Threshold Ordering
For any valid RiskManagement with bpThresholds, the thresholds SHALL be stored in ascending order by percentage. Saving thresholds in non-ascending order SHALL trigger a validation error.

### Property 7: Strategy Allocation Sum Warning
For any set of StrategyAllocations, if the sum of allocationPercentage values does not equal 100, a warning SHALL be produced.

### Property 8: Compliance Check Determinism
For any TradeJournalEntry E and Strategy S, `checkTradeCompliance(E, S)` SHALL always return the same ComplianceResult for the same inputs.

### Property 9: Premium Income Aggregation
For any set of closed TradeJournalEntries within a time period, the premium income total SHALL equal the sum of individual Premium values for entries closed within that period.

### Property 10: Portfolio Metrics Consistency
For any Portfolio with journal entries, totalPL SHALL equal totalRealizedPL + totalUnrealizedPL.

## Notes

- All IDs use UUID v4 generated client-side
- Dates stored as ISO strings in IndexedDB, parsed to Date objects in the application layer
- The Reminder Engine uses `setInterval` polling (every 60 seconds) to check for due reminders and triggers browser Notification API
- Screenshot capture uses html2canvas to render DOM elements to canvas, then stores as base64 in notes
- The application is designed for future backend integration — repository pattern abstracts data access
