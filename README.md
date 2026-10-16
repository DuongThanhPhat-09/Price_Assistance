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
10. [Smart Product Recognition (AI)](#smart-product-recognition-ai)
11. [Testing and quality](#testing-and-quality)
12. [Deploying to production](#deploying-to-production)
13. [Troubleshooting](#troubleshooting)

---

## Features

**Lookup (no login needed)**
- **Home screen:** three giant buttons (Scan / Speak / Type) plus *Recent searches*, so the last products can be reopened with one tap.
- **Barcode scan:** EAN-13, EAN-8, UPC-A/E, Code 128, Code 39, ITF and QR. Beeps and vibrates on success. Frames are decoded at camera resolution (not the on-screen size) by the phone's native `BarcodeDetector` (Android) or by **ZXing-C++ in WebAssembly** everywhere else (iPhone, Windows, Firefox), which tolerates the blur of real camera frames far better than html5-qrcode's built-in zxing-js. If the live camera struggles, **Take a photo of the barcode** reads it from a sharp photo instead, and a tip appears after 10 s. You can also type the number, or use a **USB/Bluetooth barcode gun**: it types the digits and presses Enter, and the product opens.
- **Voice search:** Web Speech API in Vietnamese (`vi-VN`) or English. It tries every alternative the recogniser heard and ignores filler words like *"giá … bao nhiêu"*. When the match is clear, the product opens; when several products tie (e.g. two brands of phi 27 pipe), only the close candidates are shown.
- **Fuzzy search:** accent-insensitive (`ong nuoc` = `Ống nước`), prefix-aware (`pan` → Panasonic…), typo-tolerant (`panasonik`), with exact number matching (`27` never returns `21`) and barcode search. A search takes about 10 ms.
- **Product card:** large price, cost price and profit (can be hidden), stock with a colour + icon + word status, shelf location, category, barcode and last-updated time. A fixed bottom bar makes checking the *next* product one tap.
- **Vietnamese / English** switch with one tap; the speech language follows it.
- **Installable** (PWA manifest): "Add to Home Screen" makes it open like an app.

**Admin**
- **📸 Detect Product (Smart Product Recognition):** take a photo of a product or its box and the AI (OpenAI GPT-4o or Google Gemini) reads the packaging and fills in name, brand, model, variant, category, description and an **AI estimated price**. The owner checks, edits if needed, and saves — about 15 seconds per product instead of 2 minutes. It warns about possible duplicates ("Possible Match Found · 95% match") and never saves a low-confidence result without an explicit "I have checked". See [Smart Product Recognition](#smart-product-recognition-ai).
- **Scan to add products** (*Manage products → Scan to add products*): scan an item. An unknown barcode opens the *Add* form with the barcode filled in; a known one opens *Edit* so you can update the price or stock. After *Save* the camera comes back for the next item, so stocking a shelf is scan → type name & price → save → scan…
- Add / edit / delete products (delete always asks for confirmation). The barcode field has its own **Scan** button and warns immediately if the code already belongs to another product.
- **CSV bulk import** (upsert by barcode, per-row error report with spreadsheet row numbers) and **CSV export** (Excel-friendly UTF-8).
- **Smart Recognition settings** (shop-wide): choose OpenAI or Gemini, store the API key (encrypted), pick the model from the list your key can use, add up to 3 **fallback models** tried automatically when the main one is overloaded or retired, test every model at once, and see the recognition logs.
- Per-device settings: store name, show/hide cost price (for screens customers can see), language, clear history.
- Optional **admin PIN** (`ADMIN_PIN`). Price lookup always stays open.

**Demo data:** 112 realistic products (PVC pipes, fittings, valves and faucets, Cadivi wires, LED lights, sockets, switches, breakers, home appliances, tools) with valid EAN-13 barcodes, shelf locations, and some low or out-of-stock items to demo.

## Tech stack

Next.js 15 (App Router, Route Handlers) · TypeScript · Tailwind CSS 4 · shadcn/ui (Radix) · Prisma 6 + PostgreSQL (Neon) · Zustand · html5-qrcode + ZXing-C++ (zxing-wasm) · Web Speech API · OpenAI / Gemini vision APIs (plain `fetch`, no SDK) · Lucide icons · Zod · Vitest

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
| `ADMIN_PIN` | *(empty)* | If set, admin pages, all data changes and all AI calls require this PIN. Use 6+ digits. |
| `OPENAI_API_KEY` | – | Optional. Enables Smart Product Recognition with OpenAI. Overrides a key saved in Settings. |
| `GEMINI_API_KEY` | – | Optional. Same for Google Gemini (`GOOGLE_API_KEY` also accepted). |
| `AI_VISION_PROVIDER` | first with a key | `openai` or `gemini`, used until a provider is chosen in Settings. |
| `OPENAI_VISION_MODEL` / `GEMINI_VISION_MODEL` | `gpt-4o` / `gemini-3.8-flash` | Default model. A model chosen in Settings wins. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Optional OpenAI-compatible gateway. |
| `SETTINGS_SECRET` | – | Recommended when keys are saved from the Settings page: encrypts them (AES-256-GCM). See [API keys](#api-keys-and-security). |

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
    admin/                 List, new, edit, import, settings, login,
                           detect (photo → product), ai-settings
    api/                   REST route handlers (see API reference)
  components/
    ui/                    shadcn/ui primitives, enlarged for older users
    home/ scan/ voice/ search/ product/ admin/ layout/   Feature components
    recognition/           Detect Product: photo picker, analysing view, review form, matches
  hooks/                   use-product-search, use-speech-recognition
  i18n/                    Vietnamese + English dictionaries, provider
  lib/                     Pure, framework-free logic (shared client/server)
    search/fuzzy.ts        Search engine
    recognition/matching.ts  "Is this photo a product we already have?" scoring
    photo.ts               Browser-side photo downscaling + barcode read
    text.ts                Accent folding, tokenising, edit distance
    money.ts csv.ts barcode.ts validation.ts types.ts api-client.ts
  server/                  Server-only code
    services/              product-, search-, history-, recognition-,
                           ai-settings-service, image-storage
    ai/vision/             Provider abstraction + OpenAI and Gemini adapters
    ai/tasks/              AI tasks (prompt + schema), e.g. product-recognition
    ai/types.ts registry.ts  Contracts for later AI features
    secret-box.ts          Encryption for saved API keys
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
| `brand`, `model`, `variant` | text, nullable | | |
| `ai_confidence` | float 0..1, nullable | | |
| `ai_estimated_price` | int (minor units), nullable | | |
| `recognized_text`, `recognition_provider` | text, nullable | | |
| `created_at`, `updated_at` | datetime | | |

`SearchHistory.product_id` was added beyond the original spec so *Recent searches* can show the product's name and price and reopen it with one tap.

Smart Product Recognition adds three tables:

| ProductRecognitionHistory | | StoredImage | | AppSetting | |
|---|---|---|---|---|---|
| `id` | int PK | `id` | cuid PK | `key` | text PK |
| `product_id` | nullable FK → Product (set null) | `mime_type` | text | `value` | text (JSON; secrets encrypted) |
| `image_url` | text | `data` | bytea | `updated_at` | datetime |
| `recognized_name`, `confidence`, `provider` | | `size`, `created_at` | | | |
| `ai_model`, `status`, `result` (JSON), `error`, `duration_ms`, `created_at` | | | | | |

`status` is `recognized` → `created` (saved as a new product) or `linked` (matched to an existing one), or `failed`. `result` keeps the AI answer exactly as first returned, for auditing. Brand / model / variant are ordinary product fields: editable in the form, shown on the product card, searchable, and included in CSV import/export (a CSV without those columns leaves them unchanged).

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
| POST | `/api/ai/recognize` 🔒 | Photo → `RecognitionResponse` (`multipart/form-data`: `image` ≤ 4 MB JPEG/PNG/WebP, optional `thumbnail`, `barcode`) |
| POST | `/api/ai/recognitions/:id/save` 🔒 | Create a product from a reviewed recognition (product fields + `estimatedPrice`, `reviewed`) |
| POST | `/api/ai/recognitions/:id/link` 🔒 | `{ productId }`: "it's this existing product" |
| GET | `/api/ai/recognitions?limit=20&before=<id>` 🔒 | Recognition logs |
| GET / PUT | `/api/ai/settings` 🔒 | Provider, models, keys (keys are write-only; responses only show a masked hint) |
| POST | `/api/ai/settings/test` 🔒 | Tests every model of the chain (main + fallbacks) → `{ results: [{ ok, provider, model, durationMs } \| { ok: false, …, code, message }] }` |
| GET | `/api/ai/settings/models?provider=gemini` 🔒 | Models the key can use for photos → `{ models: string[] }` |
| GET | `/api/images/:id` | Stored product photo (immutable, cached) |
| POST / DELETE | `/api/admin/login` | Unlock / lock admin |

🔒 = requires the admin PIN when `ADMIN_PIN` is set.

AI errors carry a machine-readable `details.code` (`not_configured`, `auth`, `quota`, `rate_limit`, `model`, `timeout`, `unavailable`, `refused`, `invalid_response`, `bad_image`, `too_large`, `needs_review`, `already_saved`, `duplicate_barcode`) which the UI turns into a plain-language message.

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

## Smart Product Recognition (AI)

The owner takes a photo; the AI identifies the product; the owner checks and saves. No typing for most products.

### Setting it up (5 minutes)

1. Get an API key from **one** provider:
   - **OpenAI** (GPT-4o): <https://platform.openai.com/api-keys>. Needs a paid account with credit.
   - **Google Gemini**: <https://aistudio.google.com/apikey>. Has a free tier with per-minute limits.
2. Either put it in the server environment (`OPENAI_API_KEY` or `GEMINI_API_KEY`, then redeploy), **or** open **Manage products → Smart Recognition settings**, pick the provider, paste the key and tap **Save**.
3. Tap **Test all models** there. "Main: Gemini · gemini-3.8-flash works (2.1 s)" means you're done.
4. Recommended: under **Fallback models**, tap **Add fallback model** and pick a lighter model (tap **Load model list** to see the exact names your key can use, e.g. a `flash-lite` one). When the main model is overloaded ("high demand") or retired, the app switches to it on its own.
5. Set `ADMIN_PIN` if the site is reachable from the internet: every AI call costs money and only unlocked devices can make them.

**Cost:** one photo is roughly 1,500 input + 300 output tokens. At GPT-4o's list price when this was written that is under **1 US cent per photo**; Gemini Flash is several times cheaper. Prices change, so check the provider's pricing page.

### How the owner uses it

**Manage products → 📸 Detect Product**

1. **Take Photo** opens the phone's own camera app (best focus and exposure for small print), or **Choose from Gallery**.
2. *Analyzing product…* with a progress bar, usually 3–8 seconds.
3. The result screen shows the photo, a **confidence meter**, and every field pre-filled and editable: name, brand, model, variant, category (tap a suggested category chip; new ones are marked *new*), **AI Estimated Price**, **Store Selling Price** (starts equal to the estimate), stock, barcode and description, plus detected keywords and the text read from the package.
4. **Possible Match Found**: if the product may already exist ("Ổ cắm đôi Panasonic A12 · 95% match · Same model"), one tap on **Use this product** opens that product to update its price or stock instead of creating a duplicate. If that product had no picture, the photo becomes its picture.
5. **Save Product**, and the camera screen comes straight back for the next item.

Below **70 % confidence** a warning says *"We are not fully confident about this recognition"*, and Save only works after ticking **I have checked the details**. The server enforces this too. Nothing is ever saved without the owner tapping Save.

It also plugs into **Scan to add products**: an unknown barcode's *Add* form offers **Fill in from a photo**, which keeps the scanned barcode and returns to the scanner after saving.

> **The price is an AI estimate, not a market price.** It is labelled *AI Estimated Price* everywhere, comes from the model's general knowledge of the product type, brand and specs in your market (derived from `NEXT_PUBLIC_NUMBER_LOCALE`, e.g. Vietnam) and is rounded to a shop-style price (VND: nearest 1,000). There is no web lookup in this version.

### When a model is overloaded or retired: fallback models

Providers regularly overload ("This model is currently experiencing high demand") and retire models ("no longer available to new users"). So every photo goes through a chain: the main model, then up to 3 fallback models in the order set in Settings (`src/server/ai/vision/fallback.ts`):

| Error | What the app does |
|---|---|
| Overloaded, rate-limited, too slow | Waits ~1 s and retries the same model once (twice when there is no fallback), then the next model |
| Model retired / not found, key rejected, out of credit | Next model straight away |
| Photo blocked by a safety filter | Stops: another model would refuse too; asks for another photo |

All attempts share a 50 s budget (Vercel stops a request at 60 s). A fallback can use its provider's key or its **own key** (e.g. a second project you own, or a paid one). Changing keys does *not* help with overload: that is the model's capacity, the same for every key, and limits are per project, not per key. Don't create extra free accounts to get around limits: that breaks the providers' terms and can get the account blocked. **Recognition logs** show the path of each photo, e.g. *"Tried: gemini-3.8-flash ✗ overloaded → gemini-3.8-flash ✗ overloaded → gemini-3.8-flash-lite ✓"*, and **Test all models** shows which entries work right now.

### How it works

```
Phone                         Server                                    AI provider
─────                         ──────                                    ───────────
photo (3–12 MB)
 → downscale to 1600 px JPEG
 → 480 px thumbnail
 → read barcode (ZXing)  ──▶  POST /api/ai/recognize
                              ├─ store thumbnail (StoredImage)
                              ├─ product-recognition task:
                              │   prompt + JSON schema + shop's categories ──▶ OpenAI / Gemini
                              │   validate + normalise answer          ◀──
                              ├─ match against catalogue (fuzzy search + scoring)
                              └─ write ProductRecognitionHistory
review screen            ◀──  { result, matches, confidence, … }
Save ───────────────────────▶ POST /api/ai/recognitions/:id/save → Product
```

- **OCR and vision together:** one multimodal call reads the label text, logos, model plate and barcode digits and looks at the product's shape. The answer is forced into a strict JSON schema (OpenAI structured outputs / Gemini `responseSchema`) and transcribes the visible text *before* deciding the name, so it reads before it guesses.
- **Barcodes:** a barcode decoded on the phone (checksum-verified) beats digits the AI read; AI-read digits are kept only if they pass the GS1 check digit.
- **Categories:** the shop's existing categories are sent with the prompt, so the AI reuses "Ổ cắm & Công tắc" instead of inventing "Ổ điện".
- **Matching** (`src/lib/recognition/matching.ts`): candidates come from the normal fuzzy search (by brand + model, model, name and barcode) and are scored on an absolute 0–100 % scale. Same barcode = 100 %, same model ≈ 95 %, otherwise accent-insensitive name similarity. A *different* model of the same series (WEG15929 vs WEG15919) is capped below the threshold, because it is a different product. Matches under 60 % are not shown; at most 3.
- **Photos** are stored in Postgres (`stored_images`, ~10–80 KB each) and served from `/api/images/:id`, so it works on Vercel with no extra service. Swap `src/server/services/image-storage.ts` for S3 / Vercel Blob if you store many thousands.
- **Mobile:** the phone does the heavy lifting (downscaling keeps uploads to a few hundred KB, under Vercel's 4.5 MB body limit), big buttons, large preview, action bar at the thumb, minimal typing.

### Code structure

The AI code knows nothing about the UI and the UI knows nothing about providers:

| Layer | File | Knows about |
|---|---|---|
| Provider contract | `src/server/ai/vision/types.ts` | `generateStructured(images, instructions, JSON schema)` |
| Adapters | `src/server/ai/vision/providers/openai.ts`, `gemini.ts` | HTTP, auth, error codes of one vendor |
| Factory | `src/server/ai/vision/factory.ts` + `services/ai-settings-service.ts` | Which provider/key/model is configured |
| Task | `src/server/ai/tasks/product-recognition.ts` | Prompt, output schema, clean-up of the answer |
| Workflow | `src/server/services/recognition-service.ts` | Images, matching, history, save/link |
| API | `src/app/api/ai/**` | HTTP in/out |
| UI | `src/components/recognition/*` | Screens only, via `lib/api-client.ts` |

**Adding a provider** (e.g. Claude, a local model): implement `VisionProvider` (and optionally `listModels`) in `ai/vision/providers/<name>.ts`, add it to `factory.ts` and to `PROVIDERS` in `ai-settings-service.ts`. It then works as a main or fallback model automatically, because `FallbackVisionProvider` only sees the `VisionProvider` interface.

**Adding a camera feature** (invoice recognition, shelf recognition, stock counting, image search): add a task file in `ai/tasks/` with its own prompt and JSON schema and call `getVisionProvider().generateStructured(...)`. Providers, settings, keys, image storage, rate limiting and error handling are reused as-is. For barcode recognition the phone-side ZXing decoder (`lib/barcode-detector.ts`) is already available.

### API keys and security

- Keys set as **environment variables always win** and are shown in Settings as "set on the server" (masked).
- Keys saved from **Settings** are encrypted with AES-256-GCM before they reach the database. The encryption key comes from `SETTINGS_SECRET`; without it, from `DATABASE_URL`, so a leaked database dump alone can't reveal them. Set `SETTINGS_SECRET` in production. If you change it, saved keys stop working and need re-entering (nothing else breaks).
- Keys are **write-only**: the API never returns them, only a hint like `sk-…a1b2`.
- All `/api/ai/*` routes need the admin PIN (when set) and are rate-limited (20 photos/minute per client per server instance) as a safety net against cost spikes.
- Photos go to the chosen AI provider for analysis. OpenAI does not train on API data by default; Gemini's **free tier may use inputs to improve Google products** (the paid tier does not). Check each provider's current terms if photos could show anything private.

### Other AI interfaces

`src/server/ai/types.ts` keeps the contracts for later features (`SalesAssistant`, `InventoryForecaster`, `NaturalLanguageQueryParser`), registered in `registry.ts`. None is implemented yet.

---

## Testing and quality

```bash
npm test          # 69 unit tests
npm run typecheck
npm run lint
npm run build
```

The tests cover the AI provider adapters (request format and error mapping with a mocked `fetch`), the fallback chain (retry, skip, stop, time budget) and model-list filtering, the recognition prompt/schema and answer clean-up, duplicate-match scoring, API-key encryption, search ranking against the real demo catalogue (`pan` → Panasonic, voice phrases with filler words, typos, exact number matching, barcode priority, ambiguity detection), Vietnamese text folding, money parsing, barcode check digits and CSV import/export round-trips.

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
| Barcode won't scan | Hold the phone 15–25 cm away in good light, barcode level inside the frame. Curved cans: turn the can so the barcode faces the camera squarely. Still nothing? Tap **Take a photo of the barcode**, or type the number. Laptop webcams usually can't focus close enough for barcodes, so use a phone. |
| Voice search not available | Use Google Chrome (Android/desktop) or Safari (iOS 14.5+). Firefox has no Web Speech recognition. |
| Every page shows "Có lỗi xảy ra" / "Something went wrong" after deploying | The app can't reach the database. Check that `DATABASE_URL` is set in Vercel → Settings → Environment Variables, then redeploy. The function logs (Vercel → Logs) show the exact error. |
| `prepared statement "s0" already exists` | Your connection goes through a pooler that doesn't support prepared statements (or it's `npm run db:local`). Add `&pgbouncer=true` to `DATABASE_URL` (not to the unpooled one). |
| *Detect Product* says "not set up" | Add a key in **Manage products → Smart Recognition settings** (or `OPENAI_API_KEY` / `GEMINI_API_KEY` on the server, then redeploy) and tap **Test**. |
| AI test fails with "did not accept the API key" / "run out of credit" | Check the key at the provider; OpenAI needs prepaid credit on the account. |
| Saved API key "disappeared" after a redeploy | `SETTINGS_SECRET` (or, without it, `DATABASE_URL`) changed, so the saved key can't be decrypted. Re-enter it, or move it to an environment variable. |
| "This model is currently experiencing high demand" | The provider's servers are overloaded (not your key or your usage; free tiers are served last). Add a fallback model in Settings, or wait a few minutes. |
| "This model … is no longer available to new users" | The provider retired that model. Tap **Load model list** in Settings and choose a current one (the default is updated in code from time to time). |
| Recognition is slow or times out on Vercel | The route allows 60 s (`maxDuration`); on the Hobby plan keep the default fluid compute on. Try Gemini Flash, which is usually fastest. |
| Prices look wrong after changing currency | `NEXT_PUBLIC_*` are build-time: rebuild. Existing prices are stored in minor units of the old currency. |
