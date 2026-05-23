# Requirements Document

## Introduction

The Trading Plan Application is a web-based tool that enables options traders to build, view, and manage structured trading plans. The application supports defining portfolio goals, risk management parameters, strategy allocations, trade rules, and market regime frameworks. It provides trade reminders for upcoming scheduled trades and allows traders to journal individual options trades against their plan and portfolio for performance tracking and accountability. Traders can create portfolios representing their brokerage accounts to track net liquidation value, profit/loss, and performance metrics.

The reference trading plan (2026 Trading Plan by Tom King) serves as the canonical example of the plan structure the application must support.

## Glossary

- **Trading_Plan**: A structured document defining goals, risk parameters, strategies, trade rules, and portfolio management procedures for consistent trading
- **App**: The Trading Plan Application being built
- **Plan_Editor**: The component of the App responsible for creating and editing Trading Plans
- **Plan_Viewer**: The component of the App responsible for displaying a Trading Plan in a readable format
- **Reminder_Engine**: The component of the App responsible for scheduling and surfacing trade reminders
- **Trade_Journal**: The component of the App responsible for recording and displaying trade journal entries against a plan
- **Strategy**: A defined trading approach with specific entry criteria, management rules, profit targets, and stop losses (e.g., 11x Bear Trap, Dynamic PMCC)
- **Portfolio_Greeks**: Risk metrics for an options portfolio including Delta, Theta, and Vega targets
- **Buying_Power (BP)**: The amount of capital available for opening new positions
- **Market_Regime**: A classification of current market conditions (Bullish, Neutral, Bearish) that influences strategy selection and allocation
- **Trade_Entry**: A journal record documenting a specific trade executed against a strategy in the plan
- **Risk_Parameter**: A configurable threshold or limit used to manage portfolio risk (e.g., max BP usage, position limits)
- **Strategy_Allocation**: The percentage of account capital allocated to a specific strategy category
- **Trade_Rule**: A specific guideline or constraint that governs trading behavior (e.g., "Never add to a losing position")
- **Daily_Review**: A scheduled portfolio management activity performed at a specific time (nightly or morning)
- **Vacation_Mode**: A special operating state where the trader follows simplified trade management procedures
- **Portfolio**: The trader's actual brokerage account representation within the App, tracking positions, balances, and performance metrics
- **Portfolio_Dashboard**: The component of the App responsible for displaying Portfolio performance metrics and current positions
- **Net_Liquidation (Net_Liq)**: The total value of a Portfolio including cash, stock, and option positions at current market value
- **Realized_PL**: Profit or loss from trades that have been closed
- **Unrealized_PL**: Profit or loss from positions that are still open, calculated from current market value versus entry cost
- **Drawdown**: The peak-to-trough decline in Portfolio value over a specific period, expressed as a percentage
- **Option_Type**: The classification of an options contract as either a Call or a Put
- **Strike_Price**: The price at which the underlying asset can be bought or sold when exercising an option
- **Expiration_Date**: The date on which an options contract expires, often expressed as Days to Expiration (DTE)
- **Delta**: A Greek measuring the rate of change of an option's price relative to a one-dollar change in the underlying asset price
- **Implied_Volatility (IV)**: A metric reflecting the market's expectation of future price movement of the underlying asset, expressed as an annualized percentage
- **Premium**: The price paid or received for an options contract
- **DOC (Date_of_Contract)**: The date on which an options contract was opened, used to capture the stock price at the time of entry
- **Stock_Price_DOC**: The price of the underlying asset on the Date of Contract (at the time the trade was entered)
- **DTE (Days_to_Expiration)**: The number of calendar days remaining until an options contract expires
- **DITC (Days_in_the_Contract)**: The number of calendar days the trader has held an open options position so far
- **Break_Even_Price**: The underlying asset price at which an options trade produces zero profit or loss, calculated from the strike price and premium
- **Cash_Reserve**: The amount of cash required to be held as collateral for a cash-secured put position
- **Margin_Cash_Reserve**: The amount of margin capital required to be held as collateral for a put position when using margin
- **Annualized_ROR**: The annualized rate of return for an options trade, calculated based on the premium received relative to the cash reserve and the number of days held
- **Margin_Annualized_ROR**: The annualized rate of return for an options trade, calculated based on the premium received relative to the margin cash reserve and the number of days held
- **Trade_Status**: The current state of a trade entry (Open, Closed, Expired, or Assigned)
- **Options_Dashboard**: The component of the App responsible for displaying aggregated premium income metrics, income trends, and performance analytics from trade journal entries

