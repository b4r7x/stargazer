# @diffgazer/ui

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

- a631324: Typeahead opt-out, a shared focus-outline contract, and a Tab that stops fighting the trigger.

  `Menu` and `NavigationList` take a `typeahead` prop (default `true`). Set
  `typeahead={false}` on a list whose screen advertises printable keys as
  shortcuts — the list stops buffering characters entirely and every key reaches
  your hotkey layer.

  Typeahead now only claims a keystroke once the query earns it. Previously
  `useListbox` called `preventDefault()` on every printable key while items were
  mounted, so a window-level hotkey layer that skips `defaultPrevented` events
  (as `KeyboardProvider` from `@diffgazer/keys` does) never saw `/`, `?`, `q`, or
  a digit while a list had focus. A key is claimed when its query matched an item,
  and while a matched query is being narrowed — including the keystroke that
  narrows it to nothing. A first press that matches nothing falls through.
  Matching a real item still claims the key, so a list containing "Qwen" still
  takes `q` while it is focused; that is what `typeahead={false}` is for.

  `Menu` now calls `preventDefault()` on Tab in addition to `onClose()`. A menu is
  usually portaled, so "the next tabbable after the menu" is a DOM accident, and
  letting native Tab run against the closing tree raced whatever restores focus to
  the trigger. Tab now closes the menu and leaves focus where your close handler
  puts it — for a popover-hosted menu, the trigger, matching Escape. Users who
  want the element after the trigger press Tab twice, the standard idiom.

  `focus-outline` and `marker-rail` become public: `@diffgazer/ui/lib/focus-outline`
  exports `FOCUS_OUTLINE`, `FOCUS_OUTLINE_INSET`, and `HIGHLIGHT_OUTLINE`, and
  `@diffgazer/ui/lib/marker-rail` exports `MARKER_RAIL_BASE`,
  `MARKER_RAIL_SELECTED`, and `MARKER_RAIL_ON_INVERTED`. Both were already
  installed through the copy path as ride-along items; the package exports let app
  code compose the same two marks instead of restating the class strings. Focus
  outlines move from `outline-offset-2` to `outline-offset-0` across the library
  so the mark hugs the control edge, and `ScrollArea` draws it inset
  (`outline-offset-[-2px]`) because a scroll container clips anything outside its
  padding box. Fields are out of scope and keep the inset field grammar
  (`focus:border-ring` plus `focus:ring-1`).

  `CheckboxGroup` accepts `k` wherever it accepts `ArrowUp` and `j` wherever it
  accepts `ArrowDown`, joining `Menu`, `NavigationList`, and `RadioGroup`.

- 21f009e: ScrollArea gains an `overlay` prop (vertical orientation only — other orientations keep their native bar): the native scrollbar is hidden under the theme's hover-capable guard and a draggable floating thumb renders above the content, so list rows can run border-to-border instead of stopping at a reserved track. The thumb follows the same `--scrollbar-thumb` / `--scrollbar-thumb-active` tokens as the thin scrollbar, hides when content fits, and touch devices keep their native indicator. `scrollAreaVariants` gains a `scrollbar` dimension (`thin` default, `overlay`) carrying the suppression and the gutter reservation.
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

### Patch Changes

- 21f009e: The marker rail reserves its lane with a side-scoped `border-l-transparent` (previously the all-sides `border-transparent`, which tailwind-merge let clobber any per-side border color merged before it). NavigationList item separators now actually render at their variant color (`border-b-border/50`) on default rows, and a consumer-passed bottom-border color no longer tints the rail into a second vertical line beside a panel border. The item variant's separator color is also side-scoped (`border-b-border/50`).
- 20b6d17: Shipped registry source no longer carries comments that narrate how the code changed.
  Five copy-mode payloads — `switch`, `field`, `command-palette`, `selectable-glyph` and
  `selectable-variants` — pick up comments that state what the code guarantees instead of
  what it used to do. Rendered output, props and class names are unchanged.
- 2e7995d: Two `ScrollArea` overlay-scrollbar fixes. A scroll area that turns its overlay thumb
  back on — because `overlay` or `orientation` changed while it stayed mounted — now
  shows the thumb immediately; it used to come back invisible and stay that way until the
  reader scrolled or the container resized. Hovering the thumb also picks up its hover
  color reliably, where a competing rule could previously win and leave it unhighlighted.

## 0.2.0

### Minor Changes

- 8729a01: Extract the floating-surface primitive shared by `Popover`, `Select`, and other
  anchored UI as the new public `FloatingPanel`. `Popover` and `Select` now
  compose `FloatingPanel` internally and their public registry trees collapse to
  the same transitive dependency set.

  Additions:
  - New public primitive `FloatingPanel` exported from
    `@diffgazer/ui/components/floating-panel` with `useFloatingPanelContext()` for descendants
    that need positioning state (`positioned`, `side`, `align`). The same subpath exports the
    `FloatingPanelProps` and `FloatingPanelContextValue` types.

    ```tsx
    import {
      FloatingPanel,
      useFloatingPanelContext,
      type FloatingPanelContextValue,
      type FloatingPanelProps,
    } from "@diffgazer/ui/components/floating-panel";
    ```

  - New public CSS variables on the `.ui-floating-panel` cascade:
    `--ui-floating-z`, `--ui-content-enter-from-{top|bottom|left|right}`,
    `--ui-content-exit-to-{top|bottom|left|right}`,
    `--ui-content-enter-duration`, `--ui-content-exit-duration`,
    `--ui-content-transform-origin` (auto-set, readable from transform-based
    keyframe overrides), `--ui-floating-trigger-width` (set when
    `matchTriggerWidth` is true), and `--floating-panel-available-height` /
    `--floating-panel-available-width` (set on every measure; read them to cap a
    custom panel's own scrollable region).

  Removals:
  - `PopoverContent.externalOnAnimationEnd` — was a leaked internal prop. Native
    `onAnimationEnd` continues to flow through via spread props.
  - `.animate-slide-in` / `.animate-slide-out` className-driven animation on
    `PopoverContent` and `SelectContent`. The `.ui-floating-panel` cascade
    replaces them and is overridable per side without className escalation.

  Changes:
  - `Select` `sideOffset` default changes from `0` to `4` so the menu reads as a
    distinct surface anchored to the trigger.
  - Reduced-motion behavior is now token-driven: under
    `prefers-reduced-motion: reduce`, all eight `--ui-content-{enter-from,exit-to}-*`
    tokens collapse to the fade-only keyframes. Per-instance overrides win.

- 6416350: Raise `@diffgazer/ui`'s `@diffgazer/keys` peer floor to `>=0.2.0` so package
  consumers receive the navigation API used by the current UI primitives.
- 6416350: Rename the decorated text input wrapper from `InputField` to `InputGroup`, and
  add a separate `Field` primitive for label/control/description/error wiring.

  Command palette highlight state now uses `highlighted`/`onHighlightChange` only,
  following the `@diffgazer/keys` rename to the semantic navigation callback API.

- 6416350: Normalize public form-like controls on `value`/`defaultValue`/`onChange(value)`
  instead of `onValueChange`. Native wrappers such as `Input` and `Textarea` keep
  React's native `onChange(event)` contract.

### Patch Changes

- 6416350: Stop tracking deterministic generated docs data and CLI source bundles. Root
  verification and docs preparation now regenerate library artifacts before
  validation/build so local development and deploys do not depend on committed
  generated JSON snapshots.
- 6416350: Document publish-gated install flows, local package validation, shadcn namespace
  setup, keyboard integration contracts, release-readiness governance, and runtime
  package surface validation for public handoff.
