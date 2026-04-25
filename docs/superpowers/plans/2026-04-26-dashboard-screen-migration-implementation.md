# Dashboard Screen Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the React Native dashboard screen to match `client/src/dashboard-ui.txt` while preserving the mic-driven inventory workflow and current data wiring.

**Architecture:** Keep `client/src/screens/tabs/DashboardScreen.tsx` as the only runtime screen module and reuse its existing handlers. Add a focused dashboard test file that locks in the migrated hero, summary, and banner layout before the UI implementation changes.

**Tech Stack:** React Native, TypeScript, Vitest, react-test-renderer

---

### Task 1: Add dashboard layout tests first

**Files:**
- Create: `client/src/screens/tabs/DashboardScreen.test.tsx`
- Test: `client/src/screens/tabs/DashboardScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('renders the migrated dashboard hero and summary headings', async () => {
  const tree = await renderDashboardScreen();

  expect(findTextNodes(tree, 'Tindai')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Pindutin para ilista ang benta')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Buod Ngayon')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: FAIL because the current screen does not render the migrated mockup headings.

- [ ] **Step 3: Write minimal implementation**

```typescript
<Text style={styles.brandName}>Tindai</Text>
<Text style={styles.voiceTitle}>Pindutin para ilista ang benta</Text>
<Text style={styles.sectionTitle}>Buod Ngayon</Text>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: PASS for the new layout expectations with no broken interactions in the test setup.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/DashboardScreen.test.tsx client/src/screens/tabs/DashboardScreen.tsx
git commit -m "test(dashboard): cover migrated layout"
```

### Task 2: Migrate the dashboard presentation without changing handlers

**Files:**
- Modify: `client/src/screens/tabs/DashboardScreen.tsx`
- Test: `client/src/screens/tabs/DashboardScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('keeps guest backup messaging and the add-item action in the migrated UI', async () => {
  const tree = await renderDashboardScreen({ authMode: 'guest', appMode: 'guest' });

  expect(findTextNodes(tree, 'Lokal lang ang data mo. Mag-sign in para ma-backup sa cloud.')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Magdagdag ng item')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: FAIL until the migrated banner copy and hero button labels are implemented.

- [ ] **Step 3: Write minimal implementation**

```typescript
<Text style={styles.bannerText}>Lokal lang ang data mo. Mag-sign in para ma-backup sa cloud.</Text>
<Text style={styles.addItemButtonLabel}>Magdagdag ng item</Text>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: PASS with guest banner and hero CTA coverage added.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/DashboardScreen.tsx client/src/screens/tabs/DashboardScreen.test.tsx
git commit -m "feat(dashboard): migrate dashboard screen UI"
```

### Task 3: Verify the migrated dashboard interactions remain reachable

**Files:**
- Test: `client/src/screens/tabs/DashboardScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('still shows inventory controls after the layout migration', async () => {
  const tree = await renderDashboardScreen();

  expect(findTextNodes(tree, 'Kamakailang Tala')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Coke Mismo')).not.toHaveLength(0);
  expect(findIconButtons(tree, 'remove')).not.toHaveLength(0);
  expect(findIconButtons(tree, 'add')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: FAIL until the migrated list and controls are rendered under the new section styling.

- [ ] **Step 3: Write minimal implementation**

```typescript
<Text style={styles.sectionTitle}>Kamakailang Tala</Text>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/DashboardScreen.test.tsx`
Expected: PASS with the inventory section still reachable and manually adjustable in the rendered output.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/DashboardScreen.tsx client/src/screens/tabs/DashboardScreen.test.tsx
git commit -m "test(dashboard): verify migrated controls remain visible"
```
