---
document_id: LIB-04-html-profile-plan
artifact_type: plan
sdlc_stage: Build
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-04-html-profile
usage: plannedWorkItem
---

# LIB-04 — Scoped Implementation Plan

[Spec](spec.md), [Decision](decision.md), [Test Plan](test-plan.md). Current scope designOnly

## Owner paths and prerequisite

Inkforge existing targets: packages/editor-html/src/index.ts, browser.ts/server.ts, package exports, editor-core LinkNode/public constructors, engine bridge from LIB-03, content.css/registry and owned fixtures/tests New policy/AST/writer modules are proposed organization; no private import or JS-to-Go service added

LIB-04 depends LIB-03 per manifest Model target/rel/token metadata support must be typed/public and preserve constructors Engine profile-independent Core must not import editor-html back DS/Go/framework/renderer dependencies gate only affected combined capabilities

## Ordered slices after implementation assignment

| Slice | Output / gate |
| --- | --- |
| H01 | Normalize profile descriptor/fingerprint and freeze exact grammar/token/codec/writer versions |
| H02 | Standards-capable audited parser/strict verdict, original preservation and encoding/budget failure semantics; replace unsafe strict-mode reuse of regex projection |
| H03 | Public model bridge for target/rel/token semantics and normalization maps; unavailable until fidelity works |
| H04 | Canonical writer and parser re-evaluation; existing/new fixture semantics and exact checkpoint bytes |
| H05 | Content theme/style manifest/registry/placement coverage, CSS-first rollout and public-only bundle checks |
| H06 | Standalone/Builder host profile APIs, rejected repair/lifecycle/barrier/IME integration |
| H07 | Framework-neutral Go domain implementation when assigned, independent policy/verdict/AST/canonical/reference extraction evidence |
| H08 | Shared framework adapter after actual API/version available: handler/context/error/transaction conventions + integration gate |

No framework-specific Go type/package/routes selected during H01–H06; no fake adapter as acceptance If pure Go domain is implemented before framework, expose its real tested boundary and keep H08 unaccepted

## Verification and prototype adoption

Review working-tree prototype against pinned source before adoption body={format,value}, lossy sanitizer, target/rel loss, placeholder styles or only alias entries do not satisfy this slice Keep all user changes and source identities separate

Use actual owner package scripts after checking manifests/toolchain; inspect nonzero case coverage since package test can passWithNoTests Record exact implementation source+patch/packaged artifacts/runtime/browser/Go/framework versions and commands in [Evidence](evidence.md) No application commands/CI/hooks/releases performed by this plan

## Owner scope after documentation relocation

This work item lives in Inkforge for library implementation. H07/H08 Go/domain/framework acceptance is an external CMS/backend gate referenced by the canonical CMS profile document; do not implement Go handlers in this repository or infer framework readiness. The relocation changes ownership/navigation only, not designed outcomes or historical runtime evidence.
