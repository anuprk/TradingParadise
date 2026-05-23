# Implementation Plan: Dark Mode & Cloud Auth

## Overview

This plan implements a permanent dark theme via Tailwind CSS v4 custom properties and replaces the local Dexie/IndexedDB data layer with Supabase (Postgres + Auth + RLS). The existing repository pattern is preserved as the public API while internals switch to Supabase queries. A new Zustand auth store manages session lifecycle, and a route guard protects application pages.

## Tasks

- [x] 1. Dark mode theme and Supabase client setup
  - [x] 1.1 Define dark mode CSS custom properties and update global styles
    - Add `@theme` block to `src/index.css` with dark color tokens (surface-primary, surface-secondary, surface-tertiary, text-primary, text-secondary, text-accent, border, input-bg, success, error, warning)
    - Set `html` and `body` background to `surface-primary` and text to `text-primary`
    - Update `tailwind.config` or Tailwind v4 config to recognize the custom color tokens
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Update layout components to use dark theme tokens
    - Update `AppShell.tsx`, `Header.tsx`, `Sidebar.tsx` to use `bg-surface-secondary`, `text-text-primary`, `border-border` etc.
    - Update buttons, inputs, cards, and modals across the component tree to use the new color tokens
    - Ensure minimum 4.5:1 contrast ratio for text elements
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.3 Install `@supabase/supabase-js` and create Supabase client module
    - Run `npm install @supabase/supabase-js`
    - Create `src/lib/supabase.ts` with singleton client initialized from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
    - Throw descriptive error if env vars are missing
    - Add `.env.example` with placeholder values for the two variables
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Auth store and auth UI pages
  - [x] 2.1 Implement auth store with Zustand
    - Create `src/stores/authStore.ts` with `AuthState` interface (user, session, isLoading, error)
    - Implement `initialize()` — calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange`
    - Implement `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `resetPassword(email)`, `updatePassword(newPassword)`
    - Implement `clearError()` helper
    - Add `mapAuthError()` utility for user-friendly error messages
    - On sign-out, clear app store user data (plans, portfolios, journal entries, reminders, transactions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 10.1, 10.2, 10.3_

  - [x] 2.2 Create password validation utility
    - Create `src/utils/validation.ts` with `validatePassword(password: string): boolean` (minimum 8 characters)
    - Use in sign-up and update-password forms for client-side validation
    - _Requirements: 3.5_

  - [x] 2.3 Write property test for password validation boundary (Property 1)
    - **Property 1: Password validation boundary**
    - Generate random strings (0–100 chars) with fast-check, assert validation result matches `length >= 8`
    - **Validates: Requirements 3.5**

  - [x] 2.4 Create LoginPage component
    - Create `src/pages/LoginPage.tsx` with email + password form
    - Wire to `authStore.signIn`, display inline errors from `authStore.error`
    - Show loading state on submit button while request is in progress
    - Redirect to `/` if session already exists
    - Link to sign-up and reset-password pages
    - _Requirements: 4.1, 4.2, 4.3, 11.2_

  - [x] 2.5 Create SignupPage component
    - Create `src/pages/SignupPage.tsx` with email + password + confirm password form
    - Wire to `authStore.signUp`, validate password client-side before submission
    - Display inline errors, loading state on submit
    - Redirect to `/` if session already exists
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.2_

  - [x] 2.6 Create ResetPasswordPage and UpdatePasswordPage components
    - Create `src/pages/ResetPasswordPage.tsx` — email input, calls `authStore.resetPassword`, shows confirmation message
    - Create `src/pages/UpdatePasswordPage.tsx` — new password input, calls `authStore.updatePassword`, redirects to login on success
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 3. Checkpoint - Verify auth store and UI pages
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Route guard and router restructure
  - [x] 4.1 Create ProtectedRoute component
    - Create `src/components/auth/ProtectedRoute.tsx`
    - Read `user` and `isLoading` from `authStore`
    - If `isLoading`, render full-page spinner
    - If `user` is null, redirect to `/login`
    - Otherwise render `children`
    - _Requirements: 7.1, 7.2, 7.3, 11.1_

  - [x] 4.2 Restructure router with public and protected routes
    - Add public routes: `/login`, `/signup`, `/reset-password`, `/update-password`
    - Wrap existing app routes in `ProtectedRoute`
    - Call `authStore.initialize()` on app mount (in `App.tsx` or root layout)
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 4.3 Write property test for route guard access (Property 3)
    - **Property 3: Route guard access is determined by session existence**
    - Generate random route paths from the protected set, assert redirect/render based on session presence
    - **Validates: Requirements 7.1, 7.2**

  - [x] 4.4 Write property test for sign-out clearing state (Property 2)
    - **Property 2: Sign-out clears all user-specific state**
    - Generate random user state objects with fast-check, call sign-out logic, assert all fields reset to initial values
    - **Validates: Requirements 5.3**

- [x] 5. Supabase SQL migrations
  - [x] 5.1 Create SQL migration for all data tables
    - Write `supabase/migrations/001_create_tables.sql` (or equivalent path)
    - Define `plans`, `portfolios`, `journal_entries`, `reminders`, `portfolio_transactions` tables with all columns per design
    - All tables include `user_id UUID NOT NULL DEFAULT auth.uid()` with FK to `auth.users(id)`
    - Add appropriate indexes on `user_id` and commonly queried columns
    - _Requirements: 8.1, 8.4_

  - [x] 5.2 Create SQL migration for RLS policies
    - Write `supabase/migrations/002_rls_policies.sql`
    - Enable RLS on all five tables
    - Create SELECT, INSERT, UPDATE, DELETE policies on each table restricting access to `auth.uid() = user_id`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6. Data layer migration — replace Dexie repositories with Supabase
  - [x] 6.1 Refactor planRepository to use Supabase
    - Replace Dexie calls in `src/db/planRepository.ts` with Supabase queries
    - Maintain existing function signatures (createPlan, listPlans, getPlan, updatePlan, deletePlan)
    - Set `user_id` from authenticated user on inserts
    - Propagate errors with descriptive messages for toast display
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3_

  - [x] 6.2 Refactor portfolioRepository to use Supabase
    - Replace Dexie calls in `src/db/portfolioRepository.ts` with Supabase queries
    - Maintain existing function signatures
    - Set `user_id` on inserts, propagate errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3_

  - [x] 6.3 Refactor journalRepository to use Supabase
    - Replace Dexie calls in `src/db/journalRepository.ts` with Supabase queries
    - Maintain existing function signatures
    - Set `user_id` on inserts, propagate errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3_

  - [x] 6.4 Refactor reminderRepository to use Supabase
    - Replace Dexie calls in the reminder repository with Supabase queries
    - Maintain existing function signatures
    - Set `user_id` on inserts, propagate errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3_

  - [x] 6.5 Refactor transactionRepository to use Supabase
    - Replace Dexie calls in `src/db/transactionRepository.ts` with Supabase queries
    - Maintain existing function signatures
    - Set `user_id` on inserts, propagate errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 11.3_

  - [x] 6.6 Write property test for user ID on create (Property 4)
    - **Property 4: Every created record includes the authenticated user's ID**
    - Generate random record data with fast-check, mock auth user, call create functions, assert `user_id` in insert payload matches authenticated user
    - **Validates: Requirements 8.2**

  - [x] 6.7 Write property test for data round-trip preservation (Property 5)
    - **Property 5: Data schema round-trip preservation**
    - Generate random valid record objects, mock Supabase insert/select, assert field equality after store-then-retrieve (accounting for Date/ISO serialization)
    - **Validates: Requirements 8.4**

  - [x] 6.8 Write property test for network error surfacing (Property 6)
    - **Property 6: Network errors surface as user-visible error messages**
    - Generate random operation types with fast-check, mock network failure on Supabase client, assert toast is dispatched with error message
    - **Validates: Requirements 11.3**

- [x] 7. Checkpoint - Verify data layer and auth integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integration wiring and final cleanup
  - [x] 8.1 Wire auth state into existing app stores
    - Update app store actions to handle errors from repository calls by dispatching toasts
    - Ensure sign-out triggers clearing of all cached data in app stores
    - Verify `onAuthStateChange` subscription handles token refresh failures and cross-tab sign-out
    - _Requirements: 5.3, 10.1, 10.2, 10.3, 11.3_

  - [x] 8.2 Remove Dexie dependency and clean up unused code
    - Remove `dexie` from `package.json` dependencies
    - Delete or archive the Dexie database configuration file
    - Remove any IndexedDB initialization code
    - _Requirements: 8.1_

  - [x] 8.3 Write integration tests for auth flow and data access
    - Test sign-up → sign-in → sign-out cycle with mocked Supabase
    - Test that ProtectedRoute redirects unauthenticated users and renders for authenticated users
    - Test repository error handling displays toast messages
    - _Requirements: 4.1, 5.1, 7.1, 7.2, 11.3_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No data migration from IndexedDB is provided — cloud users start fresh per design decision
- The Supabase SQL migrations (task 5) can be applied via the Supabase CLI or dashboard

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "5.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "5.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5"] },
    { "id": 5, "tasks": ["6.6", "6.7", "6.8"] },
    { "id": 6, "tasks": ["8.1", "8.2"] },
    { "id": 7, "tasks": ["8.3"] }
  ]
}
```
