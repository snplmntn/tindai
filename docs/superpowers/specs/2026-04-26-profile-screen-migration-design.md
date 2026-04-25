# Profile Screen Migration Design

**Goal:** Migrate the HTML/CSS guest profile mockup in `client/src/new-prof-ui.txt` into the existing React Native profile screen without changing the current profile data flow.

## Context

The mobile app already renders profile state from `client/src/screens/tabs/ProfileScreen.tsx` and drives account actions through:

- `useAuth()` for authenticated vs signed-out behavior
- `useLocalData()` for store name refresh
- `fetchMyProfile`, `updateMyProfile`, `updateMyStoreName`, and `clearMyProfileAvatar` for profile mutations

The inserted HTML mockup is a visual target only. It includes a guest-first layout, Tailwind classes, web-only fonts, and a duplicate bottom navigation that the React Native app already owns elsewhere.

## Constraints

- Keep the screen in `client/src/screens/tabs/ProfileScreen.tsx`.
- Preserve existing profile fetching, editing, save, remove-avatar, login, signup, and sign-out behavior.
- Do not recreate a second bottom tab bar inside the screen.
- Keep user-facing copy plain. Avoid internal engineering terms.
- Follow existing color tokens from `client/src/navigation/colors.ts`.

## Recommended Approach

Rebuild the mockup as a React Native layout inside the existing screen component, preserving the current logic and screen boundaries. This keeps risk low and avoids introducing a parallel profile implementation.

## UI Design

### Header hero

- Replace the current top card with a tall green hero section.
- Show the page title, circular avatar, display name, display email, and store badge.
- Preserve avatar image support and initials fallback.

### Status card

- Add a compact informational card under the hero, based on the mockup.
- Keep the message aligned with the app’s behavior:
  - signed out: explain that signing in keeps the store backed up online
  - signed in: explain that the phone stays ready with the owner’s store details

### Details card

- Style the profile details as stacked rows derived from the mockup.
- In read mode, show labeled rows for name, email, and store.
- In edit mode, keep the existing editable fields and save/cancel actions, but restyle them to match the updated screen.

### Actions

- Signed out: show the primary and secondary auth buttons from the mockup order.
- Signed in, read mode: show actions for edit profile and sign out.
- Signed in, edit mode: show remove avatar, cancel, and save in the updated visual language.

## Testing Design

Update `client/src/screens/tabs/ProfileScreen.test.tsx` before implementation so the new layout is exercised by failing tests:

- authenticated read mode renders the new title and info card copy
- signed-out mode renders the guest CTA buttons in the new order/text
- edit mode still pre-fills fields and exposes save
- save path still updates profile/store and exits edit mode
- remove avatar still falls back to initials

## Risks

- The HTML mockup uses web-only gradient, blur, and icon patterns. In React Native, these need simplified equivalents unless an existing dependency already supports them.
- The mockup is guest-first, while the live screen also needs authenticated edit and sign-out states. The RN version must reconcile both without losing behavior.

## Out of Scope

- Navigation changes
- New profile backend fields
- New dependencies for icons or gradients unless the current app already includes them
