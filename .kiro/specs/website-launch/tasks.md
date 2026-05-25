# Implementation Plan: Website Launch

## Overview

Deploy TradingParadise to production on Netlify at `www.tradingparadise.app` with CI/CD via GitHub Actions, Sentry error tracking, route-based code splitting, production Supabase configuration, and UptimeRobot health checks.

## Tasks

- [x] 1. Create Netlify configuration and hosting setup
  - [x] 1.1 Create `netlify.toml` at repository root
    - Define build command (`npm run build`) and publish directory (`dist`)
    - Add SPA fallback rewrite: `/*` → `/index.html` with status 200
    - Add security headers for `index.html`: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Cache-Control no-cache
    - Add immutable cache headers for `/assets/*` (max-age 1 year)
    - _Requirements: 1.2, 1.6, 1.7, 2.5, 3.4_

- [x] 2. Set up GitHub Actions CI/CD pipeline
  - [x] 2.1 Create `.github/workflows/deploy.yml`
    - Define `ci` job: checkout, setup Node 20 with npm cache, `npm ci`, lint, test, env var validation, build with secrets
    - Define `deploy-production` job: runs on push to main after CI passes, builds and deploys to Netlify with `nwtgck/actions-netlify@v3`
    - Define `deploy-preview` job: runs on pull requests after CI passes, deploys preview and posts URL as PR comment
    - Env var validation step must fail the build if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing
    - Pass `VITE_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` to build steps
    - _Requirements: 4.1, 4.2, 4.4, 5.1, 5.2, 5.3, 5.5, 5.6_

- [x] 3. Integrate Sentry error tracking
  - [x] 3.1 Install Sentry packages
    - Add `@sentry/react` and `@sentry/vite-plugin` as dependencies
    - _Requirements: 8.1, 8.5_

  - [x] 3.2 Create Sentry initialization module at `src/lib/sentry.ts`
    - Call `Sentry.init()` with DSN from `import.meta.env.VITE_SENTRY_DSN`
    - Set environment to `import.meta.env.MODE`
    - Add `browserTracingIntegration()` and `replayIntegration({ maskAllText: true, blockAllMedia: true })`
    - Set `tracesSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`
    - Add `beforeSend` hook to strip PII (email, username) from events
    - _Requirements: 8.1, 8.2_

  - [x] 3.3 Initialize Sentry in `src/main.tsx`
    - Import and call the Sentry init module before rendering the React tree
    - _Requirements: 8.1_

  - [x] 3.4 Add Sentry Vite plugin to `vite.config.ts`
    - Import `sentryVitePlugin` from `@sentry/vite-plugin`
    - Enable source maps in build config (`build.sourcemap: true`)
    - Configure plugin with org, project, and `process.env.SENTRY_AUTH_TOKEN`
    - _Requirements: 8.5_

- [x] 4. Checkpoint - Verify build and Sentry integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement route-based code splitting
  - [x] 5.1 Refactor `src/App.tsx` to use React lazy loading
    - Replace eager imports of page components with `lazy(() => import('./pages/...'))` calls
    - Wrap route rendering in `<Suspense>` with a loading fallback
    - Keep shell components (AppShell, Header, Sidebar, auth logic) as eager imports
    - _Requirements: 7.3_

- [x] 6. Update environment variable configuration
  - [x] 6.1 Update `.env.example` with all required variables
    - Add `VITE_SENTRY_DSN` placeholder
    - Document each variable's purpose with comments
    - _Requirements: 4.5_

  - [x] 6.2 Add TypeScript env type declarations
    - Create or update `src/vite-env.d.ts` to declare `ImportMetaEnv` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SENTRY_DSN`
    - _Requirements: 4.1, 4.2_

- [x] 7. Checkpoint - Verify full build with code splitting
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- DNS configuration (CNAME for www, A record for apex) must be done manually at the domain registrar per the design document
- Netlify site creation and custom domain setup are done via the Netlify dashboard
- GitHub repository secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `SENTRY_AUTH_TOKEN`) must be configured manually in GitHub Settings → Secrets
- Production Supabase project provisioning (RLS, email confirmation, rate limiting, redirect URLs) is configured via the Supabase dashboard per Requirement 6
- UptimeRobot health check setup (5-min interval, 2-failure alerting, SSL monitoring) is configured via the UptimeRobot dashboard per Requirement 8.3/8.4
- No property-based tests are included — this feature is infrastructure/configuration work with no pure functions to test

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["2.1", "3.2", "6.1"] },
    { "id": 2, "tasks": ["3.3", "3.4", "6.2"] },
    { "id": 3, "tasks": ["5.1"] }
  ]
}
```
