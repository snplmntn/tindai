# Tindai Receipt Scanning PRD

## Product Overview

Tindai needs a receipt scanning workflow that helps a store owner add stock from supplier receipts without manual re-entry. The flow starts with a captured or uploaded receipt image, extracts text with OCR, parses candidate line items, matches those items against the store's existing catalog, and only creates stock-in records after the user reviews and confirms the result.

This feature is scoped to receipt-driven stock-in only. It does not replace the voice-first inventory loop, full accounting, or supplier management. OCR, parsing, and matching are assistive steps. The backend remains the authority for final persistence and stock changes.

### Product Principle

```text
OCR suggests.
Matching suggests.
User confirms.
Backend commits.
```

## Goals And Non-Goals

### Goals

- Let users take or upload a receipt from Android devices.
- Extract receipt text locally with Google ML Kit OCR.
- Parse likely merchant, totals, and line items.
- Fuzzy match parsed line items against store-scoped products and aliases.
- Show a review screen where users can fix quantity, price, and product mapping.
- Commit receipt items and stock-in logs only after explicit confirmation.
- Learn aliases from confirmed matches to improve future receipt matching.
- Keep the MVP practical, reliable, and auditable.

### Non-Goals

- Full expense accounting or supplier payables.
- Fully automatic product creation from OCR text.
- Automatic inventory mutation before review.
- Multi-store collaboration or approval workflows.
- Full offline end-to-end confirmation without backend connectivity.
- AI-based semantic parsing as a required dependency for MVP.

## User Personas

| Persona | Description | Need From This Feature |
| --- | --- | --- |
| Sari-sari store owner | Uses a low-end Android phone, receives paper receipts from restocking runs, and wants faster stock-in logging. | Fast receipt capture and clear review before saving stock. |
| Store helper | Assists with receiving deliveries and may not know exact product names used in the app. | Strong suggested matches, easy correction, and visible unmatched items. |
| Demo operator | Needs a reliable hackathon flow that shows business value without hidden automation. | Deterministic behavior, visible review steps, and auditable stock results. |

## User Stories

- As a store owner, I want to take a photo of a receipt so I do not need to type every line item manually.
- As a store owner, I want the app to suggest product matches so I can confirm stock-in faster.
- As a store owner, I want unmatched items clearly marked so I can decide whether to match, create, or skip them.
- As a store owner, I want stock to change only after I confirm the receipt so OCR mistakes do not corrupt my inventory.
- As a store owner, I want the app to learn aliases like `COKE 1.5L` after I confirm them so future receipts are easier to process.

## Functional Requirements

### Capture And Image Handling

- The mobile app must let the user:
  - take a receipt photo with `react-native-vision-camera`
  - choose an image from gallery with `react-native-image-picker`
  - retake or replace the image before processing
- The app must compress or resize the image before OCR and upload using `react-native-image-resizer`.
- The app must store temporary receipt files locally using `react-native-fs`.
- The app must perform basic image quality validation before processing:
  - minimum dimensions
  - file exists
  - file size below configured upload limit
  - optional blur or dark-image warning

### OCR

- The mobile app must run OCR with `@react-native-ml-kit/text-recognition`.
- OCR output must include:
  - raw text
  - optional block or line breakdown if available
  - image metadata used for debugging
- If OCR produces too little usable text, the app must show an explicit retry path.

### Parsing

- The backend must parse OCR text into:
  - merchant name
  - receipt date if present
  - subtotal, tax, total if present
  - candidate line items
- The parser must filter common noise lines such as `subtotal`, `total`, `vat`, `cash`, `change`, `cashier`, `visa`, `mastercard`, `thank you`.
- The parser must detect common quantity and price patterns such as:
  - `2 x 50.00`
  - `2 @ 50.00`
  - `ITEM NAME 2 65.00`
  - `ITEM NAME 130.00`

### Matching

- Parsed line items must be normalized before search:
  - lowercase
  - remove symbols and punctuation noise
  - collapse repeated whitespace
  - trim
  - remove known receipt stop words
