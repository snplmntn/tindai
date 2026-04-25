# Analytics Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder client analytics screen with a client-only analytics experience that shows `Overview`, `Insights`, and `Predictions & AI` from local SQLite ledger data.

**Architecture:** Keep analytics entirely inside the Expo client. Read local-first inventory and transaction data from SQLite, compute a dedicated analytics view model in a focused feature module, and render the approved three-tab screen with lightweight cards and chart-like blocks instead of adding a backend dependency or heavy chart library.

**Tech Stack:** React Native, TypeScript, Expo SQLite, Vitest, react-test-renderer

---

### Task 1: Add Analytics Data Tests And View-Model Contract

**Files:**
- Create: `client/src/features/analytics/buildAnalyticsViewModel.test.ts`
- Create: `client/src/features/analytics/buildAnalyticsViewModel.ts`

- [ ] **Step 1: Write the failing analytics computation tests**

```ts
it('builds overview metrics, trend lists, and restock guidance from local ledger rows', () => {
  const result = buildAnalyticsViewModel({
    currencyCode: 'PHP',
    timezone: 'Asia/Manila',
    inventoryItems: [
      { id: 'coke', storeId: 'store-1', name: 'Coke Mismo', aliases: ['coke'], unit: 'pcs', price: 20, currentStock: 4, lowStockThreshold: 5, updatedAt: '2026-04-25T00:00:00.000Z' },
      { id: 'soap', storeId: 'store-1', name: 'Safeguard', aliases: ['safeguard'], unit: 'pcs', price: 25, currentStock: 10, lowStockThreshold: 3, updatedAt: '2026-04-25T00:00:00.000Z' },
    ],
    salesRows: [
      { itemId: 'coke', itemName: 'Coke Mismo', unit: 'pcs', quantityDelta: -3, unitPrice: 20, lineTotal: 60, occurredAt: '2026-04-25T02:00:00.000Z', isUtang: false },
      { itemId: 'coke', itemName: 'Coke Mismo', unit: 'pcs', quantityDelta: -2, unitPrice: 20, lineTotal: 40, occurredAt: '2026-04-19T02:00:00.000Z', isUtang: false },
      { itemId: 'soap', itemName: 'Safeguard', unit: 'pcs', quantityDelta: -1, unitPrice: 25, lineTotal: 25, occurredAt: '2026-04-11T02:00:00.000Z', isUtang: false },
    ],
    now: '2026-04-25T10:00:00.000Z',
  });

  expect(result.overview.salesToday.value).toBe('P60');
  expect(result.overview.lowStock[0]?.itemName).toBe('Coke Mismo');
  expect(result.insights.risingDemand[0]?.itemName).toBe('Coke Mismo');
  expect(result.predictions.restockSoon[0]?.itemName).toBe('Coke Mismo');
});
```

- [ ] **Step 2: Run the new analytics test to verify it fails**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts`
Expected: FAIL with missing module or missing export for `buildAnalyticsViewModel`

- [ ] **Step 3: Write the minimal analytics view-model implementation**

```ts
export function buildAnalyticsViewModel(input: AnalyticsInput): AnalyticsViewModel {
  // Compute day and month totals in store timezone, rank products,
  // derive low-stock and movement lists, and generate deterministic restock guidance.
}
```

- [ ] **Step 4: Run the analytics test again and verify it passes**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/analytics/buildAnalyticsViewModel.ts client/src/features/analytics/buildAnalyticsViewModel.test.ts
git commit -m "feat(analytics): add client analytics view model"
```

### Task 2: Add Analytics Local Data Access And Screen Tests

**Files:**
- Create: `client/src/features/analytics/analyticsRepository.ts`
- Create: `client/src/screens/tabs/AnalyticsScreen.test.tsx`
- Modify: `client/src/features/local-data/LocalDataContext.tsx`

- [ ] **Step 1: Write the failing analytics screen test**

```ts
it('shows the overview tab first and switches to predictions when selected', () => {
  const tree = TestRenderer.create(<AnalyticsScreen />);

  expect(findAllText(tree, 'Overview')).not.toHaveLength(0);

  act(() => {
    findPressableByText(tree, 'Predictions & AI').props.onPress();
  });

  expect(findAllText(tree, 'Restock Soon')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run the screen test to verify it fails**

Run: `npm test -- client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: FAIL because the placeholder screen does not render internal analytics tabs

- [ ] **Step 3: Add the minimal repository and context support needed by the screen**

```ts
export class AnalyticsRepository {
  async listSalesRows(storeId: string): Promise<AnalyticsSalesRow[]> {
    return this.database.getAllAsync(/* join local transactions and transaction_items */);
  }
}
```

- [ ] **Step 4: Re-run the screen test and verify it still fails for missing UI, not data wiring**

Run: `npm test -- client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: FAIL with a render assertion that points to missing analytics UI

- [ ] **Step 5: Commit**

```bash
git add client/src/features/analytics/analyticsRepository.ts client/src/features/local-data/LocalDataContext.tsx client/src/screens/tabs/AnalyticsScreen.test.tsx
git commit -m "feat(analytics): add analytics data loading support"
```

### Task 3: Implement The Analytics Screen And Components

**Files:**
- Create: `client/src/features/analytics/AnalyticsView.tsx`
- Create: `client/src/features/analytics/analyticsFormatting.ts`
- Modify: `client/src/screens/tabs/AnalyticsScreen.tsx`

- [ ] **Step 1: Replace the placeholder screen with the approved internal sub-tab layout**

```ts
const tabs = ['Overview', 'Insights', 'Predictions & AI'] as const;
const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Overview');
```

- [ ] **Step 2: Render overview, insights, and prediction sections from the computed view model**

```tsx
{activeTab === 'Overview' ? <OverviewTab data={viewModel.overview} /> : null}
{activeTab === 'Insights' ? <InsightsTab data={viewModel.insights} /> : null}
{activeTab === 'Predictions & AI' ? <PredictionsTab data={viewModel.predictions} /> : null}
```

- [ ] **Step 3: Add lightweight chart-like blocks without adding a third-party chart dependency**

```tsx
<View style={styles.chartRow}>
  {points.map((point) => (
    <View key={point.label} style={[styles.chartBar, { height: point.height }]} />
  ))}
</View>
```

- [ ] **Step 4: Run the analytics screen and view-model tests and verify they pass**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/features/analytics client/src/screens/tabs/AnalyticsScreen.tsx
git commit -m "feat(analytics): build client analytics tabs"
```

### Task 4: Run Client Verification

**Files:**
- Verify only

- [ ] **Step 1: Run the client test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run the client typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Inspect the final diff for client-only scope**

Run: `git diff --stat`
Expected: Only client analytics files and the implementation plan/spec files changed

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-25-analytics-tabs-implementation.md
git commit -m "docs(analytics): add analytics implementation plan"
```
