# Onboarding Four-Step Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the four onboarding mockups into the existing React Native onboarding/auth flow while preserving Supabase auth, permission, and tutorial handlers.

**Architecture:** Restyle existing components in place. `AuthChoiceScreen` handles step 1, `AuthLayout` provides step 2 shell for login/signup, `PermissionsScreen` handles step 3, and `OnboardingOverlay` handles step 4 after dashboard entry.

**Tech Stack:** React Native, TypeScript, Expo, Vitest, react-test-renderer

---

### Task 1: Add Four-Step Onboarding Render Tests

**Files:**
- Create: `client/src/screens/onboarding/OnboardingScreens.test.tsx`
- Test: `client/src/screens/onboarding/OnboardingScreens.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
expect(findTextNodes(tree, 'Hakbang 1 ng 4')).not.toHaveLength(0);
expect(findTextNodes(tree, 'Ikonekta ang account mo.')).not.toHaveLength(0);
expect(findTextNodes(tree, 'Kailangan namin ng kaunting pahintulot.')).not.toHaveLength(0);
expect(findTextNodes(tree, 'Handa ka na!')).not.toHaveLength(0);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/screens/onboarding/OnboardingScreens.test.tsx`
Expected: FAIL until the current screens are migrated to the four-step mockup copy.

- [ ] **Step 3: Implement minimal UI copy and structure**

Update existing components to render the mocked step labels and content while keeping existing callbacks.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/screens/onboarding/OnboardingScreens.test.tsx`
Expected: PASS.

### Task 2: Verify Current App Wiring Remains Intact

**Files:**
- Modify: `client/src/screens/onboarding/AuthChoiceScreen.tsx`
- Modify: `client/src/components/AuthLayout.tsx`
- Modify: `client/src/screens/onboarding/PermissionsScreen.tsx`
- Modify: `client/src/screens/onboarding/OnboardingOverlay.tsx`

- [ ] **Step 1: Confirm callbacks remain in place**

Keep existing callback invocations:

```typescript
showLogin();
chooseGuestMode();
signInWithEmail(input);
signUpWithEmail(input);
requestMicrophonePermission();
requestStoragePermission();
completeOnboarding();
onDismiss();
```

- [ ] **Step 2: Run verification**

Run:

```bash
npm run typecheck
npm test -- src/screens/onboarding/OnboardingScreens.test.tsx
```

Expected: all checks pass.