## Requirements

### Requirement 1: Trading Plan Creation

**User Story:** As a trader, I want to create a new trading plan with structured sections, so that I have a comprehensive and organized plan to guide my trading.

#### Acceptance Criteria

1. WHEN a trader initiates plan creation, THE Plan_Editor SHALL present a structured template with sections for Goals, Portfolio Greeks Targets, Risk Management, Trade Rules, Daily Portfolio Management, Vacation Trade Management, Market Regime Framework, Account Sizing & Strategy Allocation, Core Strategies, and Speculative Strategies
2. WHEN a trader enters plan metadata, THE Plan_Editor SHALL capture the plan name, author name, and plan year
3. THE Plan_Editor SHALL allow the trader to define one or more goals with a description and target value
4. WHEN a trader saves a trading plan, THE App SHALL persist the plan and confirm successful save within 2 seconds
5. IF a trader attempts to save a plan with missing required sections, THEN THE Plan_Editor SHALL highlight the incomplete sections and display a validation message identifying each missing section

### Requirement 2: Portfolio Greeks Targets Configuration

**User Story:** As a trader, I want to define target ranges for my portfolio Greeks, so that I can monitor and maintain desired risk exposure levels.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to define target values for Delta, Theta, and Vega at the portfolio level
2. WHEN a trader enters a Portfolio Greeks target, THE Plan_Editor SHALL accept a metric name, a target description, and an optional numeric range (minimum and maximum)
3. THE Plan_Editor SHALL allow the trader to add custom Greek metrics beyond Delta, Theta, and Vega
4. IF a trader enters a minimum value greater than the maximum value for a Greek target range, THEN THE Plan_Editor SHALL display a validation error and prevent saving

### Requirement 3: Risk Management Parameters

**User Story:** As a trader, I want to configure risk management thresholds and rules, so that I can protect my capital and limit losses.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to define Buying Power usage thresholds with associated action steps (e.g., at 50% BP usage, reduce positions)
2. WHEN a trader adds a BP threshold, THE Plan_Editor SHALL capture the threshold percentage and the corresponding action description
3. THE Plan_Editor SHALL allow the trader to define position limits per strategy and per underlying asset
4. THE Plan_Editor SHALL allow the trader to define maximum loss thresholds per trade and per portfolio
5. WHEN a trader defines BP reduction steps, THE Plan_Editor SHALL enforce that threshold percentages are in ascending order
6. IF a trader enters a duplicate BP threshold percentage, THEN THE Plan_Editor SHALL display a validation error

### Requirement 4: Trade Rules Management

**User Story:** As a trader, I want to define and view a set of trade rules (golden rules), so that I maintain discipline and consistency in my trading.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to add, edit, reorder, and remove trade rules as an ordered list
2. WHEN a trader adds a trade rule, THE Plan_Editor SHALL capture the rule text and an optional category label
3. THE Plan_Viewer SHALL display all trade rules in their defined order with sequential numbering
4. THE Plan_Editor SHALL support a minimum of 1 and a maximum of 50 trade rules per plan

### Requirement 5: Daily Portfolio Management Procedures

**User Story:** As a trader, I want to define daily portfolio management checklists, so that I follow a consistent review process each day.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to define separate checklists for nightly review and daily (morning) review
2. WHEN a trader adds a checklist item, THE Plan_Editor SHALL capture the item description and the review type (nightly or daily)
3. THE Plan_Viewer SHALL display nightly review items and daily review items in separate sections with their defined order
4. THE Plan_Editor SHALL allow the trader to reorder checklist items within each review type

