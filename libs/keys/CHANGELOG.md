# @diffgazer/keys

## 0.3.0

### Minor Changes

- 3e5d1f8: Harden the public packages before release. `dgadd` now validates Tailwind v4 and
  source aliases before writing files, keeps integration-mode migrations
  transactional, and restores package and manifest state after failures.

  The UI library fixes form, focus, keyboard, SSR, and accessibility behavior. It
  also normalizes an empty single Accordion value to `undefined` and removes the
  unused `MenuItemRadio` `value` prop. The keys library fixes focus restoration
  and traps across owner documents and shadow roots, and prevents action-row focus
  repair from stealing focus.

  The `diffgazer` CLI improves startup and shutdown handling, development port
  propagation, terminal input routing, TUI navigation, and bundled license
  notices.

- a631324: Adds `hasModifierKey(event)` to the public entry.

  Returns `true` when any of `altKey`, `ctrlKey`, `metaKey`, or `shiftKey` is
  held — the "this key is unmodified, so the widget owns it" guard that list and
  scroll handlers write inline. It takes anything with the four flags, so React
  synthetic and native keyboard events both pass.

  It is not the right guard for letter hotkeys: printable keys already encode
  Shift in `event.key`, so `?` and `R` must be matched by key, not by rejecting
  `shiftKey`. `useNavigation` uses it internally for the same rule it already
  applied; behavior is unchanged.

- e0094af: UI improvements pass across the published surfaces, with the audit fixes that came with it.

  `@diffgazer/keys` now describes its copy targets as `@hooks/...` alias tokens instead of hardcoded
  `src/` paths, matching the `@ui/...` form `@diffgazer/ui` already used, so a copied file lands under
  the consumer's own configured source root. Its `navigation` item also copies the `hotkey` helper it
  depends on. `@diffgazer/ui` moves the shared `stepper.css` out of the `stepper` and
  `horizontal-stepper` file lists into the `stepper-variants` item both already depend on, so
  installing either surface brings the stylesheet exactly once, and `toast` picks up a `focus-restore`
  dependency on `@diffgazer/keys`. Both libraries ship correctness, accessibility, and focus fixes
  across their components, hooks, and utilities.

  `@diffgazer/add` resolves those alias targets by reading the consumer's Vite and tsconfig alias
  configuration, and reworks `remove` so cascade removal and CSS chunk cleanup follow the dependency
  edges recorded at install time rather than the live registry.

  `diffgazer` restyles the TUI panes, menus, and filters, fixes keyboard navigation and focus escaping
  in the onboarding and provider flows, and corrects the review and context colors.

  `@diffgazer/ui` public API:

  Removals:
  - `HorizontalStepperProps.steps` — the run is now derived from the rendered `HorizontalStepper.Step`
    children, which register themselves in document order. Drop the prop; the steps you render are the
    run.
  - `CommandPaletteItemMetadata` — folded into `CommandPaletteItemRegistration`, which carries the same
    fields directly.

  Changes:
  - `ToggleGroupProps` and `CheckboxGroupProps` are no longer generic. For a value-typed toggle group,
    build one with `createToggleGroup(values)`; `CheckboxGroup` values are `string[]`.
  - `DialogContentProps` is a discriminated union on `modal`: a modal dialog takes `modal?: true` with
    `role`, `closeIcon`, `closeOnBackdropClick`, `initialFocus`, `onCancel`, and `onEscapeKeyDown`, and
    an inline dialog takes `modal: false` and accepts none of them.
  - `DiffViewProps.statusBar` is accepted only with `variant="statusbar"`; on every other variant it is
    now typed `never` instead of being silently ignored.

- 24411b0: Audit pass across the component and keyboard libraries. `@diffgazer/keys` adds the `moveHighlight` list-navigation helper (with `HighlightNavigationItem` / `MoveHighlightResult` types) to its public entry and ships correctness/accessibility fixes across its hooks and utilities, preserving the existing `KeyboardProvider`, hooks, navigation/focus utilities, and types. `@diffgazer/ui` ships correctness, accessibility, and convention fixes across the component, hook, and lib surfaces and refreshes the base theme tokens. The two packages are linked and version together.

  Reconstructed retroactively from the post-0.2.0 history; these changes predate the changeset-based flow.

- 929ad7c: Vim j/k aliases for list navigation, and a default Dialog close control.

  `Menu` and `NavigationList` (through `useListbox`) and `RadioGroup` now accept
  `k` wherever they accept `ArrowUp` and `j` wherever they accept `ArrowDown`.
  Roving focus, `aria-activedescendant`, disabled skipping, and boundary callbacks
  are unchanged; only the accepted key set grew.

  `isListNavigationKey` from `@diffgazer/keys` returns `true` for `"j"` and `"k"`,
  and `getVerticalArrowDirection` maps `k` to `"up"` and `j` to `"down"`.
  Uppercase `J`/`K` are unaffected. If you call `isListNavigationKey` to ask
  whether a key belongs to a list, nothing changes. If you call it as a
  suppression guard — `if (isListNavigationKey(event.key)) event.preventDefault()`
  while a list is inactive, which the Diffgazer history timeline does in three
  places — it now swallows those two characters too, so re-check guards of that
  shape against any text entry they sit near.

  Typeahead reserves j/k rather than consuming them. `useTypeaheadBuffer` takes an
  `extendOnly` option and `useListbox({ typeahead: true })` passes it for `j`/`k`:
  on an empty query buffer they move the highlight, and while a query is in
  progress they extend it instead of navigating. They never start a query. This is
  the rule `Space` already followed.

  Modal `DialogContent` now renders `dialog-close-icon.tsx` by default, last in the
  DOM so the `[x]` stays the final tab stop. Pass `closeIcon={false}` to opt out;
  inline dialogs still compose `Dialog.CloseIcon` explicitly. `dialog.css` drops
  the CSS-only `body:has(dialog[open])` scroll lock, leaving the reference-counted
  `useScrollLock` inside `DialogContent` as the single owner — the two locks
  compensated for the same scrollbar twice and the page jumped on every open — and
  the modal entrance duration is now a literal `150ms` instead of the anchored
  tier's `--ui-content-enter-duration`.

## 0.2.0

### Minor Changes

- 6416350: Remove pre-release keyboard alias props before public handoff:
  `targetRef` -> `containerRef`, `requireFocusWithin` -> `focusWithinOnly`,
  `onBoundaryReached` -> `onNavigationBoundaryReached`, and the old focus-zone
  helpers `ZoneProps`/`inZone`/`forZone`/`zoneProps` -> the current `getZoneProps` API.

### Patch Changes

- 6416350: Stop tracking deterministic generated docs data and CLI source bundles. Root
  verification and docs preparation now regenerate library artifacts before
  validation/build so local development and deploys do not depend on committed
  generated JSON snapshots.
- 6416350: Document publish-gated install flows, local package validation, shadcn namespace
  setup, keyboard integration contracts, release-readiness governance, and runtime
  package surface validation for public handoff.
