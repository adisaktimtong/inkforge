---
document_id: LIB-03-inkforge-engine-spec
artifact_type: spec
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine
usage: plannedWorkItem
---

# LIB-03 — Engine Specification Handoff

[Intent](intent.md). Canonical behavior is [Engine Spec v0.1](../../architecture/24-inkforge-editing-engine.md); IDs, tagged payload vocabulary and designed cases live in [Registry v0.1.0](../../../contracts/inkforge-engine-contract.json) Do not define duplicate types in each adapter

## Deliverable and requirements

| Area | Rules | Owner |
| --- | --- | --- |
| Existing model + runtime IDs/state counters | IE-01/02/03 | editor-core public contracts |
| Position/selection/mapping/segmentation | IE-04/05/06 | Core + injected provider; DOM mapping adapter |
| Atomic pipeline/commands/events/normalization | IE-07/08/09/10/11 | Core |
| History/saved witness/bounds | IE-12/13/19 | Core with host/HTML bridge |
| Input and IME/draft retention | IE-14/15/16 | internal/editor-dom + public controller |
| React/plugin/lifecycle/standalone compatibility | IE-17/18/20/21/22 | React + Core + host contract |

Read [Decision](decision.md) before adopting upstream AD-3/19/20 verbatim Public ports are proposed, not existing exports Field owner/auth/Go versions remain host responsibilities under [LIB-05](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/work-items/LIB-05-nested-editor/spec.md)

## State and persistence boundary

Runtime IDs sidecar preserves public AST constructor shape Positions UTF-16 text units/child indexes with affinity; grapheme is deletion unit via declared provider, not address unit Selection/stored marks/composition update stateVersion without falsely creating document revision

Engine never serializes IDs or replaces cms.richText props with body objects Native partial composition and invalid draft are not committed model snapshots No auto-write, localStorage/IndexedDB draft store or server recovery introduced

## Acceptance handoff

22 rules, 46 designed scenarios in 9 groups and 6 normative mapping vectors (not executed mapper tests) Group/ruleRefs in registry define exact coverage Real browser native Thai IME and packed consumers required beyond pure Core tests; actual Go/profile/cohort results belong to LIB-04/05/10 gates

Finite budget values are proposed review fixtures; implementer must expose validated bounds and declare actual tested cohort limits No capability enabled because a conceptual controller method appears in this spec
