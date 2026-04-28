# CLAUDE.md — Los Tios

## What this app is

Restaurant management web app for Los Tios. Two surfaces:

- **Public** (`/`, `/CustomerOrder`): customer order form, no auth
- **Admin** (`/admin`, `/DailyCash`, `/Orders`, …): operations dashboard, requires auth

The core mission is tracking money: where it came from, where it went, and whether it was entered manually or imported from an external system.

---

## Tech stack

- **React 18** + **React Router v6** — SPA, no SSR, no Next.js
- **Vite 6** — build tool (proxy routes to external APIs in dev)
- **Base44 SDK** (`@base44/sdk`) — hosted backend (Postgres/Supabase via SDK, no direct DB client in the frontend)
- **Tanstack React Query v5** — all server state (entities, integrations)
- **Shadcn/Radix UI** + **Tailwind CSS** — component library in `src/components/ui/`
- **Zod** + **React Hook Form** — form validation

---

## File structure

```
src/
  api/              # External API clients (Base44, Loyverse, Clip, Revolut, Notion)
  components/
    ui/             # Shadcn/Radix primitives (button, input, dialog, …)
    daily-cash/     # Date/time pickers for cash drawer
    dashboard/      # KPI cards, alert feed, insight table
    orders/         # Order forms, receipt dialog, table service
    reservations/   # Reservation form and list
    menu-management/
  hooks/            # useDailyCashStoreSync, useManualCashCountsSync, useMonthUrlSync
  lib/              # Business logic, repositories, utilities (see below)
  pages/            # One file per admin page; matches route path
  App.jsx           # Router and auth wrappers
  Layout.jsx        # Sidebar + header shell
  pages.config.js   # Maps page name → component (drives dynamic routing)
entities/           # Base44 entity JSON schemas (ManualCashCount, DailyCashLedger, …)
```

---

## Admin routes

Routes are PascalCase and map directly to files in `src/pages/`:

| Route | Page | Purpose |
|---|---|---|
| `/admin` | Dashboard | Main KPI dashboard |
| `/DailyCash` | DailyCash | Cash drawer tracking (main complex page) |
| `/Orders` | Orders | Manual + Loyverse orders |
| `/LoyverseOrders` | LoyverseOrders | Orders from Loyverse API |
| `/LVFinanzas` | LVFinanzas | Loyverse finance reconciliation |
| `/Clip` | Clip | Payclip payment integration |
| `/Revolut` | Revolut | Revolut Business transactions |
| `/Expenses` | Expenses | Expense tracking |
| `/ShoppingList` | ShoppingList | Inventory / shopping |
| `/Finance` | FinanceSummary | Finance overview |
| `/IncomeTracker` | IncomeTracker | Income by source |
| `/Statistics` | Statistics | Sales statistics |
| `/ManagementInsight` | ManagementInsight | Analytics + labor insights |
| `/EmployeeCalendar` | EmployeeCalendar | Staff schedule |
| `/MenuManagement` | MenuManagement | Menu CRUD |
| `/Loyverse` | Loyverse | Loyverse settings |
| `/Events` | Events | Customer events/promotions |
| `/CompanyAccount` | CompanyAccount | Business account settings |
| `/IntegrationsHub` | IntegrationsHub | All integrations dashboard |
| `/Notion` | Notion | Notion explorer |

---

## Key abstractions in `src/lib/`

| File | What it does |
|---|---|
| `dailyCashLocal.js` | Module-level store for the daily cash drawer. Holds `openings`, `manualLines`, `openingDiffEvents` (legacy). Mode is one of `"none"`, `"localStorage"`, `"remote"`. Exposes `initDailyCashPersistenceRemote()`, `listOpeningCountDiffs()`, `setRemoteManualCountSnapshot()`. |
| `dailyCashLedgerRepository.js` | CRUD for the `DailyCashLedger` Base44 entity (`ledger_payload_json` field). |
| `manualCashCountRepository.js` | CRUD for the `ManualCashCount` Base44 entity. `listManualCashCountRows()` returns rows sorted by `-created_date`. |
| `manualCashCountMigration.js` | One-shot migration from legacy `openingDiffEvents` blob → Base44 rows. Safe to call repeatedly. |
| `mexicoTime.js` | All date comparisons use Mexico City time (`America/Mexico_City`). Use `getMexicoDateKey()` and related helpers, never raw `Date`. |
| `dailyCashCalculations.js` | Pure functions: build ledger rows, sum drawer totals, apply time overrides. |
| `mergedSales.js` | Merges Loyverse + Clip + manual sales into a single list. |
| `integrationSettings.js` | Reads/writes integration credentials from `localStorage` key `los_tios_integration_settings_v1`. Falls back to `VITE_LOYVERSE_*`, `VITE_CLIP_*`, `VITE_REVOLUT_*` env vars. |
| `app-params.js` | Reads Base44 connection params (`app_id`, `server_url`, `access_token`) from URL, localStorage, or env. |
| `query-client.js` | React Query config: `refetchOnWindowFocus: false`, `retry: 1`. |

