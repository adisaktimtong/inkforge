---
document_id: LIB-03-inkforge-engine-test-plan
artifact_type: test-plan
sdlc_stage: Test
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine
usage: plannedWorkItem
---

# LIB-03 — Engine Acceptance Plan

[Registry cases](../../../contracts/inkforge-engine-contract.json#/acceptanceScenarios) are designedNotExecuted; expected results are oracles, not executed tests [Spec](spec.md) and [Decision](decision.md) define source/target distinctions

## Layers

| Layer | Designed cases | Actual evidence required |
| --- | --- | --- |
| Pure Core | model/selection/transactions/commands | Real engine reducer and public imports; immutable before/after/state tokens/history/maps; whole candidate rejection |
| Core + bridge | history | Canonical witness from actual HTML bridge, injected clock, checkpoint ordering/capacity; saved B/current C schedule |
| Browser | input/lifecycle | beforeinput/input/clipboard/selection/observer/history ownership; focus and retained safe draft behavior |
| Native IME | ime | Chromium/Firefox/WebKit in supported cohort plus actual Thai OS IME/manual evidence; synthetic schedules supplemental |
| Packed consumer | integration | Actual packed public exports/peer versions and standalone/React/Next fixtures; no private imports or public route editor runtime |

Upstream source tests are inputs, not results for new engine Existing scripts may allow zero-test success; record executed targeted cases and variants rather than exit code alone

## Position-map oracles

Use six registry vectors as independent semantic examples; do not implement a second copy of proposed mapper in validation then claim engine passed Property checks on actual engine: every mapped anchor/head legal; operation + inverse restores semantic document/selection/IDs; unrelated node identity retained; new IDs unique after undo+branch; normalization maps included; monotonic revision; snapshots immutable

Add fixtures for container boundaries/empty document/hard break, backward range across nested list, removal affinity with no surviving side, move across parents, text merge, emoji surrogate/ZWJ, combining accents and Thai word/grapheme boundaries Record provider/runtime/data fingerprint; do not claim unverified full UAX conformance

## Event and receipt schedules

Inject stale session, revision and selectionEpoch separately; duplicate request same/different payload; observer throw/reentrant dispatch; noChange after undo; divergent normalizers; byte/mapping/checkpoint budget limits Parent accepted witness must not mean server saved witness; exact ack B while current C must preserve C dirty, older/released/different-profile ack cannot roll baseline back

## IME and DOM schedules

Composition start/update with supported/noncancelable beforeinput; end before/after final input; trailing input/blur; cancellation; invalid finalized candidate; toolbar/picker focus; Save/Preview pending; external echo versus owner load; readonly/suspend and hard expiry variants One final committed transaction or explicit retained invalid draft; no forced Save blur, timer correctness, silent cancel or native+engine double undo

Synthetic tests cannot prove real OS native composition Test actual Thai IME and grapheme edits with engine-owned mode, ref.focus, backward selection, paste/cut failures and native context-menu history Record OS/IME/browser versions, videos/logs or manual checklist, exact observed failures and limitations

## Exit and scope

Per-case/variant outcomes passed/failed/blocked/notRun/manualReview; report actual source+patch/pack digest, command/CWD/runtime/log counts Zero tests or stubbed engine are not pass Public package/React/Next acceptance separate from Core and from CMS/Go/cohort gates; Source/media/plugin extras remain profile-gated

[Evidence](evidence.md) records results Static source/hash/map checks certify document integrity only, not these runtime cases
