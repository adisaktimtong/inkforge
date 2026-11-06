---
document_id: IF-LIB-02-UI-ADAPTER-INTENT
artifact_type: intent
sdlc_stage: Plan
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: plannedWorkItem
---

# Inkforge — adapter intent

[Intent](intent.md) → [Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md).

[Owner architecture](../../architecture/shared-ui-adapter.md) and [Registry](../../../contracts/shared-ui-adapter.json) are canonical; do not copy competing API definitions into this work item.

User accepted the proposal to close theme/interaction/package adapters, sequence diagrams, per-repo backlog and acceptance. This is a design assignment. Inkforge owns only its adapter/coordinator scope; library code/prototypes and other owners' authority remain intact. New API names are proposed, runtime notRun, no commit/push/package release/deploy.

Outcome: versioned public boundary; explicit source gaps and legacy opt-in behavior; native-focus/IME/bookmark/terminal-ack/portal/lifecycle/Save failure paths; owner tasks with dependencies and actual evidence requirements. Full production readiness is not inferred from a document or capability declaration.