- Matching must search across:
  - `product.name`
  - `product.sku`
  - `product_aliases.alias`
- Matching must use `fuse.js` with these initial thresholds:
  - `score <= 0.25` -> `HIGH_CONFIDENCE`
  - `0.25 < score <= 0.45` -> `NEEDS_REVIEW`
  - `score > 0.45` -> `UNMATCHED`
- High-confidence matches may be preselected in the UI, but they must still remain reviewable before confirm.

### Review And Correction

- The review screen must display each parsed receipt item with:
  - raw OCR name
  - normalized name
  - suggested product
  - quantity
  - unit price
  - total price
  - match confidence
  - resolution status
- The user must be able to:
  - edit quantity
  - edit unit price
  - edit total price
  - change product match
  - create a new product manually
  - skip the item
- The app must not allow receipt confirmation while there are unresolved non-skipped items.

### Confirmation And Commit

- Confirmation must call the backend.
- The backend must use one database transaction to:
  - save the final reviewed receipt state
  - create any explicitly approved new products
  - persist receipt items
  - create immutable stock logs
  - update cached stock safely through controlled server-side logic
  - save aliases from confirmed matches
- The backend must enforce idempotency for repeated confirm requests.

## Non-Functional Requirements

- Android-first, React Native + TypeScript implementation.
- Low-latency OCR on-device for typical receipt images.
- Review screen should remain usable on low-end devices with 20 to 50 line items.
- Receipt confirmation must be atomic and auditable.
- All data must remain store-scoped.
- Backend must not trust client-supplied `store_id`, product IDs, or prices without validation.
- The solution should be robust but not overengineered for MVP.

## Receipt Scanning UX Flow

```text
Take photo or upload receipt
-> compress image
-> run OCR locally
-> send image metadata + OCR text to backend
-> parse candidate receipt fields and line items
-> fuzzy match items to products and aliases
-> show review screen
-> user resolves low-confidence and unmatched items
-> user confirms
-> backend creates receipt records + stock logs
-> backend stores aliases from confirmed matches
```

### UX Rules

- The user must see when OCR or parsing confidence is weak.
- Unmatched items must be visible and actionable.
- Confirmation must feel deliberate and final.
- Success state must summarize:
  - items added to stock
  - items skipped
  - aliases learned

## Screen-By-Screen Breakdown

### 1. ReceiptScannerScreen

Purpose: capture a new receipt image or upload one from the gallery.

Key UI:

- camera preview
- gallery upload action
- flash toggle
- capture button
- basic tips for flat, well-lit receipt images

### 2. ReceiptPreviewScreen

Purpose: let the user verify the selected image before processing.

Key UI:

- image preview
- retake
- choose another image
- continue
- quality warning if image is too small or too dark

### 3. ReceiptProcessingScreen

Purpose: show OCR and backend processing progress.

Key UI:

- progress states:
  - reading receipt
  - finding items
  - matching products
- failure message with retry option

### 4. ReceiptReviewScreen

Purpose: the main review and correction surface.

Key UI:

- receipt summary card
- grouped item list
- status chips:
  - matched
  - needs review
  - unmatched
  - skipped
- editable quantity and price fields
- confirm button

### 5. ProductMatchModal

Purpose: resolve a low-confidence or unmatched item against an existing product.

Key UI:

- search box
- ranked product results
- alias results
- product details preview

### 6. CreateProductFromReceiptModal

Purpose: explicitly create a new product from a receipt item after user action.

Key UI:

- editable product name
- optional SKU
- unit
- default cost
- confirm create action

Required rule:

- This flow must only be available after the user chooses to create a product.
- No auto-created product records from OCR output.

### 7. ReceiptResultScreen

Purpose: show final outcome after backend commit.

Key UI:

- success message
- total items applied
- skipped items count
- learned aliases count
- link back to inventory history or receipt details

## Data Model

### Conceptual Entities

