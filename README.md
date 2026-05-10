# Pathway — Web Platform

Next.js frontend for **Pathway**, a restaurant supply-chain platform that ingests a restaurant's menu URL and walks the operator through a 4-step pipeline: extracting ingredients, tracking commodity pricing, discovering nearby distributors, and emailing RFPs. Replies from distributors are auto-parsed into structured quotes, and the platform surfaces a per-ingredient recommendation with a distributor-grouped order plan.

This repo is the **web tier only**. It talks to two FastAPI services and a Postgres database; both services and the DB must be running for the app to function end-to-end.

---

## Architecture

```
                ┌──────────────────────┐
                │  Next.js (this repo) │  http://localhost:3000
                │  app/ + app/api/*    │
                └──────────┬───────────┘
                           │
        ┌──────────────────┼──────────────────────┐
        │                  │                      │
        ▼                  ▼                      ▼
┌────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  menu-parser   │  │ distributor-handler│  │   PostgreSQL     │
│ FastAPI :8000  │  │ FastAPI :8001      │  │ schema: pathway  │
│                │  │                    │  │                  │
│ • parse menu   │  │ • discover dists.  │  │ menu_item        │
│ • extract      │  │ • send RFPs        │  │ recipe(_ing)     │
│   recipes      │  │ • inbox poll +     │  │ ingredients      │
│ • pricing      │  │   reply parsing    │  │ pricing_trends   │
│   trends (USDA)│  │ • recommendations  │  │ distributors     │
└────────────────┘  └────────────────────┘  │ distributor_ing  │
                                            │ rfp_requests     │
                                            │ rfp_line_items   │
                                            │ rfp_followups    │
                                            │ quotes           │
                                            │ quote_line_items │
                                            │ processed_msgs   │
                                            └──────────────────┘
```

The web tier is a thin orchestrator: every API route under `src/app/api/` is either a direct DB query or a proxy to one of the two FastAPI services. Long-running operations (recipe extraction, RFP sending, pricing fetches) are delegated to the upstream services and stream their progress back through the proxy.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts (pricing trends)
- **Database driver:** `pg` 8 (no ORM)
- **Database:** PostgreSQL with all tables under the `pathway` schema

---

## Prerequisites

Before starting the web app, make sure these are running:

| Dependency           | Default URL              | Required for                                         |
|----------------------|--------------------------|------------------------------------------------------|
| PostgreSQL           | `localhost:5432`         | Every page (DB queries) and the pipeline-reset flow  |
| `menu-parser`        | `http://localhost:8000`  | Steps 1–2 of the pipeline (`parse-menu-url`, `extract-recipe`, `pricing-trends`) |
| `distributor-handler`| `http://localhost:8001`  | Steps 3–5 (`fetch-distributors`, `send-rfps`, `recommendations`) |

If a service isn't reachable the corresponding pipeline step returns **502** with a descriptive error.

You'll also need:

- Node.js **≥ 20**
- npm (or pnpm / yarn / bun — examples below use npm)

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/pathway-platform/web-platform.git
cd web-platform

# 2. Install
npm install

# 3. Configure environment
cp .env.local.example .env.local
# then edit .env.local (see "Environment variables" below)

# 4. Make sure Postgres + the two FastAPI services are running

# 5. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should land on the pipeline stepper if the DB is empty, or on the "Pipeline complete" view if previous data exists.

---

## Environment variables

All variables live in `.env.local` (gitignored). A template is in `.env.local.example`.

| Variable                         | Default                  | Description                                                                |
|----------------------------------|--------------------------|----------------------------------------------------------------------------|
| `DATABASE_URL`                   | —                        | Postgres connection string. The `pathway` schema must exist.               |
| `MENU_PARSER_BASE_URL`           | `http://localhost:8000`  | Base URL of the `menu-parser` FastAPI service.                             |
| `DISTRIBUTOR_HANDLER_BASE_URL`   | `http://localhost:8001`  | Base URL of the `distributor-handler` FastAPI service.                     |

