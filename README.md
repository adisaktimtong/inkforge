# Text Editor Engine

This repository is a pnpm 12.4.2/Turborepo workspace for independently versioned public editor packages. It currently establishes package and release boundaries only; it intentionally contains no editor behavior.

## Requirements and setup

Use Node `>=22.18.0` (Node 24 is the release runtime) and pnpm `12.4.2`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

Public packages use temporary logical names until the first-publication gate chooses an npm scope. Consumers may import only entries declared in each package's `exports`; `internal/*` and `apps/*` are private and are never published. `editor-react` peers `editor-core`, React, and React DOM; future internal adapters must be bundled rather than left as runtime dependencies.

## Release contract

Changesets version public packages independently and the `Release PR` workflow only prepares a version PR. Canary/snapshot packages are for pull requests, `beta` is for release candidates, and `latest` is promoted only after the release cohort's packed-consumer, compatibility, and three-browser checks pass. Stable cohorts publish under a temporary dist-tag first, are smoke-tested, then promote atomically; rollback restores range-compatible last-known-good tags, deprecates broken versions, and forward-fixes without unpublishing.

Publishing is manual and approval-gated by the `npm-production` GitHub Environment. It runs on GitHub-hosted Node 24 with npm Trusted Publishing/OIDC; no npm credentials are stored in this repository. Before enabling it, select final scoped package names, configure npm trusted-publisher mappings, and confirm environment reviewers. Security fixes deprecate affected versions, correct dist-tags, and release a forward fix.

`pnpm check:packages` runs publint, Are the Types Wrong, packs public packages, installs tarballs in a clean consumer, verifies declared entry points, and rejects private/deep imports.
