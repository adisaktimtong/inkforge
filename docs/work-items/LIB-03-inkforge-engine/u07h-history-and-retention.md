---
document_id: IF-U07H-HISTORY-RETENTION
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-05-nested-editor/U07-H
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# U07-H — Actual history identity and retained host contexts

ControllerSnapshot.historyGroupId identifies the latest content edit history unit. Merged typing shares it; a new unit/gap/explicit closure/selection boundary/non-typing action/replay causes the appropriate later edit to use a new identity. It is not an open-group flag, server version or persisted document property. The prepared field captures this identity with its original child token; optional flush({groupHistory:true}) forwards it without reading a newer child's history after callbacks. Default explicit flush and residual staged Save remain compatible.

PublicHostFieldPort optionally supports retainContextFence; actual standalone host implements bounded holds. Field deliveries and staged checkpoints release holds at outcome/checkpoint release/terminal disposal, preserving original Save B while many later C values are delivered. Saturated capacity blocks new issuance and never evicts a held context. Legacy custom hosts without retention keep their bounded old behavior and can report old local acknowledgment blocked. Both child/session/context checks remain authoritative locally; no browser port grants Go permissions.

[Owner evidence](../../../contracts/u07h-history-retention-evidence.json) links [CMS-owned actual packed/native tests](../../../../enterpises_cms/docs/work-items/LIB-05-nested-editor/u07h-evidence.md). Independent standalone retention, actual controller history/gap/replay and ninety later deliveries are exercised. Native quarantine also preserves the complete field plain text for review when an unknown mutation lies outside the selected block; DBH04 first failed before that fix. Product-wide logical focus/portal routing, native OS IME/AT/other browser cohorts, complete editor features and live backend acceptance remain separate. No persisted model/legacy blocks-runs/HTML format change.
