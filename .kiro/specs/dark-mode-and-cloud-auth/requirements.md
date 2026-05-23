# Requirements Document

## Introduction

TradingParadise is a personal trading plan and journal application built with React, Vite, TypeScript, and Tailwind CSS. It currently stores all data locally in IndexedDB via Dexie, meaning data is isolated per browser and cannot be accessed across devices.

This feature introduces two changes:

1. A permanent dark mode UI theme (no toggle, always dark).
2. Cloud-based authentication and data storage via Supabase, so a user's plans, portfolios, journal entries, reminders, and transactions are accessible from any browser after signing in.

## Glossary

- **App**: The TradingParadise web application
- **Auth_Module**: The authentication subsystem responsible for sign-up, sign-in, sign-out, session management, and password reset via Supabase Auth
- **Supabase_Client**: The initialized Supabase JavaScript client used by the App to communicate with Supabase services (Auth, Database)
- **Data_Layer**: The repository modules that perform CRUD operations on user data (plans, portfolios, journal entries, reminders, transactions)
- **Router_Guard**: The route protection logic that checks authentication state before rendering protected pages
- **RLS_Policy**: Row Level Security policies configured in Supabase Postgres that restrict data access to the owning user
- **User**: A person who has registered an account and can sign in to the App
- **Session**: An active authenticated state maintained by Supabase Auth after a successful sign-in

## Requirements

### Requirement 1: Dark Mode Theme

**User Story:** As a user, I want the application to have a dark background and appropriately contrasted text and UI elements, so that the interface is comfortable for extended use.

#### Acceptance Criteria

1. THE App SHALL render all pages with a dark background color (e.g., gray-900 or darker) and light foreground text (e.g., gray-100)
2. THE App SHALL apply dark-appropriate colors to all interactive elements including buttons, inputs, cards, modals, and navigation components
3. THE App SHALL maintain a minimum contrast ratio of 4.5:1 between text and background colors for WCAG AA compliance
4. THE App SHALL apply the dark theme globally without providing a light mode toggle

### Requirement 2: Supabase Client Initialization

**User Story:** As a developer, I want a configured Supabase client available throughout the application, so that all modules can interact with Supabase Auth and Database services.

#### Acceptance Criteria

1. THE Supabase_Client SHALL be initialized with the project URL and anonymous key read from environment variables
2. THE Supabase_Client SHALL be a singleton instance shared across the application
3. IF the environment variables for Supabase URL or anonymous key are missing, THEN THE App SHALL fail to start and log a descriptive error message

### Requirement 3: User Registration

**User Story:** As a new user, I want to create an account with my email and a password, so that I can store my trading data in the cloud.

#### Acceptance Criteria

1. WHEN a user submits valid email and password on the sign-up form, THE Auth_Module SHALL create a new account via Supabase Auth
2. WHEN registration succeeds, THE Auth_Module SHALL establish a Session and redirect the user to the main dashboard
3. IF registration fails due to an already-registered email, THEN THE Auth_Module SHALL display an error message indicating the email is already in use
4. IF registration fails due to a weak password, THEN THE Auth_Module SHALL display an error message describing the password requirements
5. THE Auth_Module SHALL require a password of at least 8 characters

### Requirement 4: User Sign-In

**User Story:** As a returning user, I want to sign in with my email and password, so that I can access my trading data from any browser.

#### Acceptance Criteria

1. WHEN a user submits valid credentials on the sign-in form, THE Auth_Module SHALL authenticate the user via Supabase Auth and establish a Session
2. WHEN sign-in succeeds, THE Auth_Module SHALL redirect the user to the main dashboard
3. IF sign-in fails due to invalid credentials, THEN THE Auth_Module SHALL display an error message indicating the email or password is incorrect
4. THE Auth_Module SHALL persist the Session across page reloads using Supabase's built-in token storage

### Requirement 5: User Sign-Out

**User Story:** As a signed-in user, I want to sign out, so that my account is not accessible to others on a shared device.

