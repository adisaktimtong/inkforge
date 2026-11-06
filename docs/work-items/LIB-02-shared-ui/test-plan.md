---
document_id: IF-LIB-02-UI-ADAPTER-TEST
artifact_type: test-plan
sdlc_stage: Test
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: plannedWorkItem
---

# Inkforge — adapter acceptance plan

[Intent](intent.md) → [Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md).

[Owner architecture](../../architecture/shared-ui-adapter.md) and [Registry](../../../contracts/shared-ui-adapter.json) are canonical; do not copy competing API definitions into this work item.

Legacy native div ref and HTML modes; separate engine-bound value authority; actual public controller/bookmark/selectionEpoch; pre-focus IME guard; composite Field; standalone without Builder; borrowed-engine Strict cleanup and terminal disposal. No private DOM/execCommand or fake bookmark echo as engine evidence.

Actual evidence layers: generated public TypeScript declarations/invalid branches; semantic native DOM/ref tests; browser native events and coordinate hit-testing; real Thai OS IME; manual screen-reader/RTL/zoom/forced-colors/reduced-motion; strict declared CSP/nonce/positioning; public packed imports/single React/CSS; standalone then combined cohort. Record passed/failed/blocked/notRun/manualReview separately. No zero tests/--passWithNoTests or self-declared handshake can satisfy a behavior gate.

Per-case IDs and oracles are in CMS `contracts/authoring-ui-adapter-fixtures.json` (working-tree draft), reached through the documented owner checkout map. Owner cases map to UA-01–20; do not invent a new persisted/auth/Go wire protocol.
