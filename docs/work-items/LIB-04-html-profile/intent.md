---
document_id: LIB-04-html-profile-intent
artifact_type: intent
sdlc_stage: Plan
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-04-html-profile
usage: plannedWorkItem
---

# LIB-04 — HTML/Profile Intent

ให้ Inkforge standalone และ Page Builder ใช้ canonical HTML/profile ที่ไม่สูญข้อมูล มีสัญญาการตรวจร่วมกับ Go ที่เป็นอิสระจาก framework และรักษา exact snapshot ที่ Save/Preview ใช้

Current task “งานต่อไป” เป็นงานออกแบบต่อจาก LIB-03 และข้อยืนยัน Go framework กลาง ยังไม่ใช่ application coding/publish/deploy assignment

## Inputs / ownership

- [Canonical Spec](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/25-inkforge-html-profile-and-parity.md), [Registry](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-contract.json), [Fixture Extension](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-fixtures.json)
- [22 fixtures เดิม](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/rich-text-profile-fixtures.json), [Link Contract](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/link-reference-contract.json), [LIB-03](../LIB-03-inkforge-engine/spec.md), [LIB-05](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/work-items/LIB-05-nested-editor/spec.md)
- Inkforge source 9d7392d1aae9ef6c25040ce7c2318324f0a55d35; browser/server entries/model/parser/CSS ที่มีอยู่และ Architecture Spine AD-5/6; working prototypes not adopted

## Outcome / limits

Immutable profile, audited strict verdict, deterministic canonical writer, typed link/target/rel/token round-trip, finite complete-input limits, public API compatibility และ exact Save/Go policy handoff Source/RawHtml/media/general-library extras ยังแยกจาก cms-body-v1

Go framework API/version/signature/handler wiring deferred ตาม [Stack §8](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/01-stack-and-service-boundaries.md) ไม่สร้าง framework หรือเพิ่ม JS service เพื่อข้าม Go contract

[Spec](spec.md) → [Plan](plan.md) → [Test Plan](test-plan.md) → [Evidence](evidence.md); [Decision](decision.md)
