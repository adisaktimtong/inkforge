---
document_id: IF-U07I-TERMINATION
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-I
usage: currentImplementationDecision
related_stages: [Design, Test]
---

# U07-I — Explicit termination readiness

CMS owns the Save / Discard / Cancel decision and the original navigation intent; Inkforge provides only a public nonmutating `EngineController.checkTermination(context)` readiness probe. It validates an issued current token, authorization/context callbacks and controller reentrancy through the same synchronous dispatcher/final-fence path. It returns noChange when ready. It permits active composition because an explicitly confirmed terminal discard must not force a composition commit. It neither disposes the engine nor acknowledges Saved nor changes the document, selection, history or staged checkpoints.

Existing `withReadBarrier` and all-field Save capture continue to reject active composition. The caller must still validate the complete original owner, retained membership, active/unresolved Save and parent dispatch before terminal cleanup. A successful per-engine readiness probe alone is not permission to discard, a held discard ticket or a navigation API. The CMS command checks again immediately before cleanup; unknown writes remain retained.

The [CMS decision](../../../../enterpises_cms/docs/work-items/LIB-05-nested-editor/u07i-exit-flow.md) and its packed consumer tests exercise composing and invalid hidden drafts, stale tokens/owners, synchronous reentrancy, Cancel retention and terminal explicit discard. No persisted HTML/profile, legacy blocks/runs, host format or engine version is changed. Full engine/OS IME/browser/AT/feature and live server acceptance remain separate gates.
