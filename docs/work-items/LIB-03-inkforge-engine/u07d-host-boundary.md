---
document_id: IF-U07D-HOST-BOUNDARY
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-D
usage: currentImplementationDecision
related_stages: [Design, Test]
---

# U07-D — Exact public host boundary

The user's continuing implementation assignment includes this next dependency after [U07-C](u07c-native-surface.md). Preserve existing prototypes, persisted cms.richText v1 and blocks/runs, historical evidence, published pins and release boundaries.

## Intent and specification

Deliver a public canonical engine/model codec with the existing CMS content profile; unsupported model presentation fails instead of being silently stripped. Bind the borrowed controller to a PublicHostFieldPort using exact request/binding/epoch/child/profile/parent/HTML witnesses. Child edits remain dirty with respect to server persistence after field acknowledgment. Echo preserves local session/selection/history and cannot overwrite a newer local revision. External parent replacement is explicit and must reject an unresolved local candidate/composition until the host/user chooses a resolution.

Inkforge remains independent of Page Builder. A generic standalone host uses its own value generation. The Page Builder owner supplies a separate public binding adapter over its actual public Core, synchronously checking the original sequence and host fence before one atomic html/contentProfile transaction. Neither core imports the other editor or CMS. Host authorization/context is represented by an original opaque fence supplied by the CMS; metadata is never authorization.

## Implementation plan

1. Add an environment-neutral model-to-profile witness and strict browser/server decoder adapter; do not silently repair noncanonical parent values.
2. Add an optional public host entry with a controller binding, serial delivery, bounded request/echo ledgers, explicit detach/dispose and synchronous prepare/recheck.
3. Add a standalone host port and an independent Page Builder public port; preserve legacy callbacks and default editor behavior.
4. Exercise real packed artifacts in Node/Next/Chromium, including delayed/forged/stale acknowledgment, newer drafts, echo/history, native composition and invalid DOM barriers, independent standalone and Page Builder mutation/history.
5. Record exact source/artifact identities and limits. Server receipt/all-field CMS Save coordination, manual OS IME/AT, complete renderer/content-policy/browser/release qualification remain separate gates unless actually delivered and verified.

## Decisions within the authorized design

Public entries are additive: editor-html/engine, editor-react/host and Page Builder editor/field-binding. No engineBinding shortcut is installed on the legacy HTML component. Host binding lifetime is independent of React surface lifetime. Surface preparation is supplied explicitly, including retained unmounted draft status; inability to inspect the surface blocks preparation rather than trusting the model checkpoint alone. Successful field acknowledgments do not call acknowledgeCheckpoint. Delivery is explicit/serial and never retries a rejected/stale edit automatically.

No package publication, commit/push, deployment, Go framework selection or live Tenant/Domain/Azure configuration is included.
## Exact original-context amendment

The public implemented host port adds `isContextCurrent(originalReference)`. isFenceCurrent checks the original parent sequence before mutation; the separate original-context check excludes that expected sequence advance and is required again after awaiting the ack. Both standalone and Builder ports bind the same original opaque reference to owner/auth/binding state. This additive actual API refines the earlier proposed declaration; it does not enable engineBinding on the legacy component.

[Actual evidence](u07d-evidence.md) records field-level acceptance. Echo/request ledgers are finite; an expired ticket blocks without restamping. Host-assigned fieldBindingId/epoch must not be reused for a new binding. Disposal blocks model/DOM/result revival, without claiming secure zeroization of strings already retained by external callers or in-flight promises.
