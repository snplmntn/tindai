# Profile Screen Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the profile screen UI in React Native based on `client/src/new-prof-ui.txt` while preserving the existing profile behavior and auth flows.

**Architecture:** Keep `ProfileScreen.tsx` as the screen entry point and migrate only the presentational structure. Use test-first updates in `ProfileScreen.test.tsx` to lock in the revised UI expectations before restyling the screen and reusing the existing data and action handlers.

**Tech Stack:** React Native, TypeScript, Vitest, react-test-renderer

---

### Task 1: Lock in the new profile layout with failing tests

**Files:**
- Modify: `client/src/screens/tabs/ProfileScreen.test.tsx`
- Test: `client/src/screens/tabs/ProfileScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('shows the migrated profile hero and local-data card copy', async () => {
  const tree = await renderProfileScreen();

  expect(findTextNodes(tree, 'Profile')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Lokal ang data mo')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Ana Mercado')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: FAIL because the old layout does not render the new info card copy.

- [ ] **Step 3: Write minimal implementation**

```typescript
<View style={styles.infoCard}>
  <Text style={styles.infoChipLabel}>Lokal ang data mo</Text>
</View>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: PASS for the new assertion and no regressions in the existing profile interactions.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/ProfileScreen.test.tsx client/src/screens/tabs/ProfileScreen.tsx
git commit -m "test(profile): cover migrated profile layout"
```

### Task 2: Migrate the screen layout while preserving profile behavior

**Files:**
- Modify: `client/src/screens/tabs/ProfileScreen.tsx`
- Test: `client/src/screens/tabs/ProfileScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('shows signed-out auth actions with guest profile copy', async () => {
  mockedIsAuthenticated = false;
  mockedStoreName = null;

  const tree = await renderProfileScreen();

  expect(findTextNodes(tree, 'Gumawa ng Account')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Mag-log In')).not.toHaveLength(0);
  expect(findTextNodes(tree, 'Walang email')).not.toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: FAIL because the current signed-out copy still renders `Log in` and `Create account`.

- [ ] **Step 3: Write minimal implementation**

```typescript
<Pressable style={styles.primaryButton} onPress={() => void showSignUp()}>
  <Text style={styles.primaryButtonLabel}>Gumawa ng Account</Text>
</Pressable>
<Pressable style={styles.secondaryButton} onPress={showLogin}>
  <Text style={styles.secondaryButtonLabel}>Mag-log In</Text>
</Pressable>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: PASS with signed-out CTA coverage added and existing authenticated tests still green.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/ProfileScreen.tsx client/src/screens/tabs/ProfileScreen.test.tsx
git commit -m "feat(profile): migrate profile screen layout"
```

### Task 3: Verify the migrated screen end to end at unit-test level

**Files:**
- Test: `client/src/screens/tabs/ProfileScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
it('keeps edit mode behavior after the layout migration', async () => {
  const tree = await renderProfileScreen();

  await act(async () => {
    findPressable(tree, 'I-edit ang profile').props.onPress();
  });

  expect(findTextInputByValue(tree, 'Ana Mercado')).toBeDefined();
  expect(findPressable(tree, 'I-save')).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: FAIL until the updated button labels and edit layout are implemented consistently.

- [ ] **Step 3: Write minimal implementation**

```typescript
<Pressable style={styles.secondaryButton} onPress={handleStartEdit}>
  <Text style={styles.secondaryButtonLabel}>I-edit ang profile</Text>
</Pressable>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/tabs/ProfileScreen.test.tsx`
Expected: PASS with authenticated edit interactions still working on the migrated layout.

- [ ] **Step 5: Commit**

```bash
git add client/src/screens/tabs/ProfileScreen.tsx client/src/screens/tabs/ProfileScreen.test.tsx
git commit -m "test(profile): verify migrated edit interactions"
```