### Requirement 6: Vacation Trade Management

**User Story:** As a trader, I want to define vacation trade management procedures, so that I have a simplified plan to follow when I am away from my desk.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to define a set of vacation trade management rules as an ordered list
2. WHEN a trader adds a vacation management rule, THE Plan_Editor SHALL capture the rule text
3. THE Plan_Viewer SHALL display vacation trade management rules in a distinct section of the plan

### Requirement 7: Market Regime Framework

**User Story:** As a trader, I want to define market regime classifications with associated conditions and strategy adjustments, so that I can adapt my trading to current market conditions.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to define market regime categories (e.g., Bullish, Neutral, Bearish)
2. WHEN a trader defines a market regime, THE Plan_Editor SHALL capture the regime name, identifying conditions, and recommended strategy adjustments
3. THE Plan_Editor SHALL allow the trader to define at least 3 and up to 10 market regime categories
4. THE Plan_Viewer SHALL display each market regime with its conditions and strategy adjustments in a clearly separated layout

### Requirement 8: Account Sizing and Strategy Allocation

**User Story:** As a trader, I want to define my account size and allocate capital percentages to strategy categories, so that I maintain proper diversification.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to enter the total account size as a dollar amount
2. WHEN a trader defines strategy allocations, THE Plan_Editor SHALL capture the strategy category name and the allocation percentage
3. IF the total of all strategy allocation percentages does not equal 100%, THEN THE Plan_Editor SHALL display a warning indicating the total allocation deviation
4. THE Plan_Viewer SHALL display each strategy allocation with the calculated dollar amount based on the account size
5. THE Plan_Editor SHALL allow the trader to define the number of positions and position sizing within each strategy allocation


### Requirement 9: Strategy Definition

**User Story:** As a trader, I want to define detailed trading strategies with entry criteria, management rules, profit targets, and stop losses, so that I have clear execution guidelines for each strategy.

#### Acceptance Criteria

1. THE Plan_Editor SHALL allow the trader to create strategies classified as either Core or Speculative
2. WHEN a trader defines a strategy, THE Plan_Editor SHALL capture the strategy name, classification (Core or Speculative), description, and optionally a set of variants (e.g., Standard/OTM and ATM versions)
3. WHEN a trader defines strategy entry criteria, THE Plan_Editor SHALL capture each criterion as a distinct item including the parameter name and value (e.g., "Days to Expiration: 45 DTE", "Delta: 0.30")
4. WHEN a trader defines strategy management rules, THE Plan_Editor SHALL capture each rule as a distinct item with a trigger condition and action description
5. WHEN a trader defines profit targets, THE Plan_Editor SHALL capture the target as a percentage or dollar value with an associated action (e.g., "Close at 50% profit")
6. WHEN a trader defines stop losses, THE Plan_Editor SHALL capture the stop loss as a percentage or dollar value with an associated action
7. THE Plan_Editor SHALL allow the trader to define multiple management rules, profit targets, and stop loss levels per strategy
8. IF a trader attempts to save a strategy without at least one entry criterion and one management rule, THEN THE Plan_Editor SHALL display a validation error identifying the missing components

### Requirement 10: Trading Plan Display

**User Story:** As a trader, I want to view my complete trading plan in a readable format, so that I can reference it during trading sessions.

#### Acceptance Criteria

1. WHEN a trader selects a trading plan, THE Plan_Viewer SHALL display the complete plan with all sections in a structured, readable layout
2. THE Plan_Viewer SHALL display the plan organized by sections: Goals, Portfolio Greeks Targets, Risk Management, Trade Rules, Daily Portfolio Management, Vacation Trade Management, Market Regime Framework, Account Sizing & Strategy Allocation, Core Strategies, and Speculative Strategies
3. THE Plan_Viewer SHALL allow the trader to navigate between plan sections using a table of contents or section navigation
4. THE Plan_Viewer SHALL display strategy details including entry criteria, management rules, profit targets, and stop losses in a tabular or card-based format
5. WHEN a trader views the Account Sizing section, THE Plan_Viewer SHALL display both the allocation percentage and the calculated dollar amount for each strategy category

