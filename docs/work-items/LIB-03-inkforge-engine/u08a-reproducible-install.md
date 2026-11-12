---
document_id: IF-U08A-REPRODUCIBLE-INSTALL
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U08-A
usage: currentImplementationDecision
related_stages: [Design, Test]
---

# U08-A — Reproducible private build input and frozen owner install

Continuation of the authorized library-first implementation and periodic source push. U07-I runtime tests passed, but a fresh owner checkout failed `pnpm install --frozen-lockfile`: the React manifest's optional Common UI peer was absent from the lockfile. A normal refresh attempted a registry lookup and received 404. Disabling automatic peer install did not resolve the optional-peer metadata requirement. No private registry or package release is assumed.

Add a development dependency on a stable repository-relative ignored tarball input. Keep the existing optional public peer and exports unchanged. The [input manifest](../../../contracts/private-build-inputs.json) pins the already exercised UI package bytes, integrity and owner source commit. Preparation either validates an explicitly supplied tarball or exports that exact Git source commit into a scratch directory, runs the owner's npm-ci/build/pack and validates the resulting tarball before atomic staging. It never checks out/resets the user's sibling repository or commits a binary. Missing/corrupt inputs fail before modifying the destination. Generated owner lockfile entries use the same portable relative input and exact integrity, with no session-only overrides.

Align the two owner examples and React package's development peers with React/React DOM 19.3.1, which Common UI already requires and the A–I native cohort exercised. Existing public React peer ranges and persisted formats remain unchanged. Preserve all unrelated locked package versions/resolutions; inspect semantic lock differences rather than a formatting-only line count.

Full shared-UI build tooling uses Node 24, as the UI owner's declared engine requires. This does not change the pure editor package's Node 22 support contract or certify its compatibility. CI source-input preparation uses the pinned sibling checkout and existing checkout credentials; private-repository access and actual GitHub job execution remain external verification gates. Publish/release approval environments remain intact; this change authorizes no registry release or deployment.

Acceptance: verify missing/tampered inputs, atomic retention, source-export build and idempotent staging; frozen install from a source-only export with the pinned input, repeated offline frozen install without lock/manifests changing, actual package build and packed consumer regressions. Record actual toolchain/source/integrity/outcomes separately from full repository lint/release/manual acceptance. Prior A–I evidence remains immutable; CMS keeps integration references and separate source-publication receipts.

## Root contract runner reconciliation

The first clean build exposed two integration fixtures using public package imports (and Builder) that the root workspace never installed. They belong to the existing actual packed E/D consumer pipeline, not a root-source alias. The root contract dispatcher now explicitly classifies eight owner files and those two integration files, rejects an unclassified new fixture, and advertises `pnpm test:integration` for the complete existing Builder-led A–E packed pipeline. The fresh CMS A–I cohort also executes those integration cases; they are not treated as passed by owner-only tests. The legacy release export whitelist is updated for the already delivered public engine/host/common-ui entries, while deep/wildcard entries remain rejected.

CI builds the pinned UI input before frozen install on Node 24. The earlier Node 22 full shared-UI matrix did not satisfy the UI package's declared engine; it is not retained as an implied qualified cohort. Pure-package Node 22 compatibility remains an open independent gate. Existing release approval conditions remain unchanged.

## CI removal — 2026-11-12

The user's explicit request to remove CI supersedes the automatic validation policy on the current work branch. Remove `.github/workflows/ci.yml`, covering its push/pull-request validation and manual release-candidate job. Retain the release-PR/manual publish workflows and their existing approval controls, plus local install/test/build scripts and the pinned private input. Removal does not supply a successful CI result or erase historical failures. Other branches retain their own workflow files until the change reaches them.

Verification for this configuration change checks that the removed path is absent, retained release/publish/helper files and dependency/lock/evidence inputs remain byte-identical, remaining workflow YAML parses, and the existing workspace/release contract tests pass. Application runtime and packed-browser acceptance are not re-certified by workflow removal.
