---
document_id: IF-U07C-EVIDENCE
artifact_type: evidence
sdlc_stage: Test
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-C
usage: scopedRuntimeEvidence
related_stages:
- Build
---

# U07-C — Actual native engine-surface evidence

[Decision/scope](u07c-native-surface.md) and [machine-readable source/artifact record](../../../contracts/u07c-native-surface-evidence.json) identify the current uncommitted candidate. The legacy surface and the new engine-owned surface are distinct runtime paths.

## Reproduction

From Inkforge with sibling UI Component/Page Builder checkouts and installed owner tooling:

```sh
node scripts/check-engine-surface.mjs
```

The default verifier creates a fresh five-package packed cohort through the U07-A verifier, uses physically installed packages and locked offline npm ci, builds Next, runs actual pure-controller tests in the React/UI-free consumer and overlays the owner engine fixture into the installed Next consumer. Private imports are sealed; the engine entry imports with the optional UI peer absent. The strict Next consumer compiles actual emitted declarations with skipLibCheck false. Production and development run against the same installed tarball set, with genuine Next reactStrictMode development replay.

INKFORGE_ENGINE_FAST=1 is diagnostic iteration only: changed packages are rebuilt/repacked/reinstalled, and its result cannot be promoted to final acceptance. The final recorded command used the default full fresh cohort, not that shortcut. Both paths delete only the scratch consumer's .next build output before a new build, because Webpack treats node_modules versions as immutable and local development tarballs reuse a version. Earlier iterations proved that stale dependency caches could otherwise execute old package bytes. No source alias or relaxed type/export/CSP gate is used.

## Results

- 24 production Chromium cases passed through InkforgeEngineEditor/InkforgeEngineField with the real public createEngine controller and public Common UI toolbar.
- Two actual development cases passed: genuine effect replay retains the borrowed controller/one functional surface, and three unmount/remount cycles return native event listeners, document selection listeners and mutation observers to baseline.
- All 54 prior pure-controller cases plus two new atomic input cases passed from the physically installed Core tarball with React/Common UI absent.
- Ten new invalid public surface type examples reject when their directives are removed. Strict positive declarations/Next build pass; SSR seed escapes source text and is noneditable until attachment, without disposing/mutating the borrowed engine. The optional engine entry imports with UI absent.
- The same final cohort also passes U07-A's 12 Node/SSR and 13 legacy native browser cases plus nine existing type constraints. These legacy cases remain separate from the 24 new native cases. The Common UI runtime artifact remains unchanged.

Native tests cover typing/undo, pointer-focus bookmark restore, one-transaction selected Enter/multiline paste, hard breaks, Unicode deletion, independent engines, external replacement, context/selection/fence staleness, native composition, presentation changes, disabled/unmounted buffers, invalid DOM quarantine/explicit discard and read-only unsupported policy. CDP imeSetComposition/insertText drives real Chromium composition events; it is not an OS Thai keyboard/IME qualification. The noncancelable replacement fixture is a declared synthetic event/DOM schedule, not an OS spellchecker claim.

## Observed fixes and practical limits

A targeted same-task native-mutation/dispose oracle initially left old text in the DOM after the controller had disposed. Terminal clearing now precedes quarantine, drops owned DOM records and the cached SSR seed, and prevents late mutation revival (C23).

The adapter avoids repeated diagnostics from layout updates after a stale composition. Discard restores only owned model nodes and removes unmanaged text. Model selection synchronization is awaited in tests before asserting that bookmark restore itself does not advance selectionEpoch; context replacement is awaited before releasing the old pointer. Toolbar-focused shortcuts use the same controller history and prevent an outer undo route (C24). Native fallback keeps a rejected-gesture tombstone rather than manufacturing a fresh bookmark.

The TypeScript 7 declaration generator assumes sources lie beneath its selected tsconfig directory. A dedicated repository-root declaration project includes the private DOM implementation, which is bundled into public JS/types instead of becoming a private package dependency. Dependency checking stays enabled in the actual consumer. The repository's existing ESLint config has no matching TypeScript rules; ignored files are not accepted as a TS lint pass.

Exact host field acknowledgment/echo/barriers, new-renderer HTML/profile policy, rich slice paste/cut writer/drop, remaining list/link/layout/plugins, native OS IME/manual screen readers, Firefox/WebKit/Safari, production CSP of this new fixture and release/performance qualification remain open. Full U07/CMS certifiedRuntime remains null. Session-local logs/tarballs are referenced with hashes; no durable artifact publication, commit/push or deployment is implied.