| Entity | Purpose |
| --- | --- |
| products | Store catalog used for matching and stock updates. |
| product_aliases | Alternate names learned from receipts or entered manually. |
| receipts | One scanned receipt and its processing lifecycle. |
| receipt_items | Parsed and reviewed line items for a receipt. |
| stock_logs | Immutable stock-in ledger rows created on confirm. |
| receipt_processing_events | Audit trail for OCR, parsing, matching, retry, and failure. |
| inventory_transaction_groups | Groups all stock logs written by one confirmed receipt. |

### Compatibility Note

Tindai's current schema uses `stores`, `inventory_items`, and `inventory_movements`. This PRD keeps `store_id` as the business scope key and documents receipt-specific tables using `products` and `stock_logs` because they are easier to reason about for this feature design. In implementation, `products` maps conceptually to the store catalog, and `stock_logs` maps conceptually to ledger-driven inventory movement records such as `inventory_movements`.

## API Endpoints

### `POST /api/v1/receipts/upload`

Purpose: create a draft receipt record and upload or register the image.

Request:

```json
{
  "fileName": "receipt-2026-04-25.jpg",
  "mimeType": "image/jpeg",
  "width": 1080,
  "height": 1920,
  "fileSize": 243812,
  "deviceCapturedAt": "2026-04-25T10:04:00Z"
}
```

Response:

```json
{
  "receiptId": "f3ceabcc-3d20-4db8-b5d6-777001122334",
  "status": "IMAGE_READY",
  "uploadUrl": "https://example-upload-url",
  "storagePath": "receipts/store-123/f3ceabcc.jpg"
}
```

### `POST /api/v1/receipts/:receiptId/process-ocr`

Purpose: store OCR output and mark OCR completion.

Request:

```json
{
  "rawText": "COKE 1.5L 2 65.00\nTOTAL 130.00",
  "ocrBlocks": [
    { "text": "COKE 1.5L 2 65.00" },
    { "text": "TOTAL 130.00" }
  ],
  "imageMeta": {
    "width": 1080,
    "height": 1920,
    "fileSize": 243812
  }
}
```

### `POST /api/v1/receipts/:receiptId/parse`

Purpose: parse OCR text into structured receipt data.

Response:

```json
{
  "receiptId": "f3ceabcc-3d20-4db8-b5d6-777001122334",
  "status": "PARSED",
  "merchantName": "ABC WHOLESALE",
  "receiptDate": "2026-04-25",
  "totalAmount": 130.00,
  "items": [
    {
      "receiptItemId": "4476d1b2-4dd8-4e65-a9e8-111122223333",
      "rawName": "COKE 1.5L",
      "quantity": 2,
      "unitPrice": 65.00,
      "lineTotal": 130.00,
      "parserConfidence": 0.88,
      "status": "PARSED"
    }
  ]
}
```

### `POST /api/v1/receipts/:receiptId/match`

Purpose: match parsed receipt items to store products and aliases.

Response:

```json
{
  "receiptId": "f3ceabcc-3d20-4db8-b5d6-777001122334",
  "status": "MATCHED",
  "items": [
    {
      "receiptItemId": "4476d1b2-4dd8-4e65-a9e8-111122223333",
      "rawName": "COKE 1.5L",
      "normalizedName": "coke 1 5l",
      "matchStatus": "HIGH_CONFIDENCE",
      "matchScore": 0.12,
      "suggestedProductId": "a3d9a3b0-8a21-4dca-ae21-444455556666",
      "suggestedProductName": "Coca-Cola 1.5 Liter"
    }
  ]
}
```

### `PATCH /api/v1/receipts/:receiptId/items/:itemId`

Purpose: persist review edits or manual resolution.

Request:

```json
{
  "quantity": 2,
  "unitPrice": 65.00,
  "resolution": "MATCH_EXISTING",
  "productId": "a3d9a3b0-8a21-4dca-ae21-444455556666"
}
```

### `POST /api/v1/receipts/:receiptId/confirm`

Purpose: finalize the reviewed receipt and apply stock-in logs.

Headers:

```text
Idempotency-Key: receipt-confirm-f3ceabcc-001
```

Request:

```json
{
  "items": [
    {
      "receiptItemId": "4476d1b2-4dd8-4e65-a9e8-111122223333",
      "action": "MATCH_EXISTING",
      "productId": "a3d9a3b0-8a21-4dca-ae21-444455556666",
      "quantity": 2,
      "unitCost": 65.00
    },
    {
      "receiptItemId": "8877d1b2-4dd8-4e65-a9e8-999900001111",
      "action": "SKIP"
    }
  ]
}
```

Response:

```json
{
  "receiptId": "f3ceabcc-3d20-4db8-b5d6-777001122334",
  "status": "COMMITTED",
  "transactionGroupId": "bf111111-2222-3333-4444-555566667777",
  "appliedItems": 1,
  "skippedItems": 1,
  "aliasesSaved": 1
}
```

### `GET /api/v1/receipts/:receiptId`

Purpose: fetch one receipt and its item state for resume or detail view.

### `GET /api/v1/receipts`

Purpose: fetch recent receipts for the authenticated store.

## Error States

| Error State | When It Happens | Required UX |
| --- | --- | --- |
| Image too blurry or dark | Before OCR or after weak OCR output | Warn user and offer retake or upload another image. |
| OCR failed | ML Kit returns no usable text | Show retry or manual re-upload path. |
| Parsing failed | Backend cannot extract enough structure | Keep raw text, show limited review, allow retry. |
| All items unmatched | Matching finds no acceptable candidates | Show unmatched list and require manual resolution or skip. |
| Duplicate confirm request | User taps confirm repeatedly or network retries | Return idempotent result, do not double-apply stock. |
| Receipt already committed | Confirm called on final receipt | Show read-only committed result. |
| Upload failed | Network/storage issue | Keep local draft and allow retry. |
| Unauthorized | Session expired or invalid | Require sign-in again before confirm. |

## Edge Cases

- OCR reads header or footer text as product lines.
- A line item contains quantity but no unit price.
- The receipt has one merged line for multiple items.
- The same product appears on multiple receipt lines.
- OCR confuses `0` and `O`, `1` and `I`, or decimal separators.
- The receipt contains discounts or free items.
- The receipt includes returns or negative quantities.
- The receipt contains abbreviations that match multiple products equally.
- The user confirms after the product was archived or changed in another session.

## Security Considerations

- The backend must derive `store_id` from the authenticated session, never from the client body.
- Mobile clients must not write final stock records directly to the database.
- Product creation, alias learning, and stock-in commits must happen server-side.
- Uploaded receipt images must be stored in store-scoped paths or buckets.
- Receipt images and OCR text may contain sensitive business details and should be access-controlled by store ownership.
- Audit events should not expose secrets, tokens, or service role credentials.

## Offline And Retry Considerations

This feature should be MVP-friendly rather than fully offline-complete.

### In Scope

- Capture receipt image offline.
- Compress and keep a local temporary file.
- Preserve a local draft if upload fails.
- Retry upload and processing when connectivity returns.

### Out Of Scope For MVP

- Full offline backend parsing and matching.
- Offline confirmation that mutates cloud inventory without backend access.
- Multi-device conflict resolution for the same receipt.

## Matching And Alias-Learning Logic

### Normalization

Apply this function to receipt item text, product names, SKUs, and aliases before fuzzy search:

```ts
function normalizeReceiptText(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .replace(/\b(subtotal|total|vat|cash|change|qty|pc|pcs|amount|amt|cashier)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### Matching Search Corpus

- `products.name`
- `products.sku`
- `product_aliases.alias`

### Match Outcome Rules

| Match Status | Rule | Default UI Behavior |
| --- | --- | --- |
| `HIGH_CONFIDENCE` | `score <= 0.25` | Preselect match, still editable. |
| `NEEDS_REVIEW` | `0.25 < score <= 0.45` | Highlight and require user check. |
| `UNMATCHED` | `score > 0.45` or no candidate | Require explicit match, create, or skip. |

### Alias Learning

Save an alias only when:

- the user confirms a match to an existing product, or
- the user confirms a newly created product from that receipt item

Do not save aliases when:

- the item remains unmatched
- the user skips the item
- the candidate line is later identified as noise

Example:

```text
Receipt item: COKE 1.5L
Matched product: Coca-Cola 1.5 Liter
Saved alias: COKE 1.5L
```

## Receipt Status Lifecycle

### Receipt Status

| Status | Meaning |
| --- | --- |
| `DRAFT` | Receipt record exists but image or data is incomplete. |
| `IMAGE_READY` | Receipt image is uploaded or registered. |
| `OCR_DONE` | OCR text was extracted successfully. |
| `PARSED` | Backend parsed structured receipt data. |
| `MATCHED` | Product matching is complete. |
| `IN_REVIEW` | User is editing or resolving items. |
| `COMMITTED` | Receipt confirmation succeeded and stock logs were written. |
| `FAILED` | Processing failed and needs retry. |
| `CANCELLED` | User abandoned the receipt. |

### Receipt Item Status

| Status | Meaning |
| --- | --- |
| `PARSED` | Item came from parser but is not yet matched. |
| `HIGH_CONFIDENCE` | Fuzzy match is strong. |
| `NEEDS_REVIEW` | Fuzzy match is ambiguous. |
| `UNMATCHED` | No acceptable candidate found. |
| `MATCHED_EXISTING` | User matched to an existing product. |
| `CREATED_PRODUCT` | User created a new product from this item. |
| `SKIPPED` | User excluded the item from stock-in. |
| `COMMITTED` | Item contributed to final stock logs. |

## Implementation Phases

### Phase 1: Receipt Capture And Upload

- Build receipt capture with `react-native-vision-camera`.
- Add gallery upload with `react-native-image-picker`.
- Compress images with `react-native-image-resizer`.
- Store temporary local files with `react-native-fs`.
- Add basic quality checks before processing.

### Phase 2: OCR Extraction

- Integrate `@react-native-ml-kit/text-recognition`.
- Extract raw OCR text on device.
- Handle OCR failure and weak text results.
- Send image metadata and OCR text to backend.

### Phase 3: Receipt Parsing

- Build a deterministic backend parser.
- Extract merchant, date, totals, and candidate line items.
- Filter out noise lines.
- Parse quantity, unit price, and total price when possible.

### Phase 4: Product Matching

- Normalize item text.
- Search product names, SKUs, and aliases.
- Use `fuse.js` thresholds.
- Return match status and confidence.

### Phase 5: Review And Correction UX

- Display parsed items and suggestions.
- Allow quantity and price edits.
- Allow changing product matches.
- Allow creating a new product explicitly.
- Allow skipping individual items.

### Phase 6: Confirm And Commit Inventory

- Run one backend transaction for the final commit.
- Save reviewed receipt items.
- Create stock logs.
- Update product stock safely.
- Save aliases from confirmed matches.

### Phase 7: Hardening

- Add retry upload behavior.
- Enforce confirm idempotency.
- Warn on possible duplicate receipts.
- Improve error handling and processing observability.
- Add audit or debug logging.

## Testing Plan

### Unit Tests

- text normalization
- stop-word removal
- parser helpers
- fuzzy match thresholds
- alias learning rules
- duplicate detection helpers

### Integration Tests

- upload to parse to match pipeline
- confirm transaction atomicity
- idempotent confirm retries
- no stock logs written before confirm
- skipped items do not affect stock
- alias saved only for confirmed matches

### UI Tests

- capture and preview flow
- OCR failure retry flow
- review screen editing
- unmatched item resolution
- create-product modal
- committed result screen

### Manual Acceptance Scenarios

1. Scan a simple receipt with one known product and confirm it updates stock.
2. Scan a receipt with one low-confidence match and resolve it manually.
3. Scan a receipt with an unknown item and choose skip.
4. Scan a receipt with an unknown item and create a new product explicitly.
5. Retry confirm with the same idempotency key and verify no duplicate stock logs are written.

## Success Metrics

- Receipt-to-review median time under 10 seconds on target Android hardware for common receipts.
- At least 80 percent of common demo receipt items land in `HIGH_CONFIDENCE` or `NEEDS_REVIEW`, not `UNMATCHED`.
- At least 95 percent of confirmed receipts complete without duplicate stock writes.
- Review completion rate above 85 percent for successfully parsed receipts.
- Alias learning reduces manual corrections on repeat receipts over time.

## Future Enhancements

- Cloud OCR fallback for difficult receipts.
- Supplier recognition and supplier-linked analytics.
- Duplicate receipt detection using image hash plus merchant and total heuristics.
- Better parser support for discounts, returns, and bundled items.
- AI-assisted parse fallback for hard receipts.
- Batch receipt import.
- Receipt-linked spending analytics.

## SQL DDL

### SQL Notes

- This DDL uses `store_id` as the business scope key because that matches the current Tindai schema.
- `products` and `stock_logs` are feature-oriented names for this PRD. In production, the team may merge them into existing `inventory_items` and `inventory_movements`.
- `stock_logs` is immutable by design.

```sql
create extension if not exists "pgcrypto";

