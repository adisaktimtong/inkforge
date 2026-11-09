---
document_id: IF-U07B-EVIDENCE
artifact_type: evidence
sdlc_stage: Test
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-B
usage: scopedRuntimeEvidence
related_stages:
- Build
---

# U07-B — Actual packed controller evidence

[Implementation scope](u07b-controller.md), the [target spec](spec.md) and [machine-readable source/artifact record](../../../contracts/u07b-controller-evidence.json) distinguish this pure controller from full LIB-03/U07/CMS acceptance.

## Reproduction and artifact identity

From Inkforge with the sibling Common UI/Page Builder checkouts and installed owner tooling:

```sh
node scripts/check-controller.mjs
```

The default command runs the existing U07-A five-package verifier offline, including physical locked Next 16/React 19 consumers and native legacy schedules, then installs no aliases: it executes controller tests from the physically installed public @inkforge/editor-core package in that cohort's React/UI-free headless consumer. A fresh child process with throwing browser-global getters imports/edits through the new controller. Deep private imports reject. Engine/controller tests use a standalone Node process with test-isolation=none; nonzero test/pass/no-skip counts are asserted.

The final invocation was the default `node scripts/check-controller.mjs` command and rebuilt/exercised the full current cohort. An earlier retry also exercised `UI_U07B_REUSE_PACKED=1`: that path rebuilds/typechecks Core and repacks it, requiring SHA-512 byte identity with the already exercised cohort before reuse, then reruns controller/type/legacy checks. The final run does not rely on an older source artifact. Final source/test digests and the full-cohort log are recorded in the JSON evidence. Only local artifact integrities change in copied locks; external resolutions remain locked.

## Actual results

- 54 pure-controller Node cases passed through the installed public tarball: 48 CB cases plus the six normative IE-V01–06 mapper vectors. The cases include 500 string-oracle edit/undo/redo sequences and 150 independent per-character mark/ID restoration sequences.
- Strict emitted declarations compile in the real Next 16.4.3/React 19.3.1 consumer with TypeScript 7.0.2 and skipLibCheck false. Removing all 12 new expected-error directives yields 13 compiler diagnostics across 12 distinct invalid examples; one example deliberately has two invalid numeric position endpoints.
- 13 unchanged legacy prototype regression cases passed. The exact same rebuilt Core artifact also passed U07-A's 12 Node/SSR plus 13 production Chromium native editor schedules and nine previous type constraints. These existing browser cases exercise the legacy surface, not a DOM binding of the new controller.
- The new controller imports and edits with React, ReactDOM, Common UI and browser globals absent. UI/Builder/HTML/React source and the legacy engine file/constructor bodies remain preserved; only the additive Core export and new owned implementation are changed.
- Prettier checks pass for the new files. The repository ESLint configuration supplies no matching TypeScript configuration, so ignored TS files are not counted as a passing TypeScript lint gate. The strict compiler and behavior tests ran; full release-toolchain/lint acceptance remains separate.

The harness initially counted raw compiler messages rather than invalid examples and used CJS require resolution for an ESM-only export. It now verifies both unique invalid-example lines and message count, and uses the package's supported import condition. No dependency type checking or package export seal was weakened. Source-level mapping checks also cover container boundaries through split/join, and history grouping is bounded so it cannot advertise an undo that exceeds the operation limit.

## Limits

This is pure model/controller qualification. The composition tests call its explicit protocol and do not claim native browser/OS IME input for this new engine. Native DOM reconciliation, one-history routing in engine-bound React, exact host field acknowledgments, HTML/profile parity, list/link/slice/plugin/layout commands, manual AT/browser-family/performance and the declared pnpm 12.4.2 clean release-toolchain installation remain unqualified. The existing local pack invocation uses pnpm 11.25.0 without editing the declared manager or lock.

The canonical design catalogue still describes the complete future engine; its older source/evidence limits refer to that pinned design snapshot. This file and its JSON are the actual executed implementation scope. The full CMS certifiedRuntime remains null. Model witness acknowledgment is not a CMS Save receipt, and no commit/push, publication, deployment or Go/live-setting change was performed.
