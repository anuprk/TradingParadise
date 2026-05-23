# Requirements Document

## Introduction

Portfolio Management extends the TradingParadise app with the ability to create and manage multiple brokerage portfolios, import transactions from PDF statements (tastytrade and Fidelity formats) and CSV files, de-duplicate imported transactions, and view portfolio holdings and transaction history with summary performance indicators.

## Glossary

- **Portfolio_Manager**: The component responsible for creating, listing, editing, and deleting portfolios
- **Transaction_Importer**: The component responsible for parsing uploaded files (PDF or CSV) and extracting transaction records
- **Transaction**: A single trade or account activity record extracted from a statement (buy, sell, dividend, fee, transfer, etc.)
- **Holding**: A current position in a security derived from aggregating open transactions within a portfolio
- **De-duplication_Engine**: The logic that identifies and prevents duplicate transactions from being imported
- **Tastytrade_Parser**: The parser that extracts transactions from tastytrade monthly PDF statements
- **Fidelity_Parser**: The parser that extracts transactions from Fidelity account PDF statements
- **CSV_Parser**: The parser that extracts transactions from CSV files following a defined column schema
- **Portfolio_Dashboard**: The detail view for a single portfolio showing summary metrics, holdings, and transactions
- **Performance_Summary**: The computed metrics displayed at the top of a portfolio dashboard (total value, P/L, win rate, etc.)
- **Transaction_Fingerprint**: A composite key derived from transaction attributes (date, symbol, type, quantity, price) used for de-duplication

## Requirements

### Requirement 1: Multiple Portfolio Creation

**User Story:** As a trader, I want to create multiple portfolios, so that I can track different brokerage accounts or strategies separately.

#### Acceptance Criteria

1. THE Portfolio_Manager SHALL allow the user to create a new portfolio with a name (1 to 100 characters), an optional description (up to 500 characters), and an initial balance (a dollar amount from 0.00 to 999,999,999.99)
2. THE Portfolio_Manager SHALL display all portfolios for the active trading plan in a list or grid view, showing each portfolio's name, description, and initial balance
3. THE Portfolio_Manager SHALL allow the user to edit the name, description, and initial balance of an existing portfolio
4. THE Portfolio_Manager SHALL allow the user to delete a portfolio after the user confirms the action through a confirmation dialog that warns about permanent data removal
5. WHEN a portfolio is deleted, THE Portfolio_Manager SHALL remove all associated journal entries from the local database
6. IF a user attempts to create or edit a portfolio with an empty or whitespace-only name, THEN THE Portfolio_Manager SHALL display a validation error and prevent the save
7. IF a user attempts to create a portfolio with a name that already exists within the same trading plan, THEN THE Portfolio_Manager SHALL display a validation error indicating the name must be unique

### Requirement 2: PDF Statement Upload

**User Story:** As a trader, I want to upload PDF brokerage statements, so that I can import my transaction history without manual data entry.

#### Acceptance Criteria

1. WHEN the user selects a PDF file, THE Transaction_Importer SHALL accept files with a .pdf extension and a maximum size of 10MB
2. WHEN a PDF file is uploaded, THE Transaction_Importer SHALL detect whether the file is in tastytrade or Fidelity format
3. IF the PDF format is not recognized, THEN THE Transaction_Importer SHALL display an error message indicating the supported formats (tastytrade and Fidelity)
4. WHEN a valid tastytrade PDF is uploaded, THE Tastytrade_Parser SHALL extract all transaction records including date, symbol, description, quantity, price, and fees
5. WHEN a valid Fidelity PDF is uploaded, THE Fidelity_Parser SHALL extract all transaction records including date, symbol, description, quantity, price, and fees
6. IF a PDF file cannot be parsed due to corruption or unexpected structure, THEN THE Transaction_Importer SHALL display an error message indicating the nature of the parsing failure and SHALL NOT import partial data
7. WHEN extraction completes successfully, THE Transaction_Importer SHALL display the extracted records in a preview list showing the total count of records found and allow the trader to confirm or cancel the import before persisting data
8. IF a valid PDF in a recognized format contains zero transaction records, THEN THE Transaction_Importer SHALL display a message indicating that no transactions were found in the uploaded file
9. IF a transaction record in the PDF is missing one or more required fields (date, symbol, quantity, or price), THEN THE Transaction_Importer SHALL exclude that record from the import, include it in a skipped-records summary shown to the trader, and indicate which fields were missing

