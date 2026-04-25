# Analytics Parity Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make business analytics consistent across offline and online paths by surfacing low-stock, sold-today, and utang data, and by keeping analytics local-first when unsynced transactions exist.

**Architecture:** Extend the shared analytics view model on client and server with explicit sold-today and utang summary fields, then update the Analytics screen to render those sections directly. Preserve offline correctness by using the full local analytics model whenever pending transactions exist, instead of mixing local overview with remote predictions.

**Tech Stack:** React Native, TypeScript, Expo SQLite, Express, Vitest

---

### Task 1: Lock Behavior With Failing Tests

**Files:**
- Modify: `client/src/features/analytics/buildAnalyticsViewModel.test.ts`
- Modify: `client/src/screens/tabs/AnalyticsScreen.test.tsx`
- Modify: `server/src/tests/analytics.model.test.ts`

- [ ] **Step 1: Write the failing client view-model test**

Add assertions for:
- explicit `itemsSoldToday`
- non-empty `lowStock` list remaining visible in the model
- `utangSummary` with total balance and top customers

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts`
Expected: FAIL because the new analytics fields do not exist yet.

- [ ] **Step 3: Write the failing screen test**

Add assertions for:
- visible low-stock section in Analytics
- visible items sold today metric/list
- visible utang summary card/list
- full local analytics usage when pending transactions exist

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: FAIL because the UI does not render the new analytics sections and still mixes local/remote state.

- [ ] **Step 5: Write the failing server analytics test**

Add assertions for:
- `overview.itemsSoldToday`
- `overview.utangSummary`
- top utang customers and total outstanding balance

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- server/src/tests/analytics.model.test.ts`
Expected: FAIL because the server summary does not return the new fields yet.

### Task 2: Implement Shared Analytics Model Updates

**Files:**
- Modify: `client/src/features/analytics/buildAnalyticsViewModel.ts`
- Modify: `client/src/features/analytics/analyticsRepository.ts`
- Modify: `server/src/models/analytics.model.ts`

- [ ] **Step 1: Add minimal client analytics types and computations**

Implement:
- `itemsSoldToday`
- `utangSummary`
- local utang row support in the repository

- [ ] **Step 2: Run client model test to verify it passes**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts`
Expected: PASS

- [ ] **Step 3: Add minimal server analytics fields**

Implement:
- server-side sold-today item ranking
- utang summary from store-scoped customers
- response shape parity with client model

- [ ] **Step 4: Run server model test to verify it passes**

Run: `npm test -- server/src/tests/analytics.model.test.ts`
Expected: PASS

### Task 3: Wire Screen Behavior And Rendering

**Files:**
- Modify: `client/src/screens/tabs/AnalyticsScreen.tsx`
- Modify: `client/src/features/analytics/AnalyticsView.tsx`

- [ ] **Step 1: Switch pending-transaction merge behavior**

Use the full local analytics model whenever pending transactions exist.

- [ ] **Step 2: Add low-stock, sold-today, and utang sections to the Analytics UI**

Render the new analytics data in Overview and/or Insights without introducing write actions.

- [ ] **Step 3: Run screen test to verify it passes**

Run: `npm test -- client/src/screens/tabs/AnalyticsScreen.test.tsx`
Expected: PASS

### Task 4: Final Verification

**Files:**
- Modify: `server/src/tests/analytics.test.ts` if contract coverage needs updates

- [ ] **Step 1: Run targeted analytics suites**

Run: `npm test -- client/src/features/analytics/buildAnalyticsViewModel.test.ts client/src/screens/tabs/AnalyticsScreen.test.tsx server/src/tests/analytics.model.test.ts server/src/tests/analytics.test.ts`
Expected: PASS

- [ ] **Step 2: Review for parity**

Confirm:
- local and remote payloads expose the same analytics fields
- pending local transactions keep analytics fully local
- analytics UI shows low stock, sold today, and utang directly
