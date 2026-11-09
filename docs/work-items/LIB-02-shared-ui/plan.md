---
document_id: IF-LIB-02-UI-ADAPTER-PLAN
artifact_type: plan
sdlc_stage: Build
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: plannedWorkItem
---

# Inkforge — adapter implementation plan

[Intent](intent.md) → [Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md).

[Owner architecture](../../architecture/shared-ui-adapter.md) and [Registry](../../../contracts/shared-ui-adapter.json) are canonical; do not copy competing API definitions into this work item.

| Slice | Depends on | Deliverable | Required proof |
| --- | --- | --- | --- |
| UA-IF01 | UA-UI01, LIB-01 | Additive editor-react/common-ui entry and uiAdapter prop | Existing div ref/value behavior preserved; no Builder/CMS import |
| UA-IF02 | UA-IF01, LIB-03-engine-contract | Public controller/selectionEpoch/bookmark and host-binding bridge | Engine-owned public transactions/history; no DOM scraping/fake controller |
| UA-IF03 | UA-IF02, UA-UI04 | Shared toolbar/menu/overlay and pre-focus intent capture | Formatting state public snapshot; composition veto before controllable focus |
| UA-IF04 | UA-IF02, UA-UI02 | Composite Field IDs/native div ref and standalone host branch | Standalone plain form works without Builder; no second value authority |
| UA-IF05 | UA-IF03, UA-IF04 | IME/selection/history/lifecycle real browser schedules | Programmatic restore does not pretend new user selection; stale async/terminal cleanup tested |
| UA-IF06 | UA-IF05, UA-UI06 | Packed standalone and host-compatible Inkforge evidence | Exact public controller/UI/CSS/browser/IME artifacts; no whole-CMS certification |

Full dependency DAG and the other owner tasks are in the CMS integration registry. Foundation Common UI capability is sufficient to begin engine integration; complete combined acceptance remains downstream. Existing coarse LIB work packages are not marked done by a foundation subgate. ExternalGates are prerequisite design/implementation capabilities, not proof they passed.

Implementation must first inspect actual repository/package/toolchain/public declarations, preserve existing prototypes and choose exact artifacts under U01/LIB-01. Use public entries, no source alias/private import workaround. For each task, update actual nonzero test outcomes with source+patch/package/CSS/runtime/browser/IME/AT identity. Current task creates documentation only; package publishing and commit/push are not performed.

## Current U07-A assignment

[Presentation decision](u07-presentation.md) and [actual evidence](u07-evidence.md) record the independent owner entry/buttons/theme boundary. Full engine/host integration remains open; no coarse work item or combined certification is marked done.

## U07-B engine prerequisite

[Actual pure controller](../LIB-03-inkforge-engine/u07b-controller.md) and [evidence](../LIB-03-inkforge-engine/u07b-evidence.md) now supply public model commands/selectionEpoch/bookmarks. UA-IF03 toolbar binding and UA-IF05 host acknowledgment remain downstream; the legacy engineBinding guard stays active until the actual DOM/host protocol is implemented.

## U07-C actual engine toolbar/Field binding

[Owner native decision](../LIB-03-inkforge-engine/u07c-native-surface.md) / [actual evidence](../LIB-03-inkforge-engine/u07c-evidence.md) now qualify the separate controller-owned component and fixed public Common UI Toolbar/Button/Field composition. The complete proposed engineBinding/hostField API remains gated pending U07-D exact HTML/profile/ack barriers.
