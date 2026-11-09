---
document_id: IF-U07F-STAGED-CAPTURE
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-05-nested-editor/U07-F
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# U07-F — Staged field capture and synchronous read barriers

The current continuation adds public EngineController.withReadBarrier: a strictly synchronous callback over its immutable snapshot. Reentrant engine mutation and Promise/thenable callbacks reject. A terminal dispose requested during that scope is drained when the scope exits, before returning a successful capture. No read barrier spans an await. No model IDs, persisted schema or history owner changes.

EngineFieldBinding.stagePreparedField consumes its actual issued preparation, allocates an exact bounded child checkpoint and stages the original correlated edit. Its public stage checks the original parent/fence before mutation, holds the engine read barrier with the original owner/context fence across the expected parent sequence advance, settles the exact terminal ack and explicitly cancels/releases checkpoint resources. Shared synchronous settlement preserves the prior async flush behavior. Neither field acceptance nor local capture acknowledges Saved.

The native surface getStatus synchronously consumes queued unmanaged MutationObserver records and quarantines the draft before qualifying a capture. This closes the same-task observation gap without parsing native HTML into model authority. Hidden composing/invalid fields remain blockers.

[Owner evidence](../../../contracts/u07f-staged-capture-evidence.json) points to [actual CMS-owned six-package tests](../../../../enterpises_cms/docs/work-items/LIB-05-nested-editor/u07f-evidence.md). They cover engine lock reentrancy/thenables/terminal disposal, staged capacity/exact checkpoint/late edits and real native queued mutation/IME/Inspector/development behavior. Pure-controller and earlier host/native cohorts are rerun against the same library artifacts. Server receipts, auto-delivery, extended commands/profile/OS IME/AT/release and full CMS acceptance remain separate.