Example:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/pathway
MENU_PARSER_BASE_URL=http://localhost:8000
DISTRIBUTOR_HANDLER_BASE_URL=http://localhost:8001
```

---

## Database

All tables live under the `pathway` schema. The web tier never owns DDL — schema is created and migrated by the FastAPI services. To verify a healthy DB:

```bash
psql "$DATABASE_URL" -c "\dt pathway.*"
```

You should see (at minimum):

```
distributor_ingredient   processed_messages       quote_line_items
distributors             quotes                   recipe
ingredients              recipe_ingredients       rfp_followups
menu_item                pricing_trends           rfp_line_items
                                                  rfp_requests
```

### Resetting state

`POST /api/pipeline-reset` truncates **all 9 core tables** (`menu_item`, `recipe`, `recipe_ingredients`, `ingredients`, `pricing_trends`, `distributors`, `distributor_ingredient`, `rfp_requests`, `rfp_line_items`) with `RESTART IDENTITY CASCADE`. This is wired up to the **"Re-run pipeline"** button on the home screen.

The upstream `menu-parser` service uses `TRUNCATE … CASCADE` on `pathway.ingredients` during re-ingestion, so downstream FK-dependent rows (`distributor_ingredient`, `rfp_line_items`) are auto-cleared when a fresh menu is parsed.

---

## The pipeline

The home screen (`src/app/page.tsx`) renders a 4-step stepper that walks the operator through ingestion. State is derived from row counts in `pathway.menu_item`, `pricing_trends`, `distributors`, and `rfp_requests`; the stepper resumes at the first step whose count is 0.

| Step | Title              | Component                  | Calls                                                  | Result                                              |
|------|--------------------|----------------------------|--------------------------------------------------------|-----------------------------------------------------|
| 1    | Menu Ingestion     | `MenuIngestionStep`        | `POST /api/parse-menu-url` → `POST /api/extract-recipe` → `GET /api/menu-items` → `PATCH /api/menu-items` | Menu items + recipes + ingredients populated. User sets serving sizes / servings-per-day. |
| 2    | Pricing Trends     | `PricingTrendsRunStep`     | `GET /api/run-pricing-trends`                          | USDA AMS prices + 30/90-day deltas per ingredient. Routes to `/pricing-trends`. |
| 3    | Distributors       | `DistributorDiscoveryStep` | `GET /api/fetch-distributors?address=…`                | Distributors discovered around the restaurant address. Optional checkbox auto-advances to Step 4. |
| 4    | Send RFPs          | `RfpSendStep`              | `POST /api/send-rfps`                                  | One RFP email per matched distributor, with per-distributor line items. |

Step 4 can be auto-triggered via two paths:
- The checkbox on Step 3 ("Send RFP emails instantly")
- The **Send Email** button on the `/distributors` page (which navigates to `/?autorun=rfps`)

After RFPs are sent, the distributor-handler service polls Gmail and parses replies into `pathway.quotes` + `pathway.quote_line_items`. Once any quotes exist, the **Recommendations** page surfaces a per-ingredient ranked candidate list and a distributor-grouped order plan.

---

## Pages

| Route              | Purpose                                                                                          |
|--------------------|--------------------------------------------------------------------------------------------------|
| `/`                | Pipeline stepper (steps 1–4) or "Pipeline complete" view if all stages have data.                |
| `/menu`            | Browseable list of parsed menu items with search.                                                |
| `/ingredients`     | Master ingredient list with category filter and "used in" cross-references to menu items.        |
| `/pricing-trends`  | USDA AMS pricing per ingredient, 30/90-day change %, sparkline charts (Recharts).                |
| `/distributors`    | Card view of discovered distributors. Geolocation-sorted by distance, search, category + ingredient multi-select filters. Shows confirmed / probably / might-also-sell ingredient buckets. |
| `/rfp-requests`    | Per-RFP cards with recipient, deadline, and a 3-row preview of the line items (expandable).      |
| `/recommendations` | Per-ingredient ranked candidates with the recommended distributor surfaced as a banner card and the rest of the bundle order they're winning. |

---

## API routes

All routes live under `src/app/api/`. Many are thin proxies to the FastAPI services via the helpers in `src/lib/menuParser.ts` and `src/lib/distributorHandler.ts`.

### Pipeline orchestration

| Method | Route                       | Talks to              | Notes                                                                          |
|--------|-----------------------------|-----------------------|--------------------------------------------------------------------------------|
| `POST` | `/api/parse-menu-url`       | menu-parser           | Body: `{ url }`. Long-running.                                                 |
| `POST` | `/api/extract-recipe`       | menu-parser           | Long-running.                                                                  |
| `GET`  | `/api/run-pricing-trends`   | menu-parser           | Pulls USDA AMS pricing.                                                        |
| `GET`  | `/api/fetch-distributors`   | distributor-handler   | Query: `?address=…`.                                                           |
| `POST` | `/api/send-rfps`            | distributor-handler   | No body — it pulls from the current DB state.                                  |
| `GET`  | `/api/recommendations`      | distributor-handler   | Forwards query string (e.g. `?include_partial=true`, weight overrides).        |

### Direct DB access

| Method | Route                       | Description                                                                |
|--------|-----------------------------|----------------------------------------------------------------------------|
| `GET`  | `/api/pipeline-status`      | Row counts for `menu_item`, `pricing_trends`, `distributors`, `rfp_requests`. |
| `POST` | `/api/pipeline-reset`       | Truncates all pipeline tables with `RESTART IDENTITY CASCADE`.             |
| `GET`  | `/api/menu-items`           | List menu items.                                                           |
| `PATCH`| `/api/menu-items`           | Bulk update `servings_per_day` / `serving_size`. Body: `{ items: [...] }`. |
| `GET`  | `/api/ingredients`          | Ingredients with their referenced menu items.                              |
| `GET`  | `/api/pricing-trends`       | Latest pricing-trend rows.                                                 |
| `GET`  | `/api/distributors`         | Distributors with linked ingredients (high/medium confidence) + per-distributor `rfp_count`. |
| `GET`  | `/api/rfp-requests`         | RFP requests joined with distributor info and line items (with ingredient names). |

---

## Project structure

```
src/
├── app/
│   ├── api/                      # Route handlers (DB queries + service proxies)
│   ├── distributors/             # /distributors page
│   ├── ingredients/              # /ingredients page
│   ├── menu/                     # /menu page
│   ├── pricing-trends/           # /pricing-trends page
│   ├── recommendations/          # /recommendations page
│   ├── rfp-requests/             # /rfp-requests page
│   ├── layout.tsx
│   ├── page.tsx                  # Home / pipeline stepper
│   └── globals.css
├── components/
│   ├── EmptyState.tsx
│   └── Sidebar.tsx
└── lib/
    ├── db.ts                     # pg Pool singleton
    ├── distributorHandler.ts     # Proxy helper for :8001
    └── menuParser.ts             # Proxy helper for :8000
```

---

## Development

| Script            | What it does                                |
|-------------------|---------------------------------------------|
| `npm run dev`     | Start Next dev server with Turbopack        |
| `npm run build`   | Production build                            |
| `npm run start`   | Run the production build                    |
| `npm run lint`    | ESLint                                      |

Tips:

- Pages are client components (`"use client"`) and fetch data via the local API routes — there's no server-side data fetching in `page.tsx` files.
- The `pg` pool is a process-wide singleton (`src/lib/db.ts`) cached on `globalThis` to survive Next's dev hot-reload.
- API routes that proxy long-running upstream calls set `export const maxDuration = 300;` so Vercel/Next won't time them out at the default 60s.
- Geolocation on `/distributors` requires HTTPS or `localhost`. On first load the browser prompts for permission; if denied the cards fall back to alphabetical order.