### Requirement 3: CSV File Upload

**User Story:** As a trader, I want to upload CSV transaction files, so that I can import transactions exported from any broker.

#### Acceptance Criteria

1. WHEN the user selects a file for import, THE CSV_Parser SHALL accept only files with a .csv extension and a file size of 10 MB or less
2. IF the user selects a file that does not have a .csv extension or exceeds 10 MB, THEN THE CSV_Parser SHALL display an error message indicating the file was rejected and the reason for rejection
3. WHEN a CSV file is uploaded, THE CSV_Parser SHALL parse the file using the first row as column headers and extract transaction records by matching headers to supported field mappings
4. THE CSV_Parser SHALL support column mappings for: Stock Symbol, Open Date, Expiration Date, Option Type (Call or Put), Direction (Buy or Sell), Stock Price DOC, Strike Price, Premium, Contracts, Cash Reserve, Margin Cash Reserve, Fees, Exit Price, Close Date, Profit/Loss, Win/Loss, Days Held, Annualized ROR, Margin Annualized ROR, Status, Account, Strategy, and Notes
5. THE CSV_Parser SHALL require at minimum the Stock Symbol and Open Date columns to be present in the CSV header row for parsing to proceed
6. IF the required columns (Stock Symbol and Open Date) are missing from the CSV header row, THEN THE CSV_Parser SHALL display an error listing the missing required columns and SHALL NOT import any rows
7. IF a row contains a missing or unparseable Stock Symbol or an invalid Open Date (not a recognizable date format), THEN THE CSV_Parser SHALL skip the row and add an entry to the error summary identifying the row number and the reason for skipping
8. WHEN parsing is complete, THE CSV_Parser SHALL display a preview showing the count of successfully parsed entries, the count of skipped rows, the count of errors, and the total row count before the trader confirms the import

### Requirement 4: Transaction De-duplication

**User Story:** As a trader, I want the import process to detect duplicate transactions, so that I do not accidentally import the same statement twice.

#### Acceptance Criteria

1. WHEN transactions are imported, THE De-duplication_Engine SHALL compute a Transaction_Fingerprint for each transaction using the combination of Open Date, Stock Symbol, Option_Type, direction, Strike_Price, and Premium
2. WHEN a Transaction_Fingerprint matches an existing transaction in the same Portfolio, THE De-duplication_Engine SHALL flag the transaction as a duplicate and exclude it from the set of transactions to be imported
3. WHEN the import preview is displayed, THE Transaction_Importer SHALL display the count of duplicates detected and list each duplicate transaction with its Stock Symbol, Open Date, and Strike_Price
4. THE Transaction_Importer SHALL exclude duplicate transactions from the import by default
5. WHEN the trader reviews the import preview, THE Transaction_Importer SHALL allow the trader to override individual duplicate detections by selecting specific flagged transactions for inclusion before confirming the import
6. FOR ALL valid Transaction objects, computing the Transaction_Fingerprint then comparing it to itself SHALL always identify it as a duplicate (fingerprint consistency property)
7. WHEN comparing numeric fields for fingerprint matching, THE De-duplication_Engine SHALL treat Premium and Strike_Price values as equal if they match to 2 decimal places

### Requirement 5: Import Preview and Confirmation

**User Story:** As a trader, I want to preview imported transactions before they are saved, so that I can verify the data is correct.

#### Acceptance Criteria

1. WHEN a file is parsed, THE Transaction_Importer SHALL display a preview showing the total number of transactions, the count of duplicates detected, and the count of errors encountered
2. WHILE the preview is displayed, THE Transaction_Importer SHALL display a table of parsed transactions with date, symbol, type, quantity, price, and fees columns, showing a maximum of 50 rows at a time with pagination controls when the total exceeds 50
3. WHILE the preview is displayed, THE Transaction_Importer SHALL visually distinguish duplicate transactions and error rows from valid transactions in the preview table
4. THE Transaction_Importer SHALL allow the user to confirm or cancel the import from the preview screen
5. WHEN the user cancels the import, THE Transaction_Importer SHALL discard all parsed data and return to the file upload screen without modifying the portfolio
6. WHEN the user confirms the import, THE Transaction_Importer SHALL save all non-duplicate transactions to the portfolio
7. IF a save operation fails during import, THEN THE Transaction_Importer SHALL display an error message indicating how many transactions were saved before the failure and SHALL NOT discard the successfully saved transactions
8. WHEN the import is complete, THE Transaction_Importer SHALL display a success message with the count of transactions imported