create type receipt_status as enum (
  'DRAFT',
  'IMAGE_READY',
  'OCR_DONE',
  'PARSED',
  'MATCHED',
  'IN_REVIEW',
  'COMMITTED',
  'FAILED',
  'CANCELLED'
);

create type receipt_item_status as enum (
  'PARSED',
  'HIGH_CONFIDENCE',
  'NEEDS_REVIEW',
  'UNMATCHED',
  'MATCHED_EXISTING',
  'CREATED_PRODUCT',
  'SKIPPED',
  'COMMITTED'
);

create type stock_log_source as enum (
  'RECEIPT_CONFIRM'
);

create type receipt_processing_event_type as enum (
  'UPLOAD_STARTED',
  'UPLOAD_COMPLETED',
  'OCR_STARTED',
  'OCR_COMPLETED',
  'OCR_FAILED',
  'PARSE_STARTED',
  'PARSE_COMPLETED',
  'PARSE_FAILED',
  'MATCH_STARTED',
  'MATCH_COMPLETED',
  'MATCH_FAILED',
  'REVIEW_UPDATED',
  'CONFIRM_STARTED',
  'CONFIRM_COMPLETED',
  'CONFIRM_FAILED',
  'DUPLICATE_WARNING'
);

create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  sku text,
  name text not null,
  normalized_name text not null,
  unit text not null default 'pcs',
  default_cost numeric(12,2),
  current_stock numeric(12,3) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (btrim(name) <> ''),
  constraint products_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint products_unit_not_blank check (btrim(unit) <> ''),
  constraint products_default_cost_non_negative check (default_cost is null or default_cost >= 0)
);

create unique index products_store_name_unique
  on products (store_id, lower(name));

create unique index products_store_sku_unique
  on products (store_id, lower(sku))
  where sku is not null;

create index products_store_normalized_name_idx
  on products (store_id, normalized_name);

create table product_aliases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source text not null default 'receipt_confirmation',
  created_from_receipt_id uuid,
  created_from_receipt_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_aliases_alias_not_blank check (btrim(alias) <> ''),
  constraint product_aliases_normalized_alias_not_blank check (btrim(normalized_alias) <> '')
);

create unique index product_aliases_store_product_alias_unique
  on product_aliases (store_id, product_id, normalized_alias);

create index product_aliases_store_normalized_alias_idx
  on product_aliases (store_id, normalized_alias);

create table receipts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  status receipt_status not null default 'DRAFT',
  image_storage_path text,
  image_file_name text,
  image_mime_type text,
  image_width integer,
  image_height integer,
  image_file_size bigint,
  image_sha256 text,
  raw_ocr_text text,
  merchant_name text,
  receipt_date date,
  subtotal_amount numeric(12,2),
  tax_amount numeric(12,2),
  total_amount numeric(12,2),
  duplicate_warning boolean not null default false,
  duplicate_of_receipt_id uuid references receipts(id) on delete set null,
  committed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index receipts_store_status_created_at_idx
  on receipts (store_id, status, created_at desc);

