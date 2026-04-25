# Onboarding Four-Step Migration Design

**Goal:** Migrate the four Vanilla HTML onboarding mockups in `client/src/stitch_tindai_profile_redesign_mockups` into the existing React Native onboarding/auth flow without changing current auth, permission, or dashboard tutorial wiring.

## Mapping

- Step 1, `pumili_ng_simula`: `client/src/screens/onboarding/AuthChoiceScreen.tsx`
- Step 2, `ikonekta_ang_account_mo`: `client/src/components/AuthLayout.tsx` plus `LoginScreen.tsx` and `SignUpScreen.tsx`
- Step 3, `kaunting_pahintulot`: `client/src/screens/onboarding/PermissionsScreen.tsx`
- Step 4, `handa_ka_na`: `client/src/screens/onboarding/OnboardingOverlay.tsx`

## Existing Wiring To Preserve

- `AuthChoiceScreen` must continue to call `showLogin()` for account mode and `chooseGuestMode()` for guest mode.
- `LoginScreen` must continue to call `signInWithEmail()` and `signInWithGoogle()`.
- `SignUpScreen` must continue to call `signUpWithEmail()` and `signInWithGoogle()`.
- `PermissionsScreen` must continue to call `requestMicrophonePermission()`, `requestStoragePermission()`, and `completeOnboarding()`.
- `OnboardingOverlay` must continue to call `onDismiss()`, which is wired to `markTutorialShown()` from `RootNavigator`.

## UI Direction

Use the Stitch mockups as visual references while adapting to React Native:

- shared white/green setup progress top bar
- four-step progress indicator
- large Tindai brand/voice hero on the first step
- card-based account form shell on auth screens
- permission cards with required/optional badges
- completion/tutorial overlay copy that explains the mic workflow

Avoid duplicating navigation or auth state. The existing app flow remains the source of truth.

## Testing

Add focused render tests for:

- Step 1 copy and account/guest actions
- Step 2 auth layout progress copy and existing login action labels
- Step 3 permission card copy and continue action
- Step 4 completion/tutorial copy and dismiss action

Run targeted tests plus TypeScript typecheck after implementation.
