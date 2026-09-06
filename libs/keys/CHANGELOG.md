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

- 24411b0: Audit pass across the component and keyboard libraries. `@diffgazer/keys` adds the `moveHighlight` list-navigation helper (with `HighlightNavigationItem` / `MoveHighlightResult` types) to its public entry and ships correctness/accessibility fixes across its hooks and utilities. Every existing export stays, but `keys()`, `canonicalizeHotkey`, the `useKey` overloads, `KeyboardContextValue.register`, and `KeyHandler` change signature, as recorded in the `24411b0` entries below. `@diffgazer/ui` ships correctness, accessibility, and convention fixes across the component, hook, and lib surfaces and refreshes the base theme tokens. The two packages are linked and version together.

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

- 24411b0: Hotkey strings are checked at compile time. `ValidateHotkey<S>` and
  `HotkeyModifier` (`"ctrl" | "meta" | "shift" | "alt" | "mod"`) are exported,
  and every hotkey-taking signature validates string literals through them:
  `keys<const Hotkeys extends readonly string[]>(hotkeys, handler)`,
  `canonicalizeHotkey<S extends string>(hotkey: ValidateHotkey<S>)`, the single
  and array `useKey` overloads, and `KeyboardContextValue.register`. A literal
  whose `+`-delimited modifier segment is outside that vocabulary (matched
  case-insensitively) no longer type-checks; the final key segment is
  unconstrained, and a non-literal `string` passes through so dynamically built
  hotkeys keep compiling. Migration: spell modifiers from the vocabulary
  (`"Cmd+K"` -> `"mod+k"`) and keep computed hotkeys typed as `string`. `keys()`
  now takes and returns `KeyHandler` (`(event) => unknown`) in place of
  `(event) => void`; every handler that compiled before still does.

- 24411b0: `KeyHandler` is declared as `(event: KeyboardEvent) => unknown`. The
  former `| Decline` was already absorbed by `unknown`, so nothing that compiled
  before stops compiling, and returning `DECLINE` still declines the event to
  the next handler. `Decline` and `DECLINE` stay exported; no migration.

- 24411b0: New `@diffgazer/keys/testing/navigation-behavior` entry exporting
  `testNavigationBehavior`, `NavigationCase`, and `TestNavigationBehaviorOptions`.
  Called inside a `describe`, it defines one Vitest case per keyboard input and
  drives it through `@testing-library/user-event`.

- 24411b0: Requires Node `>=22.0.0` (was `>=18.0.0`).

- 5bb563a: `@testing-library/react`, `@testing-library/user-event`, and `vitest`
  are optional peer dependencies for the testing entry; runtime consumers still
  need only `react`. `useActionRowNavigation` accepts `scope`
  (`UseKeyOptions["scope"]`) to register its shortcuts under an explicit
  keyboard scope instead of the implicit provider order.

- 3afe5a9: `useFocusZone` accepts `tabCycleScope` (`"containers"` cycles only
  while focus is inside a registered zone container and declines elsewhere so
  native Tab proceeds; `"document"` cycles from anywhere except editable
  targets) and `tabCycleBoundary`, the element outside which document-scope
  cycling lets native Tab proceed.

- 3e5d1f8: Adds `composedContains(container, target)`,
  `composedClosest(element, selector)`, and `isReachable(element)` to the public
  entry: containment and ancestor lookup that cross shadow boundaries, and the
  hidden/inert/`aria-hidden`/closed-`<details>` reachability check that
  `isFocusable` and navigation item discovery share.

- 7e6c4c8: Adds `isInsideDisabledFieldset(element)` to the public entry: `true`
  inside a `fieldset[disabled]`, except for descendants of its first `<legend>`.

- e16af73: `useActionRowNavigation` and `UseActionRowNavigationOptions` are no
  longer generic over an actions tuple. `actionCount`, `defaultIndex`, and the
  index passed to `onAction` and `onNavigate` are `number`, and
  `disabledActions` is `readonly boolean[]`. Migration: drop the type argument
  (`useActionRowNavigation<typeof actions>(...)` -> `useActionRowNavigation(...)`)
  and widen any callback parameter you had narrowed to a tuple index union.

- e0094af: `@diffgazer/keys` public API: exports the `ZoneTransition<T>` type
  behind `UseFocusZoneOptions.transitions`; adds `itemSelector` to
  `NavigationItemQuery` and `UseNavigationOptions` to narrow a role query to the
  container's own items; adds `allowInInput` to `UseScopedNavigationOptions`;
  and the `useKey(handlers)` map overload validates each key of a literal object
  through `ValidateHotkey` (a `Record<string, KeyHandler>` passes through
  unchanged). Drops the top-level `main` and `types` fields so the package
  resolves through `exports` only. Migration: TypeScript consumers on
  `moduleResolution: "node"` (node10) must move to `bundler`, `node16`, or
  `nodenext`.

- beb29fa: `focusNavigationItem` no longer accepts `fallback: "none"`; it was
  never distinct from omitting `fallback`. Migration: drop the option.

- 54d8f2a: `useActionRowNavigation` accepts `actionIds`, stable per-index
  control identities, so a rebuild that replaces the control at the focused
  index is repaired onto the new element instead of dropping focus on `body`.
  It returns `isRegisteredActionFocused()`: whether DOM focus rests on the
  registered action at `focusedIndex`. The zone can stay `"actions"` after
  Shift+Tab or a click away, so gate row-owned shortcuts on it rather than on
  `inActions`.

### Patch Changes

- 39c9d06: The npm tarball no longer packs `registry/`, `public/r/`, or
  `internal-docs-manifest.json`; it ships `dist` plus the readme, license, and
  policy files.
- 24411b0: Ships `CHANGELOG.md` in the tarball and stops packing `dist/**/*.map`.

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
