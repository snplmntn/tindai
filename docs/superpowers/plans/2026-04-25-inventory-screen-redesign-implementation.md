# Inventory Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Inventory tab to match the provided concept while preserving Tindai branding and existing local-first behavior.

**Architecture:** Replace the current pending-sync-only Inventory UI with a branded searchable item-list screen that uses existing `useLocalData` capabilities. Keep this pass screen-focused: real search/filter/add/quick-adjust interactions, no backend/schema changes, no new inventory CRUD API.

**Tech Stack:** React Native, TypeScript, Expo, local SQLite via existing `LocalDataContext`, Vitest/react-test-renderer

---

## Summary

- Implement a concept-similar inventory layout (header, search, filter, item cards, floating add button) in Trusted Growth brand tokens.
- Keep behavior demo-safe by using existing mutations only: `applyManualAdjustment` and `createLocalInventoryItem`.
- Use Taglish user copy and avoid internal engineering terms in UI text.

## Interfaces / Contract Impact

- No Supabase migration changes.
- No backend API changes.
- No `LocalDataContext` contract changes required for this pass.
- Internal screen state additions only (search query, sort mode, low-stock toggle, modal visibility, selected item).

## Task 1: Rebuild Inventory Screen Shell To Match Branded Concept

**Files:**
- Modify: `client/src/screens/tabs/InventoryScreen.tsx`

- [ ] Replace `ClientTabLayout`-based structure with a dedicated Inventory screen layout.
- [ ] Add branded top row (menu icon placeholder, `Inventory` title, avatar badge) consistent with existing analytics shell styling.
- [ ] Add search field and filter button row.
- [ ] Add item list card layout:
  - Branded initials avatar (no image schema changes).
  - Item name + unit/category line.
  - Stock line (`in stock`) and right-aligned price.
  - Quick adjust actions (`-` and `+`) wired to `applyManualAdjustment`.
- [ ] Add floating `+` button to open in-screen add-item modal.
- [ ] Keep a compact pending-sync status panel when authenticated and pending records exist.

## Task 2: Implement Search, Filter, Sort, And Empty States

**Files:**
- Modify: `client/src/screens/tabs/InventoryScreen.tsx`

- [ ] Implement search filtering against `name` and `aliases` (case-insensitive).
- [ ] Implement filter sheet/modal with:
  - Sort options: `A-Z`, `Stock high to low`, `Stock low to high`
  - `Low stock only` toggle
- [ ] Apply filter/sort before render in a deterministic order.
- [ ] Add empty states:
  - No items in inventory yet
  - No results for current search/filter criteria

## Task 3: Add In-Screen Add Item Flow

**Files:**
- Modify: `client/src/screens/tabs/InventoryScreen.tsx`

- [ ] Add add-item modal UI opened from floating `+`.
- [ ] Reuse existing add-item validation rules:
  - Required name
  - Non-negative quantity/cost/price
- [ ] Submit through existing `createLocalInventoryItem` only.
- [ ] Keep user-facing success/error copy clear and non-technical.

## Task 4: Add Read-Only Item Detail Surface

**Files:**
- Modify: `client/src/screens/tabs/InventoryScreen.tsx`

- [ ] Make item card tap open a read-only detail modal/sheet.
- [ ] Show available current fields only: `name`, `aliases`, `stock`, `price`, `cost`, and an updated-at label.
- [ ] Do not add edit/archive behavior in this pass.

## Task 5: Tests

**Files:**
- Create: `client/src/screens/tabs/InventoryScreen.test.tsx`

- [ ] Add render test for inventory list from mocked local data.
- [ ] Add search behavior test (`name` + `aliases` match).
- [ ] Add low-stock toggle and sort behavior tests.
- [ ] Add quick-adjust action test verifying `applyManualAdjustment(itemId, direction)` calls.
- [ ] Add add-item modal submit test verifying `createLocalInventoryItem` call payload.
- [ ] Add empty-state tests for empty inventory and empty filtered results.

## Verification

- [ ] Run targeted tests:
  - `cd client && npm test -- src/screens/tabs/InventoryScreen.test.tsx`
- [ ] Run broader client checks (if time):
  - `cd client && npm run typecheck`
  - `cd client && npm test`
- [ ] Manual Android smoke check:
  - Search + filter interactions
  - Quick +/- stock adjustment
  - Add-item modal
  - Pending-sync card visibility
  - Floating action button does not overlap unusably on small screens

## Assumptions Locked

- Scope is screen-only redesign (not full CRUD).
- Layout approach is hybrid: concept-inspired item list within Tindai shell language.
- Copy tone is Taglish.
- Item media uses branded initials avatar for now.
- Filter includes sort options plus low-stock toggle.
- Floating `+` opens add-item modal inside Inventory screen.
- Concept edit/delete affordance is intentionally deferred in this pass.
