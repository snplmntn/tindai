# Analytics Shopping List Design

## Goal

Add a grocery-trip shopping list to the analytics Predictions tab so store owners can see what to buy next, with quantities derived from recent inventory movement predictions. The list must work offline first and stay compatible with online Gemini-enriched analytics summaries.

## Scope

- Extend analytics predictions with horizon presets for `7 days`, `14 days`, and `1 month`.
- Compute deterministic reorder quantities from recent average daily sales and current stock.
- Render the shopping list in the client Predictions tab with preset switching.
- Keep Gemini as an optional summary layer, not the source of reorder quantities.

## Data Contract

Add shopping-list fields under `predictions`:

- `shoppingPresets`: ordered preset metadata for `7d`, `14d`, `30d`
- `shoppingListByPreset`: deterministic list of reorder rows keyed by preset

Each shopping-list row includes:

- item identity and unit
- current stock
- average daily sales
- selected horizon days
- projected units needed
- recommended buy quantity
- plain-language reason

## Rules

- Use the existing 7-day movement forecast basis.
- Recommended buy quantity is `ceil(projected demand - current stock)`.
- Only include items where the result is greater than zero.
- Sort urgent items first using predicted stockout timing, then larger buy quantities.
- If there is not enough recent sales history, show an honest empty state.

## Offline And Online Behavior

- Offline analytics compute the full shopping list locally from SQLite-backed inventory and sales rows.
- Online analytics return the same shopping-list structure from the backend summary endpoint.
- If Gemini is available, it may summarize the predictions and shopping list, but it must not replace deterministic quantities.

## UI

- Add a `Next Grocery Trip` section to the Predictions tab.
- Default to `7 days`.
- Allow switching between `7 days`, `14 days`, and `1 month`.
- Show quantity-first copy, for example `Buy 6 pcs`, with supporting stock and demand detail.

## Testing

- Client view-model tests for preset quantities and empty states.
- Client screen tests for preset switching and remote summary rendering.
- Server model tests for shopping-list payload generation and Gemini prompt enrichment.
