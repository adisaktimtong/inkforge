---
document_id: DOC-INKFORGE-SDLC-INDEX
artifact_type: index
sdlc_stage: Plan
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
usage: navigation
---

# Inkforge — Documentation and SDLC

Library-owned text engine and HTML implementation contracts/work items live here. Source baseline 9d7392d1aae9ef6c25040ce7c2318324f0a55d35 is distinct from unreviewed working-tree experiments.

- [Editing Engine Specification](architecture/24-inkforge-editing-engine.md)
- [Engine Contract](../contracts/inkforge-engine-contract.json)
- [HTML Library Boundary](architecture/html-library-boundary.md)
- [LIB-03 engine](work-items/LIB-03-inkforge-engine/intent.md)
- [LIB-04 HTML/profile implementation](work-items/LIB-04-html-profile/intent.md) — Go/framework gates remain with CMS
- [Existing Architecture Spine](../_bmad-output/specs/spec-editor-engine/architecture-spine/ARCHITECTURE-SPINE.md) — existing design input, not proof of implementation

## Cross-repository handoff

[CMS repository documentation index](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/repository-documentation.md) coordinates integration ownership; [SDLC process](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/19-artifact-driven-ai-sdlc.md) and [artifact templates](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/templates/README.md) remain centrally referenced. Work items use intent → spec → plan → test/evidence with actual execution recorded separately.

[Owned document map](../contracts/document-map.json) covers the documents managed by this migration; pre-existing repository source/legacy documents are retained. Cross-repository Markdown links use the documentation branches on GitHub for navigation. Exact library documentation commits and artifact digests are recorded by the CMS ownership registry after publication. Branch links are mutable guidance, not runtime/cohort certification; the containing Git commit versions this owner document map.

## Shared authoring UI adapter — draft

[Owner adapter design](architecture/shared-ui-adapter.md), [Public port registry](../contracts/shared-ui-adapter.json) and [LIB-02 adapter work item](work-items/LIB-02-shared-ui/intent.md) define additive opt-in interfaces and six owner backlog slices. These current-working-tree documents are not yet published; source/prototypes and prior published documentation hashes remain separate. CMS owns integration/combined acceptance; owner runtime tests remain notRun.

## Documentation publication

The user authorized commit/push of this design. This containing commit versions the current owner documents, schemas and planned work items; status remains draft/designOnly and runtime acceptance remains notRun. Earlier uncommitted/not-published statements describe the design snapshots before this publication. CMS records exact pushed library commits and current artifact hashes after remote verification; source baselines/prototypes remain separate. No application code, package release or runtime certification is included.

## U07-A current owner presentation

[Implementation scope](work-items/LIB-02-shared-ui/u07-presentation.md) and [actual evidence](work-items/LIB-02-shared-ui/u07-evidence.md) identify additive opt-in Common UI exports. The complete target adapter remains partial: engine-owned bookmarks and exact host-field delivery are downstream. Earlier committed design/source pins retain their original meaning.

## U07-B pure controller implementation

[Controller decision](work-items/LIB-03-inkforge-engine/u07b-controller.md) and [actual packed evidence](work-items/LIB-03-inkforge-engine/u07b-evidence.md) now identify createEngine/EngineController and granular model/selection/history/bookmark APIs. The legacy prototype stays separate. DOM/React engine binding and exact host delivery remain U07-C gates.

## U07-C controller-owned native surface

[Native/React decision](work-items/LIB-03-inkforge-engine/u07c-native-surface.md) / [actual packed evidence](work-items/LIB-03-inkforge-engine/u07c-evidence.md) identify InkforgeEngineEditor, InkforgeEngineField, guarded public bookmarks, native composition and borrowed-surface lifecycle. Exact host acknowledgment/profile integration remains U07-D.
## U07-D exact host field boundary

[Current decision](work-items/LIB-03-inkforge-engine/u07d-host-boundary.md) and [actual evidence](work-items/LIB-03-inkforge-engine/u07d-evidence.md) qualify canonical model/profile delivery, a standalone host and the actual Builder public port. CMS all-field/server Save acceptance remains separate.
## U07-E retained host integration

[Parent observation decision](work-items/LIB-03-inkforge-engine/u07e-parent-observation.md) and [owner evidence](../contracts/u07e-retained-host-evidence.json) qualify the retained public binding in the actual Builder Inspector. Unrelated parent changes preserve child drafts/history while old issued operations remain stale.
