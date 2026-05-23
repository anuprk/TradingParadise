# TradingParadise

An options trading journal and portfolio management app built with React, TypeScript, and Supabase.

## Features

- **Trading Plans** — Define strategies, risk rules, goals, and market regime guidelines
- **Trade Journal** — Log options trades with P/L tracking, grouping, sorting, and compliance indicators
- **Portfolio Holdings** — Track stock positions with buy/sell actions and automatic average cost calculation
- **Dividend Tracking** — Projected monthly dividend calendar based on holdings and yield
- **Dashboard** — Monthly income overview, per-plan analytics, and portfolio summaries
- **Daily Notes** — Rich text editor with screenshot capture for daily market observations
- **Stock Quotes** — Live price refresh via Yahoo Finance (Supabase Edge Function)

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- Supabase (Auth, Database, Edge Functions)
- Recharts (charts)
- Zustand (state management)
- React Router v7
- TipTap (rich text editor)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for deploying edge functions)

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/TradingParadise.git
cd TradingParadise
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note your **Project URL** and **anon public key** from Settings → API

### 3. Run database migrations

In the Supabase dashboard, go to **SQL Editor** and run each migration file in order:

```
supabase/migrations/001_create_tables.sql
supabase/migrations/002_rls_policies.sql
supabase/migrations/003_add_contracts_column.sql
supabase/migrations/004_make_portfolio_optional.sql
supabase/migrations/005_add_campaign_column.sql
supabase/migrations/006_create_daily_notes.sql
supabase/migrations/007_dividend_calendar.sql
supabase/migrations/008_portfolio_holdings.sql
supabase/migrations/009_add_dividend_yield_to_holdings.sql
supabase/migrations/010_decouple_portfolio_from_plan.sql
```

Or use the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 5. Enable authentication

In your Supabase dashboard:

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (enabled by default)
3. Optionally disable "Confirm email" for local development under Authentication → Settings

### 6. Deploy the Edge Function

The `stock-quote` edge function proxies Yahoo Finance for live stock prices and dividend data.

```bash
npx supabase functions deploy stock-quote --project-ref <your-project-ref>
```

### 7. Run locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure

```
src/
├── components/
│   ├── auth/          # Protected routes
│   ├── journal/       # Trade journal (entry form, filters, inline editing)
│   ├── layout/        # App shell, header, sidebar
│   ├── notes/         # Daily notes editor + screenshot capture
│   ├── options-dashboard/  # Charts and analytics
│   ├── plan/          # Trading plan editor/viewer
│   └── portfolio/     # Holdings, dividends
├── db/                # Supabase repository layer
├── hooks/             # Custom React hooks
├── pages/             # Route-level page components
├── stores/            # Zustand stores
├── types/             # TypeScript type definitions
└── utils/             # Helpers (stock price fetching, etc.)

supabase/
├── functions/
│   └── stock-quote/   # Edge function for Yahoo Finance proxy
└── migrations/        # SQL migration files (run in order)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |

## License

MIT
