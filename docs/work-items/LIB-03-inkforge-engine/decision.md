---
document_id: LIB-03-inkforge-engine-decision
artifact_type: decision
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine
usage: plannedWorkItem
---

# IE-DEC-01 — Reconcile upstream kernel design with current CMS integration

Scope: agent design selection within the user's assigned design task Date: 2026-11-06 UTC Status: draft design decision; no additional user approval or runtime adoption claimed [Intent](intent.md), [Spec](spec.md), [Canonical Contract](../../architecture/24-inkforge-editing-engine.md)

## Concrete inputs and authority

Pinned Inkforge Architecture Spine AD-1/2/3/18/19/20 at commit 9d7392d1aae9ef6c25040ce7c2318324f0a55d35 is existing design input, not an instruction to perform build/release It already chooses self-owned pure Core and model positions The current user has asked to continue system design, confirmed pre-expiry session continuity, and selected whole-unit conflict review

Latest [LIB-05 Contract](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/nested-editor-coordination.json) requires pending/rejected draft retention while authorized, no forced Save IME termination, exact captured Save B acknowledgement while C remains dirty, and terminal auth cleanup No new product decision is needed to preserve those established constraints

## Options and effects

| Option | Result | Effect |
| --- | --- | --- |
| Use existing DOM/native adapter as kernel | Minimal changes but no consistent atomic model/history/prepare | Does not meet existing AD-2/19/20 or LIB-05; not selected |
| Introduce third-party editor kernel | Faster borrowed transactions with different public types/dependencies | Conflicts with existing AD-1 and repo-owned model direction; not selected |
| Evolve self-owned model/kernel and reconcile explicit boundaries | Granular engine and public adapter while retaining current AST/React API | Selected for this design; greater implementation/testing effort remains visible |

## Selected design and exact clarifications

1. Preserve AD-1/2/18 self-owned pure kernel and type ownership; runtime node IDs use sidecar state to preserve current exported constructors/AST input shape No persisted HTML/CMS schema change
2. Clarify AD-3: **baseline** changes only on host confirmation; derived dirty may return clean when Undo restores the already acknowledged content Selection/stored marks do not create dirty content
3. Clarify AD-19: ack carries exact captured source revision/content/profile/checkpoint, not necessarily equal to current revision Accept B while C remains dirty; never roll baseline backwards Host dialogs/AI exact revision fence still rejects stale results even if internal bookmarks could map
4. Adapt AD-20 invalid buffer behavior: do not automatically cancel/replace with old text when valid user work cannot commit Keep inert safe candidate and visible diagnostics while authorized; block Save until explicit resolution
5. Adapt AD-20 finalization/disposal: Save never forces blur/IME termination Browser-confirmed end/blur finalizes once with dedupe; terminal expiry/logout/revoke/different actor clears protected state immediately, without promising final composition commit/recovery Presentation unmount and engine terminal disposal are distinct
6. Use 1000ms inclusive injected-clock typing grouping default as an engineering design choice with explicit semantic boundaries It is not an IME completion timeout or measured production threshold

## Compatibility and follow-up

No upstream source/design files are modified in this task When implementation is assigned, carry these explicit amendments into the owning repo with public API/version review Do not simultaneously claim AD-20 auto-cancel and retained invalid draft both govern the same engine-owned mode LIB-04 canonical policy and LIB-05 host acknowledgement remain separate owners

No new autosave, browser sensitive persistence, live Entra settings, format migration, source/profile expansion, publication or deployment approved by this record The selection is made by the design agent under the user instruction to design; it is not attributed to an explicit user confirmation of every technical detail
