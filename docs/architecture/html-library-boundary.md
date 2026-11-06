---
document_id: DOC-INKFORGE-HTML-LIBRARY-BOUNDARY
artifact_type: spec
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
usage: canonicalReference
---

# Inkforge HTML library — Ownership and public boundary

Inkforge owns generic HTML parsing/serialization/profile mechanisms and typed model round-trip support. This is a design handoff for the existing library, not new API implementation. Source baseline is 9d7392d1aae9ef6c25040ce7c2318324f0a55d35; working-tree experiments remain unreviewed.

## Owned library behavior

- Preserve existing root/browser/server HTML entries and opt-in explicit profile behavior; legacy parseHtml/serializeHtml do not become a strict CMS validator by naming alone.
- Standards-capable audited fragment parsing must expose loss/unsupported/repair/truncation diagnostics before destructive model projection. Keep original candidate safely while host authorization remains valid.
- Public model/bridge carries all profile-permitted link/target/token semantics and selection/history mapping; missing fidelity makes capability unavailable, not silently normalized away.
- Canonical serialization comes from validated model/AST with declared immutable profile/writer/token configuration. Reparse/semantic/idempotence checks and finite explicit-unit budgets belong to actual implementation acceptance.
- General-library profiles may support capabilities beyond a particular CMS deployment; installing a library does not enable Source, RawHtml, arbitrary styles or media for a consumer.
- Public package/type/packed consumer/browser/IME/CSS evidence is versioned by this library. Core remains independent of HTML parser, React, CMS permissions and transport.

## CMS policy and integration authorities

[CMS HTML/Profile specification](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/25-inkforge-html-profile-and-parity.md) and [CMS profile registry](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-contract.json) own the concrete cms-body-v1 allowlist/canonical wire protocol, logical-reference grammar, Go domain/framework validation, server receipt and exact Save requirements. Their fixture oracles do not certify library behavior. They remain CMS integration contracts.

Library work is tracked in [LIB-04](../work-items/LIB-04-html-profile/intent.md). H07/H08 Go/framework tasks in its handoff plan are external integration gates owned by CMS/backend; they are not an instruction to implement Go inside Inkforge.

## Existing architecture and current engine

Read [Editing Engine](24-inkforge-editing-engine.md) and the existing [Architecture Spine](../../_bmad-output/specs/spec-editor-engine/architecture-spine/ARCHITECTURE-SPINE.md). Preserve source versus prototype versus proposed design versus actual evidence. No runtime/profile/cohort result is promoted by this documentation move.
