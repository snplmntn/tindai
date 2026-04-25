# Tindai Codebase Gap Analysis: Unimplemented PRD Requirements

**Date:** April 25, 2026  
**Author:** Manus AI  
**Subject:** Detailed analysis of PRD requirements that are currently unimplemented or only partially implemented in the Tindai codebase.

## Executive Summary

While the Tindai codebase successfully implements the core P0 loop (offline voice input -> local parsing -> immediate inventory update -> asynchronous Gemini verification), several requirements outlined in the Hackathon MVP PRD [1] remain unimplemented or incomplete. 

The most significant gaps involve the absence of a dedicated Utang (Credit) Ledger UI, missing backend demo seeding capabilities, and the deferral of all P1 "Wow-Factor" features such as the receipt scanner. This report details these gaps to guide remaining development efforts before the pitch rehearsal.

## 1. P0 Feature Gaps

The following features are marked as P0 (Demo-Critical) in the PRD but are currently missing or incomplete in the codebase.

### 1.1 Dedicated Utang (Credit) Ledger Display
**PRD Requirement:** The app must show the customer name and amount/item owed. Utang must be stored in a real customer ledger [1].
**Current State:** Partially implemented. 
**Details:** The underlying data model (`customers` and `utang_entries` tables) exists locally and in Supabase [2]. The `DashboardScreen.tsx` successfully parses utang commands and allows assigning a customer name via a fallback modal [3]. However, there is **no UI screen or dedicated component to view the actual utang balances** or the list of customers with their accumulated debts. The `DashboardScreen` only shows inventory items and recent assistant questions [3]. The `InventoryScreen` only shows pending transactions and inventory counts [4]. The user can record a debt, but they cannot see who owes them what.

### 1.2 Backend Demo Seeding Endpoint
**PRD Requirement:** A backend-only helper endpoint (`POST /api/demo/seed-store`) must exist to seed demo inventory and opening stock safely for the signed-in user's store [1].
**Current State:** Unimplemented in the API layer.
**Details:** The Supabase migration (`20260425000100_initial_dynamic_schema.sql`) correctly defines the `public.seed_demo_store` SQL function [5]. However, the Node.js/Express backend does not expose the required `/api/demo/seed-store` endpoint. The `server/src/app.ts` and `routes/index.ts` files only mount `/auth`, `/profile`, `/store`, `/assistant/query`, and `/verify-transactions` [6] [7]. This means the frontend or QA team has no programmatic way to trigger the demo seeding process via the API as specified.

### 1.3 Full "Sync Now" Manual Trigger
**PRD Requirement:** Online sync can be triggered automatically or by a visible "Sync Now" button [1].
**Current State:** Partially implemented.
**Details:** Synchronization is triggered automatically on app load or when the user manually pulls to refresh the dashboard (which calls the `refresh()` function in `LocalDataContext.tsx`) [8]. However, there is no explicit, distinct "Sync Now" button that solely handles pushing pending transactions as implied by the PRD's UX guidelines [1]. The refresh action handles both pulling new state and pushing pending transactions simultaneously.

## 2. P1 Feature Gaps (Deferred Scope)

The PRD outlines several "Wow-Factor" features that should only be built if the core loop is stable [1]. As expected for an MVP, these are currently unimplemented.

### 2.1 Receipt or Item Scanner
**PRD Requirement:** The scanner automates inventory setup by using the camera to detect items or receipts via Gemini Vision [1].
**Current State:** Unimplemented.
**Details:** There is no camera integration, image processing logic, or Gemini Vision API calls present in the client or server codebase. Inventory items must be added manually via the "Magdagdag ng item" modal in `DashboardScreen.tsx` [3].

### 2.2 Offline-to-Online Sync Demo Toggle
**PRD Requirement:** A visible demo mode that makes the offline story obvious to judges (e.g., an explicit "Offline Mode" state toggle) [1].
**Current State:** Partially implemented.
**Details:** The app dynamically detects connectivity issues and displays an offline indicator (`<View style={styles.offlineDot} />`) and a banner (`"Ang data ay local lang. Mag-sign in para mag-sync sa cloud."`) [3]. However, there is no developer/demo toggle to artificially force the app into offline mode for presentation purposes without actually disabling the device's Wi-Fi/Data.

## 3. Minor UX and Analytics Gaps

### 3.1 Analytics Empty States and Rich Insights
**PRD Requirement:** Show items sold today, estimated sales count/revenue, and low-stock list [1].
**Current State:** Partially implemented.
**Details:** The `buildAnalyticsViewModel.ts` file contains comprehensive logic for calculating sales trends, demand deltas, and forecasts [9]. However, the `DashboardScreen.tsx` currently only displays a highly simplified summary: Total Products, Low Stock Count, and Total Inventory Value [3]. The richer insights (top selling, fast moving, sales today) calculated by the view model are not yet wired into the visible UI.

## Conclusion

The Tindai team has successfully delivered the hardest technical challenge: the offline-first voice parsing and synchronization pipeline. To fully satisfy the P0 PRD requirements before the hackathon deadline, development should immediately focus on:
1. Building a UI to display customer Utang balances.
2. Exposing the `/api/demo/seed-store` endpoint in the Express backend.
3. Wiring the already-calculated analytics (Sales Today) into the Dashboard UI.

## References

[1] Tindai Hackathon MVP PRD (`/docs/prd/tindai-hackathon-mvp-prd.md`)
[2] Local Schema Definition (`client/src/features/local-db/localSchema.ts`)
[3] Dashboard Screen UI (`client/src/screens/tabs/DashboardScreen.tsx`)
[4] Inventory Screen UI (`client/src/screens/tabs/InventoryScreen.tsx`)
[5] Supabase Initial Migration (`supabase/migrations/20260425000100_initial_dynamic_schema.sql`)
[6] Server App Configuration (`server/src/app.ts`)
[7] Server Routes Index (`server/src/routes/index.ts`)
[8] Local Data Context (`client/src/features/local-data/LocalDataContext.tsx`)
[9] Analytics View Model (`client/src/features/analytics/buildAnalyticsViewModel.ts`)
