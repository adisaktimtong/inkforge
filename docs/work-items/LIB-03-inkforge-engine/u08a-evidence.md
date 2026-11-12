---
document_id: IF-U08A-EVIDENCE
artifact_type: evidence
sdlc_stage: Test
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U08-A
usage: scopedRuntimeEvidence
related_stages: [Build]
---

# U08-A — Actual frozen-install and private build-input evidence

[Decision](u08a-reproducible-install.md), [input identity](../../../contracts/private-build-inputs.json) and [machine evidence](../../../contracts/u08a-reproducible-install-evidence.json) record exact source, commands, artifact integrity, lock delta and logs. From Inkforge, prepare the pinned input with `node scripts/prepare-ui-peer.mjs --repository ../ui-component` or an explicitly supplied accepted tarball, then run `pnpm test:frozen-install`. Source preparation uses an isolated Git export of the pinned UI commit and npm ci/build/pack; the sibling checkout and its working changes remain intact.

Passed: **eight actual preparation/retention cases**, a clean source-export frozen install, an unchanged repeated offline frozen install, matching development peers, seven package/internal build tasks and **129 owner contract cases**. The root `pnpm test` entry also passes; its Node cases are those same 129 and its workspace Vitest commands add zero cases. They are not counted twice. Full owner lint and typecheck pass; changed tooling/metadata/workflow formatting and workflow preparation ordering also pass.

The fresh six-tarball **A–I integration cohort passes**, including 28 headless exit-decision cases, 12 production Chromium cases, one actual development replay and eight invalid public type examples, plus A–H predecessors. The two public-package host fixtures execute there through the existing Builder-led packed pipeline. Root owner tests classify them explicitly and never substitute private source aliases for their public package imports. A newly unclassified contract file fails the owner dispatcher. The previously stale export whitelist now recognizes the already delivered engine/host/common-ui entries and still rejects deep/wildcard entries.

The exact Common UI tarball reproduces from its pinned Git commit and retains its historical integrity. The new development-only file input is ignored by Git and absent from public package contents. Public optional peer/export contracts and runtime source across all four repositories remain unchanged. Lock changes add the private file input and React/React DOM 19.3.1, remove the superseded 19.3.0 versions, and preserve every other existing package resolution. Final installation uses the checked-in frozen lock with no session-only override. It restores the lock's Rolldown 1.2.8; U07-I's temporary bootstrap had used 1.2.18. This new actual artifact cohort records that difference and repeats integration tests.

CI now prepares the input before all four frozen-install sites using the pinned sibling checkout and Node 24. YAML, ordering, triggers and the existing npm-production publication approval environment were checked locally. Actual GitHub jobs/private checkout access are not claimed passed. Pure-package Node 22 compatibility remains a separate open gate; the shared UI owner's engine requires Node 24. Full formatting/release/manual browser/AT certification is not inferred from setup; owner lint/typecheck and the selected formatting targets are the checks actually run. Registry publication, merge and deployment were not performed. Historical A–I evidence and published design pins remain immutable; source pushes are recorded separately in the CMS publication journal.
