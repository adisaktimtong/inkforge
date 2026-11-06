---
document_id: LIB-03-inkforge-engine-intent
artifact_type: intent
sdlc_stage: Plan
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine
usage: plannedWorkItem
---

# LIB-03 — Inkforge Editing Engine / Intent

นำ public model/React surface ที่มีอยู่ไปสู่ engine-owned editing เพื่อให้ standalone และ Page Builder ใช้ text/selection/history/IME ชุดเดียวกันและส่ง stable snapshot ให้ LIB-05 ได้

คำขอ “เริ่มเลย” ต่อจากข้อเสนอ “ออกแบบแกน Inkforge” เป็น authorization ของงานออกแบบนี้ ไม่มี application coding/release ที่เริ่มจากเอกสารนี้

## Inputs and scope

- [Canonical engine spec](../../architecture/24-inkforge-editing-engine.md), [Registry](../../../contracts/inkforge-engine-contract.json), [Decision](decision.md)
- Source: `adisaktimtong/inkforge@9d7392d1aae9ef6c25040ce7c2318324f0a55d35`; use committed model/React/HTML and Architecture Spine, preserve unreviewed prototype
- LIB-03 depends LIB-01/02; LIB-04 HTML and LIB-05 nested coordinator follow actual API readiness from [Compatibility Manifest](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/compatibility-manifest.json)

## Outcome

Self-owned pure command/transaction kernel, deterministic selection maps, one history owner, IME buffer with one final transaction, backward-compatible React adapter and public standalone controller Engine-local commit, parent ack and server Save remain distinct

HTML profile/Go parity, full DS, Source UI/checker/media/plugin features beyond kernel extensibility and release cohort are separate slices No silent cms.richText/legacy format migration, new autosave or provider/live tenant changes

[Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md)
