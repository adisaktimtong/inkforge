---
document_id: IF-U07E-PARENT-OBSERVATION
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-05-field-binding/U07-E
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# U07-E — Preserve child history across an unrelated parent observation

Intent: the actual Builder Inspector can hide a field with a local candidate, deliver another field and return to the original editor. Parent session/sequence changes must invalidate old operation tickets without forcing a reload/discard of an otherwise unchanged field.

The public host binding now observes a non-echo parent value only when binding/profile/context and parent lineage match and the field HTML is still exactly its last accepted witness. It advances the baseline observation without an engine command, selection change, history reset or accepting a local candidate. The original pending request/base and previously issued preparation/fence remain immutable and stale. Pending requests are not advanced; after their exact ack the unchanged field can be observed for a new explicit delivery. Different HTML/profile/context still requires review and explicit external acceptance.

Verification: HP01 uses the physically installed public codec/controller/standalone port to prove unchanged child snapshot/history, invalid old preparation and successful fresh delivery. BE02 uses the actual packed Page Builder Inspector with two real field ports/controllers. [Owner evidence](../../../contracts/u07e-retained-host-evidence.json) and [combined registry cohort](../../../../pagebuilder/contracts/u07e-inspector-registry-evidence.json) identify exact sources/packages and preceding U07-A/C/D regression results.

The generic all-field registry/Save/receipt/auth continuation protocols remain separate. This change does not enable legacy engineBinding, automatic retries, server autosave or a full CMS runtime certificate. Historical U07-D evidence remains immutable at its earlier source identity.
