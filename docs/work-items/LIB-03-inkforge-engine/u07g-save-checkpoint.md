---
document_id: IF-U07G-SAVE-CHECKPOINT
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-05-nested-editor/U07-G
usage: currentImplementationDecision
related_stages: [Design, Test]
---

# U07-G — Staged exact child Save acknowledgment

The continuing implementation assignment adds `StagedFieldDelivery.acknowledgeSavedCheckpoint()`. It accepts only its actual issued child checkpoint after a successful correlated field delivery, with the original owner/binding context, same child session and live controller. It uses the current dispatch token to acknowledge the older captured baseline; later C is preserved and remains dirty. A completed acknowledgment can be retried idempotently while the same context remains live. Rejected delivery, canceled/released checkpoints, stale owner/session and reentrant controller scopes reject. Neither field acceptance nor Preview calls it automatically.

The CMS owner verifies the exact scoped operation receipt before calling this method. The library does not implement HTTP, durable receipts, authorization or a global Saved transaction across other editor instances. Parent and child acknowledgments are sequential, so an interrupted coordinator must retain its known server result and report local acknowledgment blocked. The callback carries no new wire/persisted field or alternate content format.

Terminal binding disposal now retries controller disposal once in a microtask if its first attempt is rejected by a synchronous controller lock. This covers revocation from the controller's own Save acknowledgment observer. Borrowed React surface unmount still does not dispose the retained binding/controller. The focused regression first failed with a live protected child after terminal cleanup and passes after the fix.

[Actual owner record](../../../contracts/u07g-save-checkpoint-evidence.json) links the [CMS-owned packed/native evidence](../../../../enterpises_cms/docs/work-items/LIB-05-nested-editor/u07g-evidence.md). Native scripted transport acceptance is distinct from live Go/backend security acceptance; full Inkforge acceptance and OS IME/AT/browser/release gates remain separate. Earlier evidence remains historical at its original source/artifact identity.
