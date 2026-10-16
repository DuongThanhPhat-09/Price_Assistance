# Price Assistant

Check a product's **price, stock and shelf location in under 3 seconds**: scan the barcode, say the name, or type it.

Built for small household shops (electrical, plumbing, hardware, building materials) whose owners and staff are often **55–70 years old and not technical**. Every screen is designed to be used **without training**.

| Scan | Speak | Type |
|---|---|---|
| Camera opens immediately. The product card appears the moment a barcode is read, with no confirm button. | The mic starts listening as soon as the screen opens. *"Ống nước phi 27"* goes straight to the product. | Suggestions appear as you type. Search ignores accents and tolerates typos. |

---

## Contents

1. [Features](#features)
2. [Installation guide](#installation-guide)
3. [Using it on a phone or tablet](#using-it-on-a-phone-or-tablet)
4. [Configuration](#configuration)
5. [Importing products from CSV](#importing-products-from-csv)
6. [Project structure](#project-structure)
7. [Architecture](#architecture)
8. [API reference](#api-reference)
9. [UX principles for older users](#ux-principles-for-older-users)
10. [AI-ready architecture and Phase 2](#ai-ready-architecture-and-phase-2)
11. [Testing and quality](#testing-and-quality)
12. [Deploying to production](#deploying-to-production)
13. [Troubleshooting](#troubleshooting)

---

## Features

**Lookup (no login needed)**
- **Home screen:** three giant buttons (Scan / Speak / Type) plus *Recent searches*, so the last products can be reopened with one tap.
- **Barcode scan:** EAN-13, EAN-8, UPC-A/E, Code 128, Code 39, ITF and QR, using the phone's native `BarcodeDetector` when available. Beeps and vibrates on success. You can also type the number, or use a **USB/Bluetooth barcode gun**: it types the digits and presses Enter, and the product opens.
- **Voice search:** Web Speech API in Vietnamese (`vi-VN`) or English. It tries every alternative the recogniser heard and ignores filler words like *"giá … bao nhiêu"*. When the match is clear, the product opens; when several products tie (e.g. two brands of phi 27 pipe), only the close candidates are shown.
- **Fuzzy search:** accent-insensitive (`ong nuoc` = `Ống nước`), prefix-aware (`pan` → Panasonic…), typo-tolerant (`panasonik`), with exact number matching (`27` never returns `21`) and barcode search. A search takes about 10 ms.
- **Product card:** large price, cost price and profit (can be hidden), stock with a colour + icon + word status, shelf location, category, barcode and last-updated time. A fixed bottom bar makes checking the *next* product one tap.
- **Vietnamese / English** switch with one tap; the speech language follows it.
- **Installable** (PWA manifest): "Add to Home Screen" makes it open like an app.

**Admin**
- Add / edit / delete products (delete always asks for confirmation).
- **CSV bulk import** (upsert by barcode, per-row error report with spreadsheet row numbers) and **CSV export** (Excel-friendly UTF-8).
- Per-device settings: store name, show/hide cost price (for screens customers can see), language, clear history.
- Optional **admin PIN** (`ADMIN_PIN`). Price lookup always stays open.

**Demo data:** 112 realistic products (PVC pipes, fittings, valves and faucets, Cadivi wires, LED lights, sockets, switches, breakers, home appliances, tools) with valid EAN-13 barcodes, shelf locations, and some low or out-of-stock items to demo.

## Tech stack

Next.js 15 (App Router, Route Handlers) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Prisma 6 + PostgreSQL (Neon) · Zustand · html5-qrcode · Web Speech API · Lucide icons · Zod · Vitest

---

## Installation guide

### Requirements
- **Node.js 20.9 or newer** (tested on Node 24): <https://nodejs.org>
- Any OS (Windows, macOS, Linux).
- A **PostgreSQL** database. Either:
  - **Neon** (free, recommended; the same database Vercel uses). Create one at <https://neon.tech> or in Vercel → Storage, or
  - a **local** one with no install: `npm run db:local` (Prisma's built-in dev Postgres).

### Steps

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create your settings file, then put your database URL in
#    DATABASE_URL (see .env.example)
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 3. Create the tables and load the 112 demo products
npm run setup

# 4. Start the app
npm run dev
```

Open <http://localhost:3000>.

To start **without demo data**, run `npx prisma migrate deploy` instead of `npm run setup`, then add products in **Manage products** or import a CSV.

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run dev:https` | Development server with a self-signed HTTPS certificate, reachable from phones on your Wi-Fi |
| `npm run build` / `npm start` | Production build / server |
| `npm run setup` | Apply migrations + seed demo data |
| `npm run db:seed` | Add any missing demo products (never changes or deletes existing ones) |
| `npm run db:local` | Start a local Postgres for development (keep it running in its own terminal) |
| `npm run vercel-build` | What Vercel runs on deploy: migrate → seed if empty → build |
| `npm run db:reset` | ⚠️ **Deletes everything** and recreates the demo database |
| `npm test` | Unit tests (search engine, text normalisation, money, CSV) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |

---

## Using it on a phone or tablet

Browsers only allow the **camera and microphone on secure pages**: `https://…` or `http://localhost`. To test from a phone on the same Wi-Fi:

```bash
npm run dev:https
```

Then open `https://<your-computer-ip>:3000` on the phone and accept the certificate warning once. For daily use, deploy behind HTTPS (see [Deploying](#deploying-to-production)).

**Browser support**
| Feature | Android Chrome | iPhone Safari | Desktop Chrome / Edge | Firefox |
|---|---|---|---|---|
| Search, product card, admin | ✅ | ✅ | ✅ | ✅ |
| Barcode camera | ✅ | ✅ | ✅ (webcam) | ✅ |
| Voice search | ✅ (needs internet) | ✅ iOS 14.5+ | ✅ (needs internet) | ❌ (a "please use Chrome" message is shown, with a *Type instead* button) |

---

## Configuration

All settings live in `.env` (see `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | – | **Required.** PostgreSQL connection used by the app (pooled is fine) |
| `DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` | – | Optional direct connection used for migrations on deploy (falls back to `DATABASE_URL`). Neon/Supabase integrations set one automatically. |
| `ADMIN_PIN` | – | Not created automatically: add it yourself (see Deploying). |
| `SEED_DEMO_DATA` | `true` | On deploy, add the demo products if the database is empty. Set `false` to stop. |
| `NEXT_PUBLIC_STORE_NAME` | `Price Assistant` | Name shown on the home screen (can also be changed per device in Settings) |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `vi` | First-visit language, `vi` or `en` |
| `NEXT_PUBLIC_CURRENCY` | `VND` | ISO currency code for display |
| `NEXT_PUBLIC_NUMBER_LOCALE` | `vi-VN` | Number/currency formatting locale |
| `NEXT_PUBLIC_LOW_STOCK_THRESHOLD` | `5` | Stock at or below this shows "Low stock" |
| `ADMIN_PIN` | *(empty)* | If set, admin pages and all data changes require this PIN. Use 6+ digits. |

`NEXT_PUBLIC_*` values are compiled into the app, so **rebuild after changing them**.

> **Money is stored as integer minor units** (đồng for VND, cents for USD) to avoid rounding errors. The demo data is in VND. If you switch `NEXT_PUBLIC_CURRENCY` to a currency with cents, enter prices normally (e.g. `12.50`) and the app converts them.

---

## Importing products from CSV

1. **Manage products → Import CSV → Download sample CSV** (`public/sample-products.csv`).
2. Fill it in with Excel or Google Sheets and save as **CSV UTF-8**.
3. Choose the file. The result shows how many products were added and updated, and which rows had problems (by row number, as in Excel).

| Column | Required | Notes |
|---|---|---|
| `barcode` | – | Matching barcode → **updates** that product. Empty → matched by exact name or created. |
| `name` | ✅ | |
| `description` | – | |
| `category` | – | Defaults to `Other` |
| `price` | ✅ | Selling price as written: `45000`, `45.000`, `12.50` |
| `cost_price` | – | Defaults to 0 |
| `stock_quantity` | – | Whole number, defaults to 0 |
| `shelf_location` | – | e.g. `A1-03` |
| `image_url` | – | `https://…` or a path like `/images/products/pipe.svg` |

Headers are forgiving (`Cost Price`, `cost-price` and `COST_PRICE` all work). If a barcode appears twice in one file, the later row wins. Maximum file size is 5 MB. **Export** produces the same format, so export → edit in Excel → import is a safe bulk-edit workflow.

---

## Project structure

```
prisma/
  schema.prisma            Product + SearchHistory models
  migrations/              SQL migrations (committed)
  demo-products.ts         112 demo products (deterministic)
  seed.ts                  Idempotent seed (upsert by barcode)
public/
  sample-products.csv      CSV import template
  images/products/*.svg    Demo product illustrations
src/
  app/                     Next.js routes (thin: fetch data, render a screen)
    page.tsx               Home
    scan/ voice/ search/   The three ways to find a product
    product/[id]/          Product card
    admin/                 List, new, edit, import, settings, login
    api/                   REST route handlers (see API reference)
  components/
    ui/                    shadcn/ui primitives, enlarged for older users
    home/ scan/ voice/ search/ product/ admin/ layout/   Feature components
  hooks/                   use-product-search, use-speech-recognition
  i18n/                    Vietnamese + English dictionaries, provider
  lib/                     Pure, framework-free logic (shared client/server)
    search/fuzzy.ts        Search engine
    text.ts                Accent folding, tokenising, edit distance
    money.ts csv.ts barcode.ts validation.ts types.ts api-client.ts
  server/                  Server-only code
    services/              product-, search-, history-service
    ai/                    AI interfaces, registry, Phase 2 skeleton
  store/                   Zustand stores (settings, search session)
  middleware.ts            Optional admin PIN guard
tests/                     Vitest unit tests
```

## Architecture

```
UI screen (client component)
   │  lib/api-client.ts  (typed fetch)
   ▼
Route handler  src/app/api/**/route.ts      ← validates input with Zod, maps errors to HTTP codes
   ▼
Service        src/server/services/*.ts      ← business logic, no HTTP concerns
   ▼
Prisma  →  PostgreSQL
```

- **Thin routes, fat services.** Pages and API routes only parse input and call services, so the same service backs the product page (server component) and the JSON API.
- **Pure core in `src/lib`.** Search, text normalisation, money, CSV and validation have no I/O, are unit-tested, and can run in the browser (e.g. a future offline mode).
- **Search engine.** All products are scored in memory: a few thousand products take a few milliseconds, which is faster than SQL `LIKE` and enables fuzzy, accent-insensitive matching. The index is cached and rebuilt after every write (and at most every 15 s, since each serverless instance keeps its own copy). For tens of thousands of products, swap `search-service.ts` for Postgres full-text search (`pg_trgm`) or Meilisearch; the interface stays the same.
- **State.** Zustand holds per-device settings (persisted to `localStorage`) and the current search session (so *Back* from a product returns to the same results). Language lives in a cookie so the server renders the right language on first paint.
- **Security.** Zod validation on every write; unique-barcode conflicts → `409`; unexpected errors → generic `500` (details only in server logs); optional PIN with an HTTP-only cookie and rate-limited login; `Permissions-Policy` limits camera/mic to this origin.

### Data model

| Product | | SearchHistory | |
|---|---|---|---|
| `id` | int PK | `id` | int PK |
| `barcode` | unique, nullable | `keyword` | text |
| `name`, `description`, `category` | text | `search_type` | `text` / `voice` / `barcode` / `image` |
| `price`, `cost_price` | int (minor units) | `product_id` | nullable FK → Product (set null on delete) |
| `stock_quantity` | int | `created_at` | datetime |
| `shelf_location`, `image_url` | text, nullable | | |
| `created_at`, `updated_at` | datetime | | |

`SearchHistory.product_id` was added beyond the original spec so *Recent searches* can show the product's name and price and reopen it with one tap.

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/products?q=pan&limit=20` | Fuzzy search → `{ query, results: [{ product, score }], confidentMatchId }` |
| GET | `/api/products?page=1&pageSize=50&category=…` | Paginated list |
| POST | `/api/products` 🔒 | Create (JSON, money in minor units) |
| GET | `/api/products/:id` | Get one |
| PUT | `/api/products/:id` 🔒 | Replace |
| DELETE | `/api/products/:id` 🔒 | Delete |
| GET | `/api/products/barcode/:code` | Exact barcode lookup (404 if unknown) |
| POST | `/api/products/import` 🔒 | CSV upload (`multipart/form-data` field `file`, or raw `text/csv` body) |
| GET | `/api/products/export` 🔒 | All products as CSV |
| GET | `/api/categories` | Distinct categories |
| GET / POST / DELETE | `/api/search-history` | Recent searches / record one / clear 🔒 |
| POST | `/api/ai/recognize` | **Phase 2**: returns `501` until a provider is registered |
| POST / DELETE | `/api/admin/login` | Unlock / lock admin |

🔒 = requires the admin PIN when `ADMIN_PIN` is set.

---

## UX principles for older users

Every screen was checked against: *"Can a 55–70-year-old shop owner use this without training?"* Concretely:

- **Large everything.** Base font is 18 px; prices are 48–60 px; the smallest touch target is 56 px (the accessibility minimum is 44 px).
- **High contrast.** Dark text on light backgrounds; white on saturated colours that meet WCAG AA.
- **One colour per action, everywhere.** Blue = scan, green = speak, orange = type, on the home screen and on the bottom bar.
- **No dead ends.** Every error (camera blocked, no internet, not found) says what happened in plain words and offers a big next step (*Scan again*, *Speak again*, *Type instead*, *Add this product*).
- **Zero confirmation steps for lookups.** A scan or a clear voice match opens the product directly. Only *deleting* asks "Are you sure?".
- **Labelled buttons.** Icons always come with words (*← Back*, not just ←), and stock status uses colour + icon + text (safe for colour-blind users).
- **Shallow navigation.** Every screen is at most one level deep, the on-screen Back always works, and the phone's Back button behaves as expected (scan/voice results *replace* the history entry).
- **Zoom allowed**, reduced-motion respected, visible focus ring for keyboard users.

---

## AI-ready architecture and Phase 2

`src/server/ai/` defines interfaces for future AI features. Nothing is called until a provider is registered:

| Interface | Future feature |
|---|---|
| `ImageRecognitionProvider` | Photo → `{ product, size, variant, confidence }[]` |
| `ProductRecognitionService` | Photo → matching products **in this shop's catalogue** |
| `SalesAssistant` | Answers questions like "which valve fits a 27 pipe?" |
| `InventoryForecaster` | Demand forecast, reorder quantity, stock-out date |
| `NaturalLanguageQueryParser` | "ống nước dưới 50 nghìn còn hàng" → structured filter |

**Phase 2: camera product recognition** is wired end to end except the model:

- `POST /api/ai/recognize` accepts a photo and returns `501` for now.
- `CatalogueProductRecognition` (`product-recognition.ts`) already combines any vision provider with the fuzzy catalogue search.
- `SearchHistory.search_type` already allows `"image"`.

To enable it: implement `ImageRecognitionProvider` in `src/server/ai/providers/<name>.ts`, then in `registry.ts` set `productRecognition: new CatalogueProductRecognition(new YourProvider())`. Finally, add a 4th home-screen button pointing to a capture screen.

---

## Testing and quality

```bash
npm test          # 29 unit tests
npm run typecheck
npm run lint
npm run build
```

The tests cover search ranking against the real demo catalogue (`pan` → Panasonic, voice phrases with filler words, typos, exact number matching, barcode priority, ambiguity detection), Vietnamese text folding, money parsing, barcode check digits and CSV import/export round-trips.

---

## Deploying to production

### Vercel + Neon (recommended)

Vercel runs the app as serverless functions with **no permanent disk**, so the data lives in a hosted PostgreSQL database (Neon, free tier).

1. **Import the GitHub repo** in Vercel (*Add New → Project*). The framework is detected as Next.js; keep the defaults.
2. **Create the database:** in the Vercel project, open *Storage → Create Database → Neon (Postgres)* and connect it to the project, for all environments. Vercel adds `DATABASE_URL` (and a direct-connection variable) automatically. Any other Postgres works too: just add `DATABASE_URL` yourself.
3. **Add the admin PIN** (recommended, because the site is public): *Settings → Environment Variables → Add* with Key `ADMIN_PIN` and Value of 6 digits you choose, ticking all environments. Optional extras the same way: `NEXT_PUBLIC_STORE_NAME`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `SEED_DEMO_DATA`.
4. **Redeploy** (*Deployments → ⋯ → Redeploy*). The `vercel-build` script runs on every deploy:
   `prisma generate` → `prisma migrate deploy` (creates or updates tables) → seeds the 112 demo products **only if the database is empty** → `next build`. Environment variable changes only apply after a redeploy.

Vercel URLs are already HTTPS, so the camera and microphone work.

### Your own server (mini-PC, NAS, VPS)

```bash
npm ci
npx prisma migrate deploy
npm run db:seed          # optional demo data
npm run build
npm start                # port 3000; set PORT=… to change
```

- Use any PostgreSQL 13+ (installed locally, Docker, or Neon).
- Put it behind **HTTPS** (Caddy, nginx + Let's Encrypt, or Cloudflare Tunnel), which camera and microphone require.

### Either way
- Set `ADMIN_PIN` before sharing the link.
- **Backups:** Neon keeps point-in-time history; you can also use *Download all (CSV)* from the admin page.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` / `prisma generate` fails with **"self-signed certificate in certificate chain"** (corporate network/antivirus) | Trust the Windows/macOS certificate store: PowerShell `$env:NODE_OPTIONS="--use-system-ca"`, bash `export NODE_OPTIONS=--use-system-ca`, then rerun. |
| Camera or mic says "blocked" | Tap the 🔒 icon in the address bar → allow Camera/Microphone. Use `https://` or `localhost`. |
| Voice says "No internet connection" | Chrome and Edge send speech to an online service, so the shop device needs internet for voice. Scan and search work on the local network only. |
| Voice search not available | Use Google Chrome (Android/desktop) or Safari (iOS 14.5+). Firefox has no Web Speech recognition. |
| Every page shows "Có lỗi xảy ra" / "Something went wrong" after deploying | The app can't reach the database. Check that `DATABASE_URL` is set in Vercel → Settings → Environment Variables, then redeploy. The function logs (Vercel → Logs) show the exact error. |
| `prepared statement "s0" already exists` | Your connection goes through a pooler that doesn't support prepared statements (or it's `npm run db:local`). Add `&pgbouncer=true` to `DATABASE_URL` (not to the unpooled one). |
| Prices look wrong after changing currency | `NEXT_PUBLIC_*` are build-time: rebuild. Existing prices are stored in minor units of the old currency. |