### Requirement 11: Trading Plan Editing

**User Story:** As a trader, I want to edit an existing trading plan, so that I can update my plan as my strategy evolves.

#### Acceptance Criteria

1. WHEN a trader opens a plan for editing, THE Plan_Editor SHALL load all existing plan data into editable fields
2. WHEN a trader modifies any section of the plan, THE Plan_Editor SHALL track the changes and allow the trader to save or discard modifications
3. WHEN a trader saves edits to a plan, THE App SHALL update the persisted plan and display a confirmation message
4. THE Plan_Editor SHALL allow the trader to edit individual sections without requiring re-entry of the entire plan
5. IF a trader navigates away from the Plan_Editor with unsaved changes, THEN THE App SHALL prompt the trader to save or discard changes before navigating

### Requirement 12: Trade Reminders

**User Story:** As a trader, I want to receive reminders for upcoming trades and scheduled activities, so that I do not miss trading opportunities or management tasks.

#### Acceptance Criteria

1. THE Reminder_Engine SHALL allow the trader to create reminders linked to a specific strategy or daily review activity in the plan
2. WHEN a trader creates a reminder, THE Reminder_Engine SHALL capture the reminder title, description, associated strategy or activity, date, time, and recurrence pattern (one-time, daily, weekly, monthly)
3. WHEN a reminder's scheduled time arrives, THE App SHALL display a visible notification to the trader within the application interface
4. THE Reminder_Engine SHALL display a list of upcoming reminders sorted by date and time in ascending order
5. THE Reminder_Engine SHALL allow the trader to mark a reminder as completed, snooze the reminder, or dismiss the reminder
6. WHEN a trader views the reminder list, THE Reminder_Engine SHALL visually distinguish between overdue reminders, due-today reminders, and future reminders
7. THE Reminder_Engine SHALL allow the trader to edit or delete existing reminders

### Requirement 13: Trade Journaling

**User Story:** As a trader, I want to journal my options trades against the plan and portfolio, so that I can track performance, review decisions, and improve my trading over time.

#### Acceptance Criteria

1. WHEN a trader creates a trade journal entry, THE Trade_Journal SHALL capture the following fields: Stock Symbol (underlying asset ticker), Open Date, Expiration Date, Option_Type (Call or Put), direction (Buy or Sell), Stock_Price_DOC, DTE (auto-calculated from Open Date and Expiration Date), DITC (auto-calculated from Open Date to current date for open trades), Current Stock Price, Break_Even_Price, Strike_Price, Premium, Cash_Reserve, Margin_Cash_Reserve, Fees, Exit Price, Close Date, Profit/Loss (dollar amount), Win/Loss (categorical outcome), Days Held (total days position was held), Annualized_ROR (calculated from Premium, Cash_Reserve, and Days Held), Margin_Annualized_ROR (calculated from Premium, Margin_Cash_Reserve, and Days Held), Trade_Status (Open, Closed, Expired, or Assigned), Account (associated Portfolio), P/L with respect to current price (unrealized P/L based on current market price for open trades), and Strategy (linked strategy from the Trading Plan)
2. THE Trade_Journal SHALL allow the trader to link each journal entry to a specific Strategy defined in the Trading Plan and a specific Portfolio (Account)
3. WHEN a trader creates a journal entry, THE Trade_Journal SHALL allow the trader to enter free-text notes describing the trade rationale, market conditions, and lessons learned
4. WHEN a trader enters the Open Date and Expiration Date, THE Trade_Journal SHALL auto-calculate DTE as the number of calendar days between Open Date and Expiration Date
5. WHILE a trade entry has a Trade_Status of Open, THE Trade_Journal SHALL auto-calculate DITC as the number of calendar days from Open Date to the current date
6. WHEN a trader enters the Strike_Price, Premium, and Option_Type, THE Trade_Journal SHALL auto-calculate the Break_Even_Price (Strike Price minus Premium for puts, Strike Price plus Premium for calls)
7. WHEN a trader enters the Premium, Cash_Reserve, and Days Held, THE Trade_Journal SHALL auto-calculate the Annualized_ROR as (Premium / Cash_Reserve) * (365 / Days Held) * 100
8. WHEN a trader enters the Premium, Margin_Cash_Reserve, and Days Held, THE Trade_Journal SHALL auto-calculate the Margin_Annualized_ROR as (Premium / Margin_Cash_Reserve) * (365 / Days Held) * 100
9. WHILE a trade entry has a Trade_Status of Open, THE Trade_Journal SHALL calculate P/L with respect to current price as the unrealized profit or loss based on the difference between the current market price of the option and the entry Premium
10. WHEN a trader closes a trade by entering an Exit Price and Close Date, THE Trade_Journal SHALL auto-calculate Profit/Loss, Win/Loss (Win if Profit/Loss is positive, Loss otherwise), and Days Held (calendar days from Open Date to Close Date)
11. THE Trade_Journal SHALL display journal entries in a tabular format with all 26 fields as columns, sorted by Open Date in reverse chronological order
12. THE Trade_Journal SHALL allow the trader to filter journal entries by Strategy, Account (Portfolio), date range, Stock Symbol, Option_Type (Call or Put), Trade_Status, and Win/Loss outcome
13. THE Trade_Journal SHALL allow the trader to sort journal entries by any column in ascending or descending order
14. WHEN a trader views the journal, THE Trade_Journal SHALL display a summary showing total number of trades, win rate percentage, total Profit/Loss, average Profit/Loss per trade, and total Fees paid
15. THE Trade_Journal SHALL allow the trader to edit or delete existing journal entries
16. WHEN a trader selects a strategy in the Plan_Viewer, THE Trade_Journal SHALL display all journal entries associated with that Strategy
17. WHEN a trader selects a Portfolio in the Portfolio_Dashboard, THE Trade_Journal SHALL display all journal entries associated with that Account

