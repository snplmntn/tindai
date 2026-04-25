# Analytics Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic grocery-trip shopping lists to analytics predictions on client and server, with preset horizon switching in the mobile analytics page.

**Architecture:** Extend the shared analytics prediction shape in both client and server code with preset-based shopping-list data derived from the existing demand forecast inputs. Keep reorder quantities deterministic and offline-safe, while allowing Gemini to summarize the resulting list when online analytics are available.

**Tech Stack:** React Native, TypeScript, Vitest, Express, Supabase admin queries, Gemini text generation

---

### Task 1: Lock The Prediction Contract With Tests

**Files:**
- Modify: `client/src/features/analytics/buildAnalyticsViewModel.test.ts`
- Modify: `client/src/screens/tabs/AnalyticsScreen.test.tsx`
- Create: `server/src/tests/analytics.model.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
expect(result.predictions.shoppingPresets.map((preset) => preset.label)).toEqual([
  '7 days',
  '14 days',
  '1 month',
]);
expect(result.predictions.shoppingListByPreset['7d'][0]?.recommendedBuyQuantity).toBe(1);
expect(result.predictions.shoppingListByPreset['14d'][0]?.recommendedBuyQuantity).toBe(6);
expect(result.predictions.shoppingListByPreset['30d'][1]?.itemName).toBe('Bigas');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: FAIL with missing shopping-list fields and missing grocery-trip UI

- [ ] **Step 3: Add backend contract test**

```ts
expect(result.predictions.shoppingListByPreset['14d'][0]?.recommendedBuyQuantity).toBe(6);
expect(mockedGenerateGeminiText).toHaveBeenCalledWith(expect.stringContaining('7-day grocery trip'));
```

- [ ] **Step 4: Run the backend test to verify it fails**

Run: `npm test -- server/src/tests/analytics.model.test.ts`
Expected: FAIL because analytics summary does not yet expose shopping lists in the model test

### Task 2: Implement Shopping-List Computation

**Files:**
- Modify: `client/src/features/analytics/buildAnalyticsViewModel.ts`
- Modify: `server/src/models/analytics.model.ts`

- [ ] **Step 1: Add shared prediction types and preset metadata**

```ts
export type AnalyticsShoppingPresetKey = '7d' | '14d' | '30d';
export type AnalyticsShoppingListItem = {
  itemId: string;
  itemName: string;
  unit: string;
  currentStock: number;
  averageDailyUnits: number;
  horizonDays: number;
  projectedUnitsNeeded: number;
  recommendedBuyQuantity: number;
  reason: string;
};
```

- [ ] **Step 2: Implement deterministic shopping-list builders**

```ts
const recommendedBuyQuantity = Math.max(0, Math.ceil(projectedUnitsNeeded - currentStock));
if (recommendedBuyQuantity <= 0) {
  return null;
}
```

- [ ] **Step 3: Feed shopping-list data into predictions and Gemini prompt input**

```ts
shoppingPresets: SHOPPING_PRESETS,
shoppingListByPreset,
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts server/src/tests/analytics.model.test.ts`
Expected: PASS

### Task 3: Render The Grocery Trip UI

**Files:**
- Modify: `client/src/features/analytics/AnalyticsView.tsx`
- Modify: `client/src/screens/tabs/AnalyticsScreen.test.tsx`

- [ ] **Step 1: Add preset switching state in Predictions tab**

```ts
const [selectedPreset, setSelectedPreset] = useState<AnalyticsShoppingPresetKey>('7d');
const shoppingItems = viewModel.predictions.shoppingListByPreset[selectedPreset] ?? [];
```

- [ ] **Step 2: Render the Next Grocery Trip card**

```tsx
<SectionHeader title="Next Grocery Trip" />
<ShoppingPresetRail ... />
<ShoppingList items={shoppingItems} />
```

- [ ] **Step 3: Keep prediction and recommendation cards intact**

```tsx
<CardSurface>
  <SectionHeader title="Stock Prediction" />
  <PredictionList items={predictionItems} />
</CardSurface>
```

- [ ] **Step 4: Run the screen test and verify it passes**

Run: `npm test -- client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: PASS

### Task 4: Verify And Document

**Files:**
- Modify: `docs/prd/tindai-hackathon-mvp-prd.md`

- [ ] **Step 1: Update analytics documentation for shopping-list guidance**

```md
- Prediction-driven grocery-trip list with quantity guidance for 7 days, 14 days, and 1 month.
```

- [ ] **Step 2: Run the relevant checks**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: PASS

Run: `npm test -- server/src/tests/analytics.test.ts server/src/tests/analytics.model.test.ts`
Expected: PASS

