# Changesets

Use Changesets for public package releases from this monorepo:

- `diffgazer`
- `@diffgazer/add`
- `@diffgazer/ui`
- `@diffgazer/keys`

All four are on npm. They take changesets, get versioned by `pnpm run version-packages`, and publish through
`pnpm run release`. That script publishes whatever npm lacks: every public package whose `package.json`
version is not on the registry, whichever commit bumped it. So a Version PR whose own CI failed still
ships from the next green push to main, and a run with nothing to publish is a no-op.
`scripts/monorepo/guard-publish.mjs` holds `FIRST_PUBLISH_ALLOWLIST` with all four names and rejects the
whole run if a never-published public package outside that list exists, so a new public package needs a
reviewed PR adding its name before it can reach npm — see
[PACKAGE_GOVERNANCE.md](../PACKAGE_GOVERNANCE.md#first-publish-gate).

Private package manifests are excluded from versioning and tagging through
`privatePackages.version: false` and `privatePackages.tag: false` in `.changeset/config.json`.
The release policy therefore follows each workspace manifest's `private: true` flag rather than a
manually maintained package list that could drift.