---

## Key hooks

| Hook | What it does |
|---|---|
| `useDailyCashStoreSync` | Bootstraps the daily cash store from `DailyCashLedger`. Sets `persistenceMode = "remote"`, runs migrations. Re-runs when `ledgerBootstrapKey` changes (derived from ledger row id + payload length). |
| `useManualCashCountsSync` | Loads `ManualCashCount` rows into `remoteManualCountEvents` via `setRemoteManualCountSnapshot()`. Only runs when `persistenceMode === "remote"`. Uses a memoization key (`q.dataUpdatedAt + ids`) to skip redundant pushes. |
| `useMonthUrlSync` | Syncs `?month=yyyy-MM` URL param ↔ React state. |

---

## External integrations

| Integration | Client | Credentials location |
|---|---|---|
| **Loyverse POS** | `src/api/loyverse.js` | `integrationSettings.js` → localStorage / `VITE_LOYVERSE_*` |
| **Clip (Payclip MX)** | `src/api/clip.js` | `integrationSettings.js` → localStorage / `VITE_CLIP_*` |
| **Revolut Business** | `src/api/revolut.js` | `integrationSettings.js` → localStorage / `VITE_REVOLUT_*` |
| **Notion** | `src/api/notionClient.js` | localStorage, has rate-limit retry logic |

API calls to external services go through Vite dev proxy (`/api/loyverse`, `/api/clip/*`, `/api/revolut`). In production the Base44 backend handles proxying.

---

## Backend: Base44 entities

All data persistence goes through `base44.entities.<EntityName>.list/create/update/delete`. There is no direct SQL or Supabase client in the frontend.

Key entities:

- `DailyCashLedger` — one row per app; holds `ledger_payload_json` (JSON blob with openings, manual lines, overrides)
- `ManualCashCount` — one row per manual drawer count (not embedded in the ledger blob)
- `AppSettings` — legacy settings and fallback for `daily_cash_store_json`
- `Query` — general queryable records

Entity schemas live in `entities/*.jsonc` and the extensionless `entities/ManualCashCount` file.

---

## Important patterns and gotchas

**Timezone**: Puerto Escondido (Oaxaca) uses `America/Mexico_City` — UTC-6, no DST since 2022. There is no separate `America/Puerto_Escondido` identifier. All business dates use this timezone. Date keys are `yyyy-MM-dd` strings in this timezone. Never use `new Date()` directly for business logic — use helpers from `src/lib/mexicoTime.js` (`getMexicoNowDateKey`, `getMexicoDateKey`, `mexicoWallDateTimeToUtcIso`, etc.).

**DailyCash bootstrap re-runs**: `useDailyCashStoreSync` re-runs its bootstrap whenever `ledgerBootstrapKey` changes. This key is `${ledgerRow.id}:${payloadLength}`. It changes when any store write flushes to the ledger (debounced 650ms via `scheduleRemotePersist`). Each re-run calls `initDailyCashPersistenceRemote()` which clears `remoteManualCountsHydrated`. The bootstrap immediately restores the snapshot from React Query cache to prevent the manual count history from going blank.

**Local dev mode**: When `VITE_BASE44_APP_ID` and `VITE_BASE44_SERVER_URL` are not set, `base44Client.js` returns a noop client. All entity calls return `[]` or mock values. Mock data is in `src/lib/local-dev-*.js`.

**React Query cache keys**:
- `["appSettings"]` — AppSettings list
- `["dailyCashLedger"]` — DailyCashLedger list
- `["manualCashCounts"]` — ManualCashCount list

**Design language**: Dark background (`#0f0f0c`), warm yellow/gold accent (`yellow-500`), rounded cards, subtle borders. Keep admin pages calm and scannable, not CRUD-generic.

---

## Local development

```bash
# Install
npm install

# Create .env.local with:
# VITE_BASE44_APP_ID=...
# VITE_BASE44_SERVER_URL=...
# VITE_BASE44_ACCESS_TOKEN=...   # optional: bypass auth

npm run dev
```

See `README.md` for Windows/PowerShell-specific notes.