create index receipts_store_receipt_date_idx
  on receipts (store_id, receipt_date desc);

create index receipts_store_total_amount_idx
  on receipts (store_id, total_amount);

create table inventory_transaction_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  receipt_id uuid not null references receipts(id) on delete cascade,
  idempotency_key text not null,
  source text not null default 'receipt_confirm',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_transaction_groups_idempotency_key_not_blank check (btrim(idempotency_key) <> ''),
  constraint inventory_transaction_groups_store_receipt_unique unique (store_id, receipt_id),
  constraint inventory_transaction_groups_store_idempotency_unique unique (store_id, idempotency_key)
);

create table receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status receipt_item_status not null default 'PARSED',
  raw_name text not null,
  normalized_name text not null,
  quantity numeric(12,3) not null default 1,
  unit_price numeric(12,2),
  line_total numeric(12,2),
  parser_confidence numeric(4,3),
  match_score numeric(6,5),
  matched_product_id uuid references products(id) on delete set null,
  resolved_action text,
  skip_reason text,
  created_product_id uuid references products(id) on delete set null,
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipt_items_raw_name_not_blank check (btrim(raw_name) <> ''),
  constraint receipt_items_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint receipt_items_quantity_positive check (quantity > 0),
  constraint receipt_items_unit_price_non_negative check (unit_price is null or unit_price >= 0),
  constraint receipt_items_line_total_non_negative check (line_total is null or line_total >= 0),
  constraint receipt_items_parser_confidence_range check (parser_confidence is null or (parser_confidence >= 0 and parser_confidence <= 1)),
  constraint receipt_items_match_score_range check (match_score is null or (match_score >= 0 and match_score <= 1))
);

create index receipt_items_receipt_idx
  on receipt_items (receipt_id);

create index receipt_items_store_status_idx
  on receipt_items (store_id, status);

create index receipt_items_store_matched_product_idx
  on receipt_items (store_id, matched_product_id);

create table stock_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  receipt_id uuid not null references receipts(id) on delete restrict,
  receipt_item_id uuid not null references receipt_items(id) on delete restrict,
  transaction_group_id uuid not null references inventory_transaction_groups(id) on delete restrict,
  source stock_log_source not null,
  quantity_delta numeric(12,3) not null,
  unit_cost numeric(12,2),
  stock_after numeric(12,3),
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint stock_logs_quantity_delta_positive check (quantity_delta > 0),
  constraint stock_logs_unit_cost_non_negative check (unit_cost is null or unit_cost >= 0),
  constraint stock_logs_idempotency_key_not_blank check (btrim(idempotency_key) <> '')
);

create unique index stock_logs_store_receipt_item_unique
  on stock_logs (store_id, receipt_item_id);

create index stock_logs_store_product_occurred_at_idx
  on stock_logs (store_id, product_id, occurred_at desc);

create index stock_logs_store_receipt_idx
  on stock_logs (store_id, receipt_id);

create table receipt_processing_events (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  event_type receipt_processing_event_type not null,
  event_status text not null default 'ok',
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index receipt_processing_events_receipt_created_at_idx
  on receipt_processing_events (receipt_id, created_at desc);

create index receipt_processing_events_store_event_type_idx
  on receipt_processing_events (store_id, event_type, created_at desc);

create or replace function prevent_stock_logs_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'stock_logs is immutable; insert corrective rows instead of updating or deleting';
end;
$$;

create trigger stock_logs_prevent_update
  before update on stock_logs
  for each row execute function prevent_stock_logs_mutation();

create trigger stock_logs_prevent_delete
  before delete on stock_logs
  for each row execute function prevent_stock_logs_mutation();
```

## Practical Tradeoffs

- On-device OCR keeps the user flow fast and reduces backend dependency, but parser quality will still vary by receipt quality.
- Deterministic backend parsing is safer for MVP than a model-first parser, but it will miss some messy receipt layouts.
- Using review-before-commit adds friction, but it protects inventory accuracy and auditability.
- Alias learning after confirmation improves matching over time without taking the risk of learning OCR garbage.
