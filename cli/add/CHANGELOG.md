# @diffgazer/add

## 0.2.0

### Minor Changes

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

### Patch Changes

- 24411b0: Audit pass on the `dgadd` CLI. Refactors the add/init/remove/diff commands, the registry transform and namespace handling, CSS-chunk extraction, and the keys copy-bundle integration. Behavior-preserving cleanup and bug fixes to the install paths.

  Reconstructed retroactively from the post-0.1.1 history; these changes predate the changeset-based flow.

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

## 0.1.1

### Patch Changes

- 6416350: Stop tracking deterministic generated docs data and CLI source bundles. Root
  verification and docs preparation now regenerate library artifacts before
  validation/build so local development and deploys do not depend on committed
  generated JSON snapshots.
- 6416350: Document publish-gated install flows, local package validation, shadcn namespace
  setup, keyboard integration contracts, release-readiness governance, and runtime
  package surface validation for public handoff.
