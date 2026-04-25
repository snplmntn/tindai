# Dashboard Screen Migration Design

**Goal:** Migrate the HTML/CSS dashboard mockup in `client/src/dashboard-ui.txt` into the existing React Native dashboard screen while preserving the current voice, parser, fallback, assistant, and local inventory flows.

## Context

`client/src/screens/tabs/DashboardScreen.tsx` is the main P0 workflow screen. It already owns:

- microphone and speech-recognition handling
- typed command submission
- parser confirmation and fallback flows
- assistant question handling and TTS playback
- add-item modal and manual stock adjustments
- refresh and sync status display

The imported HTML mockup is a visual reference only. It includes web-only navigation, fixed desktop layouts, and placeholder values that do not map directly to the live React Native state.

## Constraints

- Keep `DashboardScreen.tsx` as the screen entry point.
- Do not break the microphone flow or any backend-facing mobile behavior.
- Keep existing handlers, local data calls, and modal flows intact.
- Do not recreate duplicate tab navigation inside the screen.
- Fix layout overlap on small Android screens while applying the new visual language.
- Keep user-facing copy plain and store-owner friendly.

## Recommended Approach

Apply the HTML mockup selectively to the existing dashboard structure instead of replacing the screen wholesale. The top app bar, banners, mic hero, command bar, summary cards, and inventory/activity sections should take on the new visual design, while the current logic and interaction model remain unchanged.

## UI Design

### Top app bar

- Replace the current header with a brand-forward bar based on the mockup.
- Show `Tindai` branding, account status pill, and refresh action.
- Keep the current refresh handler and sync indicator.

### Warning banners

- Restyle the guest and mic warning banners to match the imported visual design.
- Preserve dismiss behavior and sign-in action.

### Voice command hero

- Convert the current mic section into a centered hero block inspired by the mockup.
- Keep the large microphone action as the primary CTA.
- Keep the add-item action inside the hero area.

### Command and feedback area

- Restyle the typed command row as a rounded command bar.
- Keep send and fallback/edit actions wired to the existing handlers.
- Restyle status and assistant answer cards without changing behavior.

### Summary section

- Introduce a `Buod Ngayon` heading and style the summary cards after the mockup.
- Avoid overlap on small screens by using a responsive React Native layout instead of forcing a fixed 3-column row.

### Inventory and activity sections

- Restyle the inventory list as `Kamakailang Tala`.
- Preserve manual plus/minus buttons and stock text.
- Keep assistant interactions in a separate card below, styled consistently.

## Testing Design

Create a dedicated dashboard screen test that verifies the migrated presentation while preserving current flows:

- top app bar renders `Tindai`
- the hero renders the voice CTA and add-item action
- signed-out mode still shows the local-data banner and sign-in action
- summary section renders `Buod Ngayon`
- inventory list remains visible with manual adjustment controls

## Risks

- The dashboard screen already has many states and conditional cards; a literal HTML port would make the screen brittle and likely break interaction paths.
- The imported HTML uses fixed grid assumptions that can overlap on narrow devices. React Native needs flexible widths and wrapping.

## Out of Scope

- Backend API changes
- Parser behavior changes
- Speech recognition logic changes
- Tab navigation changes
