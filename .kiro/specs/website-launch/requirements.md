# Requirements Document

## Introduction

This document defines the requirements for deploying the TradingParadise application to production so that real users can access it over the internet. The application is a Vite + React 19 SPA with a Supabase backend. Deployment covers static hosting, custom domain configuration, CI/CD automation, production environment management, security (HTTPS/SSL), performance optimization (CDN, caching), and observability (monitoring, error tracking).

## Glossary

- **Hosting_Platform**: Netlify — the static site hosting service that serves the built SPA files (HTML, JS, CSS, assets) to end users over HTTP/HTTPS, with built-in CDN, deploy previews, and GitHub integration.
- **CI_CD_Pipeline**: The automated workflow that builds, tests, and deploys the application when code changes are pushed to the repository.
- **CDN**: Content Delivery Network; a geographically distributed cache layer that serves static assets from edge locations close to users.
- **Build_Artifact**: The output of `tsc -b && vite build`, located in the `dist/` folder, containing all files needed to serve the SPA.
- **Environment_Variables**: Configuration values (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) injected at build time that connect the frontend to the Supabase backend.
- **SSL_Certificate**: A TLS/SSL certificate that enables HTTPS connections between users' browsers and the Hosting_Platform.
- **Custom_Domain**: The domain `www.tradingparadise.app` (canonical) with `tradingparadise.app` (apex) redirecting to it, pointed at the Hosting_Platform via DNS records.
- **Production_Supabase_Project**: A dedicated Supabase project instance configured for production workloads, separate from any development instance.
- **Error_Tracking_Service**: A third-party service that captures, aggregates, and alerts on runtime JavaScript errors in the production application.
- **Health_Check**: An automated probe that verifies the application is accessible and responding correctly.

## Requirements

### Requirement 1: Static Site Hosting

**User Story:** As a site owner, I want the TradingParadise SPA hosted on a static hosting platform, so that users can access the application via a web browser.

#### Acceptance Criteria

1. THE Hosting_Platform SHALL serve the Build_Artifact files to users over HTTPS.
2. IF a user requests a route that does not match a file in the Build_Artifact, THEN THE Hosting_Platform SHALL return the `index.html` file with a 200 status code, enabling client-side routing.
3. WHEN a user requests a path that matches a file in the Build_Artifact, THE Hosting_Platform SHALL serve that file with a content-type header corresponding to the file's extension per standard MIME type mappings (e.g., `.js` as `application/javascript`, `.css` as `text/css`, `.html` as `text/html`).
4. THE Hosting_Platform SHALL provide a CDN with edge locations that serves cached static assets from the nearest edge location to the requesting user.
5. IF the origin server becomes unavailable, THEN THE Hosting_Platform SHALL serve a custom error page indicating service unavailability rather than returning a browser connection timeout.
6. WHEN a user makes an HTTP request, THE Hosting_Platform SHALL redirect the request to the equivalent HTTPS URL with a 301 status code.
7. THE Hosting_Platform SHALL serve the `index.html` file with a cache-control header that prevents stale caching (max-age no greater than 60 seconds or no-cache), and SHALL serve hashed asset files (filenames containing a content hash) with a long-lived cache duration of at least 1 year.

### Requirement 2: Custom Domain and DNS

**User Story:** As a site owner, I want to serve the application from a custom domain, so that users access the site at a branded, memorable URL.

#### Acceptance Criteria

1. THE Custom_Domain SHALL resolve to the Hosting_Platform via DNS records (CNAME or A/AAAA).
2. WHEN a user navigates to the Custom_Domain, THE Hosting_Platform SHALL serve the application over HTTPS with a valid, unexpired TLS certificate covering both the apex domain and the `www` subdomain, without additional redirects beyond HTTP-to-HTTPS.
3. THE Hosting_Platform SHALL redirect all HTTP requests on the Custom_Domain to HTTPS using a 301 permanent redirect.
4. WHEN a user navigates to the apex domain (`tradingparadise.app`), THE Hosting_Platform SHALL redirect to `www.tradingparadise.app` using a 301 permanent redirect.
5. WHEN a user navigates directly to a client-side route path on the Custom_Domain, THE Hosting_Platform SHALL return the SPA index document so that client-side routing resolves the path without a server-side 404 error.

### Requirement 3: SSL/HTTPS

**User Story:** As a site owner, I want all traffic encrypted with TLS, so that user data (credentials, trading information) is protected in transit.

#### Acceptance Criteria

1. THE Hosting_Platform SHALL provision and manage an SSL_Certificate for the Custom_Domain, with the certificate becoming active within 72 hours of domain configuration.
2. THE SSL_Certificate SHALL be automatically renewed at least 30 days before expiration without manual intervention.
3. THE Hosting_Platform SHALL enforce HTTPS by redirecting all HTTP requests to HTTPS with a 301 status code.
4. THE Hosting_Platform SHALL serve responses with an HSTS header with a max-age value of at least 31536000 seconds (1 year) and include the includeSubDomains directive.
5. THE Hosting_Platform SHALL reject TLS connections using protocol versions below TLS 1.2.
6. IF SSL_Certificate provisioning or renewal fails, THEN THE Hosting_Platform SHALL notify the site owner via the platform's alerting mechanism and SHALL continue serving the existing valid certificate until it expires.

### Requirement 4: Environment and Secrets Management

**User Story:** As a developer, I want production environment variables managed securely and separately from source code, so that secrets are not exposed in the repository.

#### Acceptance Criteria