### Requirement 6: Portfolio Holdings View

**User Story:** As a trader, I want to see my current holdings in a portfolio, so that I can understand my open positions at a glance.

#### Acceptance Criteria

1. THE Portfolio_Dashboard SHALL display a Holdings tab showing all open positions in the portfolio
2. WHILE the Holdings tab is active, THE Portfolio_Dashboard SHALL display each holding with symbol, quantity, average cost basis per unit, current value (calculated as quantity multiplied by the current price per unit), and unrealized P/L (calculated as current value minus total cost basis), sorted by symbol in alphabetical ascending order
3. THE Portfolio_Dashboard SHALL compute holdings by aggregating all trade journal entries with a Trade_Status of Open for each symbol, where net quantity equals the sum of Buy quantities minus the sum of Sell quantities, and average cost basis per unit equals the total cost of Buy transactions divided by the total Buy quantity (weighted average method)
4. IF a position has a net quantity of zero, THEN THE Portfolio_Dashboard SHALL exclude it from the Holdings tab
5. WHEN a trader views the Holdings tab and no open positions exist in the portfolio, THE Portfolio_Dashboard SHALL display a message indicating that no holdings are currently held

### Requirement 7: Portfolio Transactions View

**User Story:** As a trader, I want to see all transactions in a portfolio, so that I can review my complete trading history.

#### Acceptance Criteria

1. THE Portfolio_Dashboard SHALL display a Transactions tab showing all trade journal entries associated with the selected Portfolio
2. WHEN the Transactions tab is active, THE Portfolio_Dashboard SHALL display each trade journal entry with Open Date, Stock Symbol, Option_Type (Call or Put), direction (Buy or Sell), Strike_Price, Premium, Fees, Profit/Loss, and Trade_Status
3. THE Portfolio_Dashboard SHALL sort transactions by Open Date in descending order by default
4. THE Portfolio_Dashboard SHALL allow the trader to sort transactions by any displayed column in ascending or descending order
5. THE Portfolio_Dashboard SHALL allow the trader to filter transactions by Stock Symbol, Open Date range (start date and end date), Option_Type (Call or Put), and Trade_Status (Open, Closed, Expired, or Assigned)
6. IF the transaction count for the selected Portfolio exceeds 50 records, THEN THE Portfolio_Dashboard SHALL display pagination controls allowing navigation between pages of 50 records each
7. IF no trade journal entries exist for the selected Portfolio or the active filters produce no results, THEN THE Portfolio_Dashboard SHALL display a message indicating no transactions are available for the current view

### Requirement 8: Portfolio Performance Summary

**User Story:** As a trader, I want to see performance indicators at the top of my portfolio, so that I can quickly assess how my portfolio is performing.

#### Acceptance Criteria

1. THE Performance_Summary SHALL display at the top of the Portfolio_Dashboard above the Holdings and Transactions tabs
2. THE Performance_Summary SHALL show the following metrics: total portfolio value (calculated as initial account balance plus total Realized_PL plus total Unrealized_PL), total Realized_PL (sum of Profit/Loss from all closed journal entries in the Portfolio), total Unrealized_PL (sum of unrealized P/L from all open journal entries in the Portfolio), overall return percentage (calculated as total P/L divided by initial account balance multiplied by 100), and win rate (calculated as the number of closed trades with positive Profit/Loss divided by the total number of closed trades in the Portfolio multiplied by 100)
3. WHEN trade journal entries are added, updated, or removed for the Portfolio, THE Performance_Summary SHALL recalculate all metrics to reflect the current set of journal entries
4. THE Performance_Summary SHALL color-code P/L values and overall return percentage with green for positive values, red for negative values, and neutral styling (no color emphasis) for zero values
5. IF the Portfolio has no associated journal entries, THEN THE Performance_Summary SHALL display all monetary metrics as $0.00, overall return percentage as 0.0%, and win rate as 0.0%

### Requirement 9: Tastytrade PDF Parser

**User Story:** As a tastytrade user, I want the app to correctly parse my monthly statements, so that all my transactions are imported accurately.

#### Acceptance Criteria

