  # Tindai Onboarding Flow - Implementation Plan

  ## Overview

  This document outlines the complete onboarding experience for Tindai, designed to balance speed, education, and functionality. The flow prioritizes getting users to the main inventory dashboard quickly while ensuring critical permissions are granted and users understand the core voice-first interaction model.

  **Target User:** Aling Nena and similar sari-sari store owners on low-end Android devices with unreliable internet.

  **Design Principle:** Balanced mix of speed, education, and setup with speed as the primary constraint.

  ---

  ## 1. Onboarding Sequence

  ```
  Auth Choice Screen
      ↓
  [Guest Path] OR [Sign In/Sign Up Path]
      ↓
  Permissions Screen (Microphone + Storage)
      ↓
  Dashboard + First-Time Tutorial Overlay
      ↓
  Optional: Add Items (can be done anytime)
  ```

  ---

  ## 2. Screen-by-Screen Breakdown

  ### 2.1 Auth Choice Screen

  **Purpose:** Let users choose between guest mode (local-only) or creating/signing into an account (cloud-synced).

  **UI Elements:**
  - App logo and title: "Tindai"
  - Subtitle: "Voice-first inventory for your sari-sari store"
  - Two primary buttons:
    - **"Continue as Guest"** (secondary style, local-only)
    - **"Sign In / Sign Up"** (primary style, bold)
  - Small disclaimer text: "Guest data will migrate if you sign up later"

  **Behavior:**
  - Guest path: Skip to Permissions Screen
  - Sign In/Sign Up path: Open Supabase Auth (email/password or social login)
  - Requires internet for Sign In/Sign Up (show offline message if no connection)

  **Copy (Tagalog/Taglish):**
  - "Simulan bilang Guest" (Continue as Guest)
  - "Mag-sign In o Mag-sign Up" (Sign In / Sign Up)
  - "Ang guest data ay lilipat kung mag-sign up ka mamaya" (Guest data will migrate if you sign up later)

  ---

  ### 2.2 Sign In / Sign Up (Conditional)

  **Purpose:** Authenticate user with Supabase Auth if they chose the account path.

  **Requirements:**
  - Internet connection required
  - Supabase Auth UI (email/password or social providers)
  - Session caching after successful auth
  - Store auto-creation for new users

  **Behavior:**
  - New user: Create account → Auto-create default store in Supabase
  - Returning user: Sign in → Load existing store
  - After auth: Proceed to Permissions Screen

  **Note:** This uses existing Supabase Auth flow from the PRD. No changes needed here.

  ---

  ### 2.3 Permissions Screen

  **Purpose:** Request critical permissions (microphone is mandatory, storage optional).

  **Permissions to Request:**
  1. **Microphone** (MANDATORY) - Required for voice input
  2. **Storage** (OPTIONAL) - For local SQLite database (often automatic on Android)

  **UI Elements:**
  - Title: "Tindai needs your permission"
  - Description: Explain why each permission is needed in plain language
  - Native OS permission dialogs (iOS/Android default popups)
  - "Allow" and "Deny" buttons (OS-controlled)

  **Behavior:**
  - Trigger native OS permission dialogs sequentially
  - Microphone permission is mandatory; cannot proceed without it
  - Storage permission is optional; proceed even if denied
  - If user denies microphone: Show dismissible banner on dashboard, re-prompt when mic button is tapped

  **Copy (Tagalog/Taglish):**
  - "Kailangan ng Tindai ang access sa iyong microphone upang makinig sa iyong mga commands." (Tindai needs access to your microphone to listen to your commands.)
  - "Kailangan ng Tindai ng storage access para sa iyong inventory data." (Tindai needs storage access for your inventory data.)

  ---

  ### 2.4 Dashboard + First-Time Tutorial Overlay

  **Purpose:** Land user on the main inventory dashboard and guide them through the primary action (voice input).

  **UI Elements:**
  - Store name (from account or "My Store" for guest)
  - Large microphone button (primary action)
  - Inventory list (empty or pre-populated if items were added)
  - Transaction status area
  - Low-stock alert area
  - Daily sales summary area
  - Manual +/- correction controls per item

  **First-Time Tutorial Overlay:**
  - Semi-transparent overlay highlighting the microphone button
  - Arrow pointing to mic button
  - Text: "Tap here to speak an inventory command. Example: 'Nakabenta ako ng dalawang Coke.'" (Tap here to speak an inventory command. Example: "I sold two Cokes.")
  - "Skip" button to dismiss
  - One-time only (stored in local preferences)

  **Guest Mode Banner:**
  - If user is in guest mode: Show persistent, dismissible banner at top
  - Text: "Data is local only. Sign in to sync to cloud." (Ang data ay local lang. Mag-sign in para mag-sync sa cloud.)
  - "Sign In" button to convert to account
  - Can be dismissed but reappears on app restart

  **Microphone Permission Denied Banner:**
  - If microphone permission was denied: Show dismissible banner
  - Text: "Microphone access is required for voice input. Tap the mic button to enable it in Settings." (Kailangan ng microphone access para sa voice input. I-tap ang mic button para i-enable sa Settings.)
  - Mic button is disabled (grayed out) until permission is granted
  - When user taps disabled mic button: Re-prompt for permission

  **Behavior:**
  - Dashboard loads with empty inventory (or pre-populated if items were added)
  - Tutorial overlay appears once on first load
  - User can skip overlay and start using app immediately
  - User can add items anytime via "Add Item" button or voice command

  ---

  ### 2.5 Add Items (Optional, Can Be Done Anytime)

  **Purpose:** Allow users to manually add inventory items with name, quantity, cost price, and selling price.

  **UI Elements:**
  - "Add Item" button on dashboard
  - Modal or new screen with item input form
  - Multiple input fields per item:
    1. Item name (text input, required)
    2. Initial quantity (number input, required, default 0)
    3. Cost price (number input, required)
    4. Selling price (number input, required)
  - "+ Add Another Item" button to add more items
  - "Save Items" button to confirm

  **Form Layout:**
  - Vertical stack (one field per line) for optimal small-screen UX
  - Clear labels above each field
  - Placeholder text for guidance (e.g., "e.g., Coke Mismo", "e.g., 20", "e.g., 50")

  **Validation:**
  - Item name: Required, non-empty
  - Quantity: Required, non-negative integer
  - Cost price: Required, non-negative number
  - Selling price: Required, non-negative number, should be >= cost price (warn if not)

  **Behavior:**
  - Users can add as many items as they want
  - Require at least 1 item before allowing dashboard use (or allow empty and show "Add items to get started" prompt)
  - Items are saved locally immediately
  - On next sync (if account user), items are synced to Supabase

  **Copy (Tagalog/Taglish):**
  - "Pangalan ng item" (Item name)
  - "Quantity" (Quantity)
  - "Cost price" (Cost price)
  - "Selling price" (Selling price)
  - "Magdagdag ng isa pang item" (Add another item)
  - "I-save ang mga item" (Save items)

  ---

  ## 3. Permission Handling

  ### 3.1 Microphone Permission

  **Mandatory:** User cannot proceed without granting microphone permission.

  **Denied Flow:**
  1. User denies microphone permission in OS dialog
  2. Show dismissible banner on dashboard: "Microphone access required for voice input. Tap mic button to enable."
  3. Mic button is disabled (grayed out)
  4. When user taps disabled mic button: Re-prompt for permission via OS dialog
  5. If user grants permission: Enable mic button, dismiss banner
  6. If user denies again: Show banner again, mic button remains disabled

  **Granted Flow:**
  1. User grants microphone permission
  2. Proceed to dashboard
  3. Mic button is enabled and ready to use

  ### 3.2 Storage Permission

  **Optional:** User can proceed even if storage permission is denied.

  **Behavior:**
  - Request storage permission in native dialog
  - If denied: Continue to dashboard (SQLite may still work depending on Android version)
  - If granted: Proceed normally

  ---

  ## 4. Guest vs. Account Flows

  ### 4.1 Guest Mode

  **Characteristics:**
  - No authentication required
  - Data stored locally only (SQLite)
  - No cloud sync
  - Can add items, log transactions, view inventory
  - Can convert to account later (data migrates)

  **User Experience:**
  - Faster onboarding (skip auth)
  - Works completely offline
  - Persistent banner: "Data is local only. Sign in to sync to cloud."
  - "Sign In" button in banner to convert to account

  **Data Migration:**
  - When guest converts to account:
    1. User signs up/signs in
    2. New store is created in Supabase
    3. Local guest data (items, transactions) is migrated to the new store
    4. Sync queue is populated with pending transactions
    5. User is notified: "Your guest data has been migrated. Syncing now..."

  ### 4.2 Account Mode

  **Characteristics:**
  - Requires Supabase Auth (email/password or social)
  - Data synced to cloud
  - Can access from multiple devices (future feature, not MVP)
  - Store is scoped to authenticated user

  **User Experience:**
  - Slightly longer onboarding (auth required)
  - Works offline, syncs when online
  - No "local-only" banner
  - Full cloud backup and sync capabilities

  ---

  ## 5. State Management & Local Storage

  ### 5.1 Onboarding State

  Track onboarding completion in local preferences:

  ```json
  {
    "onboarding_completed": true,
    "auth_mode": "guest" | "account",
    "permissions": {
      "microphone": "granted" | "denied" | "pending",
      "storage": "granted" | "denied" | "pending"
    },
    "tutorial_shown": true,
    "guest_converted": false
  }
  ```

  ### 5.2 First-Time Flags

  - `tutorial_shown`: Show tutorial overlay only once
  - `microphone_permission_denied_banner_shown`: Track if permission banner was shown
  - `guest_mode_banner_dismissed`: Track if guest mode banner was dismissed (reset on app restart)

  ---

  ## 6. Error Handling

  ### 6.1 Network Errors During Auth

  **Scenario:** User tries to sign in/sign up but has no internet.

  **Behavior:**
  - Show error message: "No internet connection. Please check your connection and try again." (Walang internet connection. Suriin ang iyong koneksyon at subukan ulit.)
  - Offer retry button
  - Suggest guest mode as alternative

  ### 6.2 Supabase Auth Failures

  **Scenario:** Sign in/sign up fails (invalid credentials, server error, etc.).

  **Behavior:**
  - Show error message from Supabase
  - Offer retry button
  - Suggest guest mode as alternative

  ### 6.3 Permission Prompt Failures

  **Scenario:** OS permission dialog fails or crashes.

  **Behavior:**
  - Log error
  - Show user-friendly message: "Could not request permission. Please try again." (Hindi makuha ang permission. Subukan ulit.)
  - Offer retry button

  ---

  ## 7. Accessibility & Localization

  ### 7.1 Language

  - Primary: English (UI labels, technical terms)
  - User-facing copy: Tagalog/Taglish (as specified in PRD)
  - Support for future language packs (Bisaya, etc.)

  ### 7.2 Accessibility

  - Large touch targets for buttons (minimum 48x48 dp)
  - High contrast text for readability on low-end screens
  - Screen reader support (TalkBack on Android)
  - Clear focus states for keyboard navigation

  ### 7.3 Small Screen Optimization

  - All screens tested on 4.5-5" Android screens
  - Vertical scrolling preferred over horizontal
  - Large microphone button (minimum 60x60 dp, ideally larger)
  - Minimal modal dialogs (use full-screen forms when possible)

  ---

  ## 8. Implementation Checklist

  ### Phase 1: Core Onboarding Flow
  - [ ] Auth Choice Screen (Guest vs. Sign In/Sign Up)
  - [ ] Supabase Auth integration (sign in/sign up)
  - [ ] Permissions Screen (microphone + storage)
  - [ ] Dashboard landing with first-time tutorial overlay
  - [ ] Guest mode banner
  - [ ] Microphone permission denied handling

  ### Phase 2: Item Management
  - [ ] Add Items modal/screen
  - [ ] Item input form (name, quantity, cost, selling price)
  - [ ] Form validation
  - [ ] Save items to local storage
  - [ ] Display items on dashboard

  ### Phase 3: Guest-to-Account Conversion
  - [ ] Sign In button in guest mode banner
  - [ ] Data migration logic (guest → account)
  - [ ] Sync queue population after migration
  - [ ] User notification after migration

  ### Phase 4: Polish & Testing
  - [ ] Copy review (Tagalog/Taglish accuracy)
  - [ ] Small screen testing (4.5-5" Android)
  - [ ] Permission handling edge cases
  - [ ] Offline/online transitions
  - [ ] Error message clarity

  ---

  ## 9. Success Criteria

  The onboarding is successful if:

  - User can open the app and choose Guest or Sign In within 10 seconds
  - Microphone permission is requested and granted (or denied with clear fallback)
  - User lands on dashboard with tutorial overlay within 30 seconds of launch
  - User can add items via the Add Item form without confusion
  - Guest users see clear indication that data is local-only
  - Guest users can convert to account and migrate data seamlessly
  - All copy is in plain Tagalog/Taglish (no technical jargon)
  - App works on low-end Android devices without crashes

  ---

  ## 10. Future Enhancements (P1+)

  - Social login (Google, Facebook) for faster sign-up
  - Biometric login (fingerprint) for returning users
  - Pre-populated item templates (common sari-sari items)
  - Multi-language support (Bisaya, Ilocano, etc.)
  - Onboarding video/demo (if bandwidth allows)
  - Store customization (logo, theme, etc.)
  - Team/multi-user support (not MVP)

  ---

  ## Appendix: Copy Reference

  ### English

  | Screen | Element | Copy |
  |--------|---------|------|
  | Auth Choice | Subtitle | Voice-first inventory for your sari-sari store |
  | Auth Choice | Guest Button | Continue as Guest |
  | Auth Choice | Account Button | Sign In / Sign Up |
  | Auth Choice | Disclaimer | Guest data will migrate if you sign up later |
  | Permissions | Microphone | Tindai needs access to your microphone to listen to your commands |
  | Permissions | Storage | Tindai needs storage access for your inventory data |
  | Dashboard | Guest Banner | Data is local only. Sign in to sync to cloud. |
  | Dashboard | Permission Denied | Microphone access required for voice input. Tap mic button to enable. |
  | Dashboard | Tutorial | Tap here to speak an inventory command. Example: "I sold two Cokes." |
  | Add Items | Item Name | Item name |
  | Add Items | Quantity | Quantity |
  | Add Items | Cost Price | Cost price |
  | Add Items | Selling Price | Selling price |

  ### Tagalog/Taglish

  | Screen | Element | Copy |
  |--------|---------|------|
  | Auth Choice | Subtitle | Voice-first na inventory para sa iyong sari-sari store |
  | Auth Choice | Guest Button | Simulan bilang Guest |
  | Auth Choice | Account Button | Mag-sign In o Mag-sign Up |
  | Auth Choice | Disclaimer | Ang guest data ay lilipat kung mag-sign up ka mamaya |
  | Permissions | Microphone | Kailangan ng Tindai ang access sa iyong microphone upang makinig sa iyong mga commands |
  | Permissions | Storage | Kailangan ng Tindai ng storage access para sa iyong inventory data |
  | Dashboard | Guest Banner | Ang data ay local lang. Mag-sign in para mag-sync sa cloud. |
  | Dashboard | Permission Denied | Kailangan ng microphone access para sa voice input. I-tap ang mic button para i-enable. |
  | Dashboard | Tutorial | I-tap dito para magsalita ng inventory command. Halimbawa: "Nakabenta ako ng dalawang Coke." |
  | Add Items | Item Name | Pangalan ng item |
  | Add Items | Quantity | Quantity |
  | Add Items | Cost Price | Cost price |
  | Add Items | Selling Price | Selling price |

  ---

  **Document Version:** 1.0  
  **Last Updated:** April 25, 2026  
  **Status:** Ready for Implementation
