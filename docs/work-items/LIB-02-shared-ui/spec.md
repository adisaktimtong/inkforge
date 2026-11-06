---
document_id: IF-LIB-02-UI-ADAPTER-SPEC
artifact_type: spec
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: plannedWorkItem
---

# Inkforge — adapter specification

[Intent](intent.md) → [Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md).

[Owner architecture](../../architecture/shared-ui-adapter.md) and [Registry](../../../contracts/shared-ui-adapter.json) are canonical; do not copy competing API definitions into this work item.

Implement only the named public owner boundary against CMS UA-01–20, original NC/engine/profile/session contracts and Common UI ports. Source observations pin committed baseline; unreviewed working-tree prototypes are not adopted. Library-local pass and full combined CMS cohort stay distinct.

Owner tasks: UA-IF01, UA-IF02, UA-IF03, UA-IF04, UA-IF05, UA-IF06. Source/type/schema/design checks are not behavior certification. Theme projection never changes saved HTML/profile/dirty; public refs/native semantics remain stable; old context cannot apply after disposal. CMS complete envelope and original operation/Save receipts stay outside shared UI.