1. THE Tastytrade_Parser SHALL identify and extract transactions from the "Account Activity" or "Transaction History" section of tastytrade monthly PDF statements by locating the section header text within the PDF content
2. THE Tastytrade_Parser SHALL parse each transaction row and map it to a TradeJournalEntry containing: trade date (as openDate), settlement date (as closeDate for closed trades), symbol (as stockSymbol), description, quantity, price (as premium), amount (as profitLoss), and fees
3. WHEN a transaction row contains an options contract description, THE Tastytrade_Parser SHALL extract the underlying symbol, expiration date, strike price, and option type (Call or Put) by parsing the tastytrade options description format (e.g., symbol followed by expiration, strike, and C/P indicator)
4. THE Tastytrade_Parser SHALL correctly classify and parse stock transactions, ETF transactions, and options transactions, producing a valid TradeJournalEntry for each with the appropriate optionType, strikePrice, and expirationDate fields populated for options or left at default values for stock and ETF trades
5. IF a transaction row cannot be parsed due to missing required fields or unrecognized format, THEN THE Tastytrade_Parser SHALL skip the row and add it to the error list with the row content and reason for failure
6. IF the PDF does not contain a recognizable "Account Activity" or "Transaction History" section header, THEN THE Tastytrade_Parser SHALL return an empty transaction list and an error indicating that no valid transaction section was found
7. THE Tastytrade_Parser SHALL skip non-transaction rows such as section subtotals, page headers, page footers, and blank rows without adding them to the error list
8. FOR ALL valid tastytrade PDF content, parsing then formatting back to a normalized TradeJournalEntry record then parsing again SHALL produce a set of transactions with identical field values for stockSymbol, openDate, optionType, strikePrice, expirationDate, premium, fees, and profitLoss (round-trip property)

### Requirement 10: Fidelity PDF Parser

**User Story:** As a Fidelity user, I want the app to correctly parse my account statements, so that all my transactions are imported accurately.

#### Acceptance Criteria

1. THE Fidelity_Parser SHALL extract transactions from the "Transaction Detail" section of Fidelity brokerage account PDF statements by identifying the section header and parsing all subsequent transaction rows until the next section boundary or end of document
2. THE Fidelity_Parser SHALL parse each transaction row to extract: date (in MM/DD/YYYY format as used by Fidelity statements), action (e.g., "YOU BOUGHT", "YOU SOLD", "REINVESTMENT", "DIVIDEND"), symbol (ticker), description (full transaction description text), quantity (number of shares or contracts), price (per-share or per-contract price as a decimal number), amount (total transaction dollar value), and fees (commission and transaction fees as a decimal number, defaulting to 0 if absent)
3. THE Fidelity_Parser SHALL map parsed transactions to TradeJournalEntry records as follows: stock purchases and sales map with direction derived from the action field, options transactions map with Option_Type and Strike_Price extracted from the description field, and dividends map as entries with a premium equal to the amount and quantity of 0
4. IF a transaction row cannot be parsed due to unrecognized format or missing required fields (date, action, or amount), THEN THE Fidelity_Parser SHALL skip the row and add it to the error list with the raw row text content and a reason string identifying which field failed parsing
5. IF the PDF contains transaction types not recognized as stock purchases, sales, dividends, or options transactions, THEN THE Fidelity_Parser SHALL skip those rows and include them in the error list with reason "unsupported transaction type"
6. FOR ALL valid Fidelity PDF content, parsing to a set of TradeJournalEntry records then serializing those records to normalized field values then parsing the normalized values again SHALL produce a set of TradeJournalEntry records where all numeric fields match within 0.01 tolerance and all date and string fields match exactly

### Requirement 11: Tab Navigation in Portfolio Dashboard

**User Story:** As a trader, I want to switch between Holdings and Transactions views using tabs, so that I can easily navigate between different aspects of my portfolio.

#### Acceptance Criteria

1. THE Portfolio_Dashboard SHALL display two tabs labeled "Holdings" and "Transactions" below the Performance_Summary, where "Holdings" displays the list of current open positions and "Transactions" displays the trade journal entries associated with the selected Portfolio
2. WHEN the user clicks a tab, THE Portfolio_Dashboard SHALL display the corresponding tab content and visually distinguish the active tab from the inactive tab using a different visual style (e.g., border, background, or font weight)
3. WHEN the Portfolio_Dashboard is first opened, THE Portfolio_Dashboard SHALL display the Holdings tab as active with its content visible
4. WHEN the Performance_Summary metrics update, THE Portfolio_Dashboard SHALL preserve the currently active tab selection and continue displaying the same tab content
5. THE Portfolio_Dashboard SHALL support tab activation via keyboard navigation (Tab key to focus, Enter or Space key to activate)
