---
document_id: IF-LIB-02-UI-ADAPTER-DECISION
artifact_type: decision
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: plannedWorkItem
---

# Inkforge — adapter decision

[Intent](intent.md) → [Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md).

[Owner architecture](../../architecture/shared-ui-adapter.md) and [Registry](../../../contracts/shared-ui-adapter.json) are canonical; do not copy competing API definitions into this work item.

Agent design selection within the user's assigned continuation, not individual user approval of each API detail: keep additive optional public adapter entries; preserve legacy omitted behavior/native refs; introduce early trigger intent because click/pre-open alone can miss native focus; use host-held immutable NC fence and exact binding ack; separate foundation and downstream combined gates; do not introduce Core/UI/CMS cycles. Scope does not change publishing/persisted formats/business authorization or deferred Go framework/Tenant/Domain/Azure details.

Actual package name/distribution/private primitive/toolchain choice remains the implementer's U01 evaluation under the fixed contract. This is not an extra user-permission ceremony. Real behavior/consumer evidence is required before claiming readiness or publishing.
