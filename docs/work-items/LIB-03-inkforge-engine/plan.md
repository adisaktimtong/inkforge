---
document_id: LIB-03-inkforge-engine-plan
artifact_type: plan
sdlc_stage: Build
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine
usage: plannedWorkItem
---

# LIB-03 — Scoped Implementation Plan

[Spec](spec.md), [Decision](decision.md), [Test Plan](test-plan.md). Current mode designOnly; no application code changed by this plan

## Owning repository targets

Inkforge existing paths: packages/editor-core/src/index.ts, packages/editor-react/src/index.ts, toolbar.ts/formatting.ts/inline.ts, internal/editor-dom/src/index.ts, package exports/manifests and owned tests/fixtures New model/commands/selection/history modules beneath editor-core are proposed organization, not existing files

Preserve existing public constructors/HTMLDivElement ref; add opt-in controller via public export review Do not import Page Builder/CMS/private workspace paths into public Core Engine mode instance must switch fully to engine ownership; do not leave execCommand/native history fallback active within it

## Ordered slices after implementation assignment

| Slice | Purpose | Verification before dependent slice |
| --- | --- | --- |
| E01 | Model validation, sidecar identity, immutable config/state/counters | Constructor/import/cycle/ID lineage and no persisted ID fixtures |
| E02 | Position/index/range and operation/inverse maps | Affinity/split/join/delete/move/normalization vectors + property invariants |
| E03 | Typed commands, atomic transaction pipeline, plugins/normalizers/events | Whole candidate rejection, stale guards, convergence/reentrancy and noChange |
| E04 | Semantic history/baseline/checkpoints/finite ledgers | Clock boundaries, undo/redo IDs/selection, exact ack B while C dirty, capacity |
| E05 | Single DOM adapter beforeinput/selection/clipboard/native fallback | Real browsers, bounded native reconciliation, one history owner per intent |
| E06 | IME transient state/finalization/dedupe/invalid safe draft | Synthetic event order schedules + actual native Thai IME matrix |
| E07 | React public controller binding/external store/ref compatibility | Bare/toolbar/controlled/Strict Mode/Next packed consumer fixtures |
| E08 | Standalone + LIB-04/05 bridge readiness evidence | Public-only imports and exact proposed port behavior, keep missing capabilities gated |

LIB-02 DS dependency remains in manifest even where pure Core slices can be prepared independently HTML policy code stays with editor-html; core receives validated descriptors/model and witness, never an import cycle

## Prototype review and compatibility

Diff prototype against pinned source before adoption replaceDocument-only prototype cannot satisfy granular editing/mapping/native history paths Inspect body={format,value} mismatch and private imports; do not rewrite user changes to make tests green Source architecture amendments from [Decision](decision.md) should be applied in owning repo with authorized implementation scope, not declared already adopted now

## Commands and evidence

Pinned workspace declares pnpm 12.4.2, Node >=22.18.0 and scripts typecheck/test/test:browser/check:packages/validate Recheck actual assigned manifests/lockfiles/runtime before installing or running; package tests may allow zero tests Use focused affected contract/browser suites and inspect executed case counts before broad required owner gates

No commands above have been run for application acceptance in this design task Record exact source+patch/package artifacts, actual command/CWD/runtime/OS/browser/IME, case/variant outcomes and remaining gates in [Evidence](evidence.md) No CI configuration or publish/deploy action added
