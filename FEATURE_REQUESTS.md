# Feature Requests

Use this file as a lightweight backlog while implementation is in progress.

## Status Legend

- `NEW`: just captured, not reviewed yet
- `PLANNED`: approved for implementation
- `IN_PROGRESS`: currently being built
- `WONT_DO`: intentionally rejected

## Intake Template

Copy this block for each request:

```md
### FR-XXX - Short title
- Status: `NEW`
- Date: YYYY-MM-DD
- Requested by: Name
- Summary: One sentence describing the desired behavior.
- User value: Why this helps.
- Acceptance criteria:
  - [ ] Criterion 1
  - [ ] Criterion 2
- Notes: Optional details, links, or constraints.
```

## Backlog Policy

- Keep only actionable items in this file: `NEW`, `PLANNED`, `IN_PROGRESS`.
- Remove completed items after implementation is verified.

## Active Backlog

### FR-015 - Cohesive Vim-inspired design system across current app surfaces
- Status: `NEW`
- Date: 2026-02-12
- Requested by: Tim
- Summary: Apply a consistent Vim-inspired visual system to the current app UX: sharp edges, monospaced typography, high-contrast borders/colors, and no shadow-based depth.
- User value: Consistent visual language across all recently added flows without changing behavior.
- Acceptance criteria:
  - [ ] App supports both dark and light Vim-inspired themes.
  - [ ] Theme auto-switches based on system preference by default.
  - [ ] Navbar includes manual theme toggle button.
  - [ ] Manual selection persists across refresh and overrides auto-switch until reset.
  - [ ] UI uses monospaced font stack across app surfaces.
  - [ ] Components use sharp corners (no soft rounded card/pill styling).
  - [ ] No drop shadows remain in components.
  - [ ] Navbar action buttons (`Preferences`, `Import File`, `Export File`, theme toggle) follow bold outlined styling with icon-color pairing.
  - [ ] Settings/Preferences modal, finder columns, preview pane, and welcome overlay share the same tokenized color/border system.
  - [ ] Focus/selection/hover states are clearly visible and keyboard-accessible.
  - [ ] Desktop and mobile remain usable after theme conversion.
- Implementation plan:
  - Files: `public/styles.css`, `public/index.html`, `src/client/app.ts`.
  - Theme mode architecture:
    - Add theme state in controller (`system`/`light`/`dark`) with localStorage persistence.
    - Detect `prefers-color-scheme` for auto mode.
    - Apply theme via root attribute/class (for example `data-theme` on `<body>`).
    - Add navbar toggle button cycling modes or toggling between light/dark with auto-reset control.
  - Introduce theme tokens in `:root`:
    - typography (`--font-mono`)
    - surfaces, text, accent, warning/success, border colors
    - spacing + border-width tokens
    - parallel token sets for light and dark themes
  - Replace existing soft UI styles:
    - remove rounded card/pill treatments
    - remove all box shadows
    - enforce crisp borders and hard-edged components
  - Component pass aligned to current UX:
    - navbar container/actions and 80% large-screen width presentation
    - finder columns/list rows
    - preview pane (small preview layout)
    - Preferences modal (single-line scroll list layout)
    - welcome/splash overlay empty state
    - status and error/success states
  - Interaction states:
    - define strong hover/active/focus-visible outlines with accessible contrast.
  - Keep behavior unchanged; styling-only refactor compatible with FR-008/FR-010/FR-016/FR-017.
- Testing checklist:
  - [ ] System theme changes affect app when in auto mode.
  - [ ] Manual toggle overrides system mode and persists after reload.
  - [ ] Navbar toggle control is keyboard accessible.
  - [ ] No `box-shadow` remains in stylesheet.
  - [ ] Monospace typography applied consistently.
  - [ ] Focus ring visible on all interactive controls.
  - [ ] Color contrast is readable in normal use.
  - [ ] Layout integrity preserved at existing mobile breakpoint and large-screen centered navbar container.

## Clarifications Needed

Resolved on 2026-02-12:

- FR-015 requires both light/dark themes with auto system switching and manual navbar toggle.