### Requirement 14: Plan Persistence and Data Management

**User Story:** As a trader, I want my trading plans and journal entries to be saved reliably, so that I do not lose my data.

#### Acceptance Criteria

1. THE App SHALL persist all trading plan data, portfolios, reminders, and journal entries to local storage or a database
2. WHEN the App loads, THE App SHALL restore the most recently accessed trading plan and its associated data
3. THE App SHALL allow the trader to manage multiple trading plans (create, select, rename, and delete plans)
4. IF a trader attempts to delete a trading plan that has associated journal entries, THEN THE App SHALL prompt the trader to confirm deletion and warn that journal entries will also be deleted
5. THE App SHALL support exporting a trading plan and its associated Portfolio data to a portable format (JSON or PDF)

### Requirement 15: Plan Compliance Tracking

**User Story:** As a trader, I want to see whether my journal entries comply with my plan rules, so that I can identify when I deviate from my plan.

#### Acceptance Criteria

1. WHEN a trader creates a journal entry linked to a strategy, THE Trade_Journal SHALL compare the entry parameters against the strategy's defined entry criteria and flag deviations
2. THE Trade_Journal SHALL visually indicate journal entries that deviate from the plan's strategy parameters (e.g., entry outside defined delta range, wrong DTE)
3. WHEN a trader views the journal summary, THE Trade_Journal SHALL display a plan compliance percentage calculated as the number of compliant trades divided by the total number of trades

### Requirement 16: Trading Plan Data Serialization

**User Story:** As a trader, I want to import and export my trading plan data, so that I can back up my plans and share them.

#### Acceptance Criteria

1. THE App SHALL serialize a complete Trading Plan (including all sections, strategies, metadata, and associated Portfolio data) to JSON format
2. WHEN a trader imports a JSON file, THE App SHALL deserialize the JSON and load the Trading Plan into the Plan_Editor
3. FOR ALL valid Trading Plan objects, serializing to JSON then deserializing from JSON SHALL produce an equivalent Trading Plan object (round-trip property)
4. IF a trader imports an invalid or malformed JSON file, THEN THE App SHALL display a descriptive error message identifying the parsing failure and SHALL NOT modify existing plan data