#### Acceptance Criteria

1. WHEN a user triggers sign-out, THE Auth_Module SHALL terminate the current Session via Supabase Auth
2. WHEN sign-out completes, THE Router_Guard SHALL redirect the user to the sign-in page
3. WHEN sign-out completes, THE App SHALL clear any cached user data from application state

### Requirement 6: Password Reset

**User Story:** As a user who has forgotten my password, I want to request a password reset email, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user submits their email on the password reset form, THE Auth_Module SHALL send a password reset email via Supabase Auth
2. WHEN the reset email request succeeds, THE Auth_Module SHALL display a confirmation message instructing the user to check their inbox
3. WHEN a user follows the reset link and submits a new password, THE Auth_Module SHALL update the password and redirect to the sign-in page
4. IF the submitted email does not match any account, THEN THE Auth_Module SHALL still display the confirmation message to prevent email enumeration

### Requirement 7: Protected Routes

**User Story:** As a product owner, I want unauthenticated users to be unable to access application pages, so that data is only visible to signed-in users.

#### Acceptance Criteria

1. WHILE no active Session exists, THE Router_Guard SHALL redirect all application routes to the sign-in page
2. WHILE an active Session exists, THE Router_Guard SHALL allow access to all application routes
3. WHEN a Session expires or becomes invalid, THE Router_Guard SHALL redirect the user to the sign-in page
4. THE Router_Guard SHALL allow unauthenticated access to the sign-in, sign-up, and password reset pages

### Requirement 8: Cloud Data Storage

**User Story:** As a user, I want my trading plans, portfolios, journal entries, reminders, and transactions stored in the cloud, so that I can access them from any browser where I sign in.

#### Acceptance Criteria

1. THE Data_Layer SHALL store and retrieve plans, portfolios, journal entries, reminders, and portfolio transactions from Supabase Postgres tables
2. THE Data_Layer SHALL associate every created record with the authenticated user's ID
3. WHEN a user performs a CRUD operation, THE Data_Layer SHALL execute the corresponding Supabase query using the authenticated client
4. THE Data_Layer SHALL preserve the existing data schema (field names and types) when storing records in Supabase tables

### Requirement 9: Row Level Security

**User Story:** As a user, I want my data to be inaccessible to other users, so that my trading information remains private.

#### Acceptance Criteria

1. THE RLS_Policy SHALL restrict SELECT operations to rows where the user_id column matches the authenticated user's ID
2. THE RLS_Policy SHALL restrict INSERT operations so that the user_id column is set to the authenticated user's ID
3. THE RLS_Policy SHALL restrict UPDATE operations to rows where the user_id column matches the authenticated user's ID
4. THE RLS_Policy SHALL restrict DELETE operations to rows where the user_id column matches the authenticated user's ID
5. THE RLS_Policy SHALL be enabled on all data tables: plans, portfolios, journal_entries, reminders, and portfolio_transactions

### Requirement 10: Auth State Listener

**User Story:** As a user, I want the application to react to authentication state changes in real time, so that sign-in and sign-out from other tabs are reflected without a manual refresh.

#### Acceptance Criteria

1. THE Auth_Module SHALL subscribe to Supabase Auth state change events on application mount
2. WHEN an auth state change event indicates sign-out, THE App SHALL clear application state and redirect to the sign-in page
3. WHEN an auth state change event indicates a new Session, THE App SHALL update the authenticated user context

### Requirement 11: Loading and Error States

**User Story:** As a user, I want clear feedback while authentication and data operations are in progress, so that I understand what the application is doing.

#### Acceptance Criteria

1. WHILE the Auth_Module is verifying an existing Session on page load, THE App SHALL display a loading indicator
2. WHILE a sign-in or sign-up request is in progress, THE Auth_Module SHALL disable the submit button and display a loading state
3. IF a data operation fails due to a network error, THEN THE Data_Layer SHALL display an error message to the user
