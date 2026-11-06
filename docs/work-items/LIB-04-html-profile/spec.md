---
document_id: LIB-04-html-profile-spec
artifact_type: spec
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-04-html-profile
usage: plannedWorkItem
---

# LIB-04 — Specification Handoff

[Intent](intent.md). Source of truth: [Canonical Spec v0.1](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/25-inkforge-html-profile-and-parity.md), [Registry v0.1.0](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-contract.json) และ [Fixture Extension](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-fixtures.json) ไม่เปลี่ยน base HTML-01–22

## Requirement ownership

| Concern | Rules | Owner |
| --- | --- | --- |
| Profile/configuration/legacy compatibility | HP-01/02/06/19 | editor-html + host policy configuration |
| Audited parsing/strict verdict/benign normalization | HP-03/04/05/12/13/14 | editor-html browser/server adapters + host lifecycle |
| Canonical protocol and parser/writer parity | HP-07/08 | editor-html; Go domain independent implementation |
| Link/reference/render/save identity | HP-09/10/11/16/18 | model bridge/host/Go/renderer with existing contracts |
| Go shared framework boundary | HP-15 | Domain port first; framework binding later |
| Content theme/cohort/actual evidence | HP-17/20 | Content theme + consumer/release owners |

20 rules, 21 source references (18 code, 3 existing design), 8 proposed ports, 36 new HTML oracles + 22 base fixtures and 18 cross-layer scenarios All remain designed/notRun; no API implementation or browser/Go verdict inferred from static checks

## Persistence / failure

cms.richText v1 html/contentProfile literals and legacy blocks/runs preserved Reject unsupported/loss/truncated candidate with safe original, never canonical partial output Source/RawHtml/lang/media not implicitly enabled Exact Go Save input must already be canonical; no silent rewrite while acknowledging old checkpoint

## Framework boundary and handoff

No Go framework/parser package/interface/route chosen [Decision](decision.md) describes adaptation from general-library design and strict v1 details Implementation begins only under an assigned slice with actual dependencies; public API/profile/Go/CSS/renderer/cohort outcomes remain separate gates