1. THE CI_CD_Pipeline SHALL inject Environment_Variables at build time from a platform-provided secrets store, not from files committed to the repository.
2. WHEN building for the production environment, THE CI_CD_Pipeline SHALL supply the Production_Supabase_Project URL as VITE_SUPABASE_URL and the production anon key as VITE_SUPABASE_ANON_KEY.
3. THE CI_CD_Pipeline SHALL mask Environment_Variable values in build logs so that secret values are never printed in plaintext, while variable names may appear in diagnostic messages.
4. IF any of the required Environment_Variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) is missing or empty at build start, THEN THE CI_CD_Pipeline SHALL fail the build before compilation begins and report the name of each absent variable.
5. THE Repository SHALL exclude the .env file from version control via .gitignore so that local secrets are never committed.

### Requirement 5: CI/CD Pipeline

**User Story:** As a developer, I want automated builds and deployments triggered by code changes, so that I can ship updates without manual steps.

#### Acceptance Criteria

1. WHEN code is pushed to the main branch, THE CI_CD_Pipeline SHALL run the lint, test, and build steps in sequence.
2. IF any step in the CI_CD_Pipeline fails, THEN THE CI_CD_Pipeline SHALL halt execution of subsequent steps, set the GitHub commit status to "failure", and include the name of the failed step in the status description.
3. WHEN the build step succeeds on the main branch, THE CI_CD_Pipeline SHALL deploy the Build_Artifact from the `dist/` folder to the Hosting_Platform.
4. THE CI_CD_Pipeline SHALL complete a full build-and-deploy cycle within 5 minutes for commits that change fewer than 50 files.
5. WHEN code is pushed to a non-main branch, THE CI_CD_Pipeline SHALL run lint and test steps without deploying.
6. WHEN a pull request is opened or updated, THE CI_CD_Pipeline SHALL deploy a preview environment and post the preview deployment URL as a comment on the pull request.
7. WHEN a pull request is merged or closed, THE CI_CD_Pipeline SHALL remove the associated preview deployment.

### Requirement 6: Production Supabase Configuration

**User Story:** As a site owner, I want a dedicated production Supabase project with appropriate security settings, so that user data is isolated from development and protected by RLS policies.

#### Acceptance Criteria

1. THE Production_Supabase_Project SHALL have Row Level Security enabled on the plans, portfolios, journal_entries, reminders, and portfolio_transactions tables, with policies restricting SELECT, INSERT, UPDATE, and DELETE operations to rows where user_id matches the authenticated user.
2. THE Production_Supabase_Project SHALL apply all migrations from the `supabase/migrations/` directory in sequential order (001, 002, ...) without skipping any migration file.
3. THE Production_Supabase_Project SHALL disable the public (anon) key's ability to bypass Row Level Security and SHALL restrict direct PostgreSQL connections to the service_role key and database owner credentials only.
4. THE Production_Supabase_Project SHALL configure email/password authentication with email confirmation required before account activation, and SHALL limit sign-up and login attempts to no more than 30 requests per IP address per 5-minute window.
5. THE Production_Supabase_Project SHALL set allowed redirect URLs to `https://www.tradingparadise.app/*` only, rejecting any redirect URL that does not match the Custom_Domain origin.
6. IF a database migration fails during deployment, THEN THE CI_CD_Pipeline SHALL halt deployment, roll back the failed migration transaction so that no partial schema changes persist, and report the migration file name and error details.
7. WHEN all migrations complete successfully, THE Production_Supabase_Project SHALL verify that Row Level Security is enabled on every table containing a user_id column by querying pg_catalog and failing deployment if any such table lacks RLS enforcement.

### Requirement 7: Performance Optimization

**User Story:** As a user, I want the application to load quickly regardless of my location, so that I can access my trading tools without delay.

#### Acceptance Criteria

1. THE Hosting_Platform SHALL serve static assets (JS, CSS, images) with cache-control headers set to at least one year for hashed filenames.
2. THE Hosting_Platform SHALL serve `index.html` with a short cache duration (no-cache or max-age of 60 seconds) to ensure users receive the latest deployment.
3. THE Build_Artifact SHALL use route-based code splitting so that the initial page load transfers no more than 250 KB of compressed JavaScript for any single route.
4. THE Build_Artifact SHALL produce hashed filenames for all JS and CSS bundles to enable long-term caching.
5. THE CDN SHALL serve assets from edge locations, achieving a Time to First Byte under 200ms for users within the same continent as the nearest edge.
6. WHEN a user navigates to any route, THE Application SHALL reach a Largest Contentful Paint of under 2.5 seconds and a Time to Interactive of under 3.5 seconds on a 4G connection.

### Requirement 8: Monitoring and Error Tracking

**User Story:** As a developer, I want visibility into production errors and application health, so that I can detect and resolve issues before users report them.

#### Acceptance Criteria

1. THE Error_Tracking_Service SHALL capture unhandled JavaScript exceptions including the full stack trace, browser name and version, operating system, viewport dimensions, current route, and a session identifier that cannot be linked back to a specific user's personal information.
2. WHEN an unhandled exception occurs, THE Error_Tracking_Service SHALL group errors sharing the same stack trace signature and notify the development team via the configured alert channel within 5 minutes of the first occurrence in a new group.
3. THE Health_Check SHALL send an HTTP GET request to the application URL at intervals no greater than 5 minutes.
4. IF the Health_Check receives a non-2xx HTTP response or exceeds the 30-second response timeout for two consecutive checks, THEN THE Health_Check SHALL send an alert to the development team via the configured alert channel.
5. THE Error_Tracking_Service SHALL integrate with source maps generated by the Vite build so that minified stack traces resolve to original TypeScript file paths and line numbers.
6. THE Hosting_Platform SHALL retain access logs and bandwidth metrics for the deployed site for a minimum of 30 days.
