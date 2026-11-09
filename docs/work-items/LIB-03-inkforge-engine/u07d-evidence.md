---
document_id: IF-U07D-EVIDENCE
artifact_type: evidence
sdlc_stage: Test
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-D
usage: scopedRuntimeEvidence
related_stages:
- Build
---

# U07-D — Exact host delivery evidence

[Implementation decision](u07d-host-boundary.md) and [machine evidence](../../../contracts/u07d-host-boundary-evidence.json) identify the uncommitted patch and exact five packed packages.

Run `node scripts/check-host-boundary.mjs` from Inkforge with sibling Page Builder/UI checkouts and the installed owner toolchain. The default run creates a fresh U07-A/C cohort and then a locked offline host consumer with React/Common UI absent. The host and codec import there, and all 20 HD01–HD20 cases pass. The same packed set builds a strict Next consumer (skipLibCheck false), rejects six actual invalid public type examples and passes eight Chromium HB01–HB08 cases. It also passes the earlier 54+2 pure-controller, 24 native-surface, two actual development replay/resource, 12 legacy Node/13 browser and 9+10 earlier public type constraints. No diagnostic reuse is promoted to acceptance.

The cases use the public controller, maintained browser/server profile adapters, actual standalone host and real Page Builder Core/field port. They cover exact and forged acknowledgments, newer child drafts, native composition, hidden idle/invalid fields, terminal cleanup, explicit Page Undo replacement, request deduplication, private preparation issuance, stale original sequence/auth and post-commit authorization loss. The persisted Builder fixture uses literal props.html/props.contentProfile, not the earlier prototype body wrapper.

The discovered post-commit auth gap is closed by `isContextCurrent(originalReference)` independently of the exact pre-commit parent-sequence check. No fresh reference is captured to make a stale acknowledgment succeed. Native input and Page Undo retain one history owner; a field ack never calls acknowledgeCheckpoint.

The first strict Next attempt exposed missing required UiProvider inputs and an incorrectly positioned expected-error directive; both were corrected before the final fresh successful cohort. Nonrepresentable style/classes/headings/nesting, null text and empty formatting that cannot round trip are rejected instead of silently dropped. No unsupported renderer policy is enabled by the codec.

This is field-delivery acceptance, not complete CMS Save/Preview or server persistence acceptance. All-field atomic residual commits/checkpoints/receipts, automatic Inspector binding registration, auth continuation/rebind orchestration, extended commands/renderer policy, native OS IME/manual AT/other browser families/performance/release/production CSP remain open. The native C development replay passes; this new host binding has no separate development replay qualification yet. Full U07 certifiedRuntime remains null. Historical U07-A/B/C evidence, original prototypes and Common UI runtime bytes are unchanged. No commit/push, registry publication or deployment was performed.