### Requirement 17: Portfolio Management

**User Story:** As a trader, I want to create and manage portfolios that represent my brokerage accounts, so that I can track net liquidation value, profit/loss, and performance metrics alongside my trading plan.

#### Acceptance Criteria

1. THE App SHALL allow the trader to create one or more Portfolios, each with a name, description, and initial account balance
2. THE App SHALL allow the trader to link a Portfolio to a specific Trading Plan
3. WHEN a trader views a Portfolio, THE Portfolio_Dashboard SHALL display the current Net_Liquidation value, total Realized_PL, total Unrealized_PL, and combined total profit/loss
4. THE Portfolio_Dashboard SHALL display performance metrics including monthly returns (percentage and dollar amount), maximum Drawdown, and cumulative return over a selected time period
5. WHEN a trader views a Portfolio, THE Portfolio_Dashboard SHALL display a list of current open positions with underlying asset symbol, Option_Type, Strike_Price, Expiration_Date, quantity, entry price, current price, and per-position Unrealized_PL
6. THE Portfolio_Dashboard SHALL allow the trader to filter and sort positions by underlying asset, Option_Type, expiration date, and profit/loss status
7. WHEN a trader creates a trade journal entry, THE Trade_Journal SHALL require the trader to associate the entry with an existing Portfolio
8. WHEN a journal entry is created or updated within a Portfolio, THE Portfolio_Dashboard SHALL recalculate the Portfolio performance metrics to reflect the updated trade data
9. THE Portfolio_Dashboard SHALL display a breakdown of profit/loss by Strategy for the associated Trading Plan
10. IF a trader attempts to delete a Portfolio that has associated journal entries, THEN THE App SHALL prompt the trader to confirm deletion and warn that the Portfolio association will be removed from those journal entries
11. THE App SHALL allow the trader to view a historical chart of Net_Liquidation value and cumulative profit/loss over time for a selected Portfolio
12. THE Portfolio_Dashboard SHALL display the Portfolio win rate, average trade return, and number of trades for a selected time period

### Requirement 18: Options Dashboard

**User Story:** As a trader, I want an options dashboard that aggregates my trade journal data into premium income metrics and performance analytics, so that I can monitor my income generation and evaluate strategy effectiveness over time.

#### Acceptance Criteria

1. THE Options_Dashboard SHALL display the total Premium income earned for the current day, calculated by summing the Premium of all trades closed on the current date
2. THE Options_Dashboard SHALL display the total Premium income earned for the current week, calculated by summing the Premium of all trades closed within the current calendar week
3. THE Options_Dashboard SHALL display the total Premium income earned for the current month, calculated by summing the Premium of all trades closed within the current calendar month
4. THE Options_Dashboard SHALL display a Premium income trend chart showing daily Premium income totals over a trader-selectable time period (last 30 days, 90 days, 6 months, 1 year, or all time)
5. THE Options_Dashboard SHALL display a monthly Premium income bar chart showing total Premium income per month for the selected time period
6. THE Options_Dashboard SHALL display aggregated performance metrics including total number of trades, overall win rate percentage, total Profit/Loss, average Profit/Loss per trade, average Annualized_ROR, and average Margin_Annualized_ROR
7. THE Options_Dashboard SHALL display a performance breakdown by Strategy showing the number of trades, win rate, total Profit/Loss, and average Annualized_ROR for each Strategy
8. THE Options_Dashboard SHALL allow the trader to filter all dashboard metrics by Account (Portfolio), Strategy, Stock Symbol, Option_Type (Call or Put), and date range
9. WHEN a trade journal entry is created, updated, or deleted, THE Options_Dashboard SHALL recalculate all displayed metrics to reflect the current journal data
10. THE Options_Dashboard SHALL display the total Fees paid over the selected time period
11. THE Options_Dashboard SHALL display a cumulative Profit/Loss chart showing the running total of Profit/Loss over time for the selected filters
12. WHEN a trader views the Options_Dashboard with no journal entries matching the selected filters, THE Options_Dashboard SHALL display a message indicating no data is available for the selected criteria
