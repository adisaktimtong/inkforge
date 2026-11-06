---
document_id: LIB-04-html-profile-test-plan
artifact_type: test-plan
sdlc_stage: Test
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-04-html-profile
usage: plannedWorkItem
---

# LIB-04 — Acceptance Plan

[Spec](spec.md), [Base Fixtures](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/rich-text-profile-fixtures.json) and [Extension](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/contracts/inkforge-html-fixtures.json) Oracles are not executed engine results

## Required layers / independent evidence

| Layer | Cases / oracle |
| --- | --- |
| JS pure profile/writer | All HTML-01–22 + HP-F01–36: strict verdict/canonical output/loss reason, idempotence and original retention |
| Browser/server/Go parser parity | HP-T03/04/05/11/12: normalized safe AST/diagnostics semantics and exact final writer bytes; sanitizer internal bytes may differ |
| Engine/host | HP-T07/13/15/17/18: parse→edit→undo/redo→serialize target/rel/token fidelity, stale contexts, IME barrier and saved B/current C |
| Framework-neutral Go domain | HP-T02/08/09/15: actual policy/context/ref validation and canonical no-rewrite; client digest/references not authority |
| Actual Go framework/DB | H08 + HP-T09/14: supplied framework/version/handler/context/error/transaction integration, atomic owner/references/audit/receipt |
| Renderer/CSS/consumer | HP-T01/06/10/16: packed exports, actual stylesheet/registry/theme/breakpoints and public route without editor UI runtime |

HP-T14 is a design handoff scenario: a checklist can be reviewed statically but cannot pass runtime framework integration All 18 HP-T cases and 36 new HP-F fixtures remain designedNotExecuted until actual relevant target runs

## Invariants and adversarial schedule

Treat HTML-01–22 and HP-F01–36 verdicts as prepareImport oracles. Compare Go prepareImport with JS import; for validateCanonicalSave test accepted canonical output and separately reject noncanonical raw source. Do not reuse an import accept as permission for server rewriting.

For accepted input compare verdict and normalized AST first, then final canonical writer bytes and stable reparse/serialize Preserve anchor order, hard breaks, empty blocks, NBSP/Thai/decomposed text/emoji, marks, token placement and link metadata Same textContent alone is insufficient

For rejected/unavailable: canonicalHtml null, no partial engine/parent/server write, safe original retained only while authorized, explicit diagnostics Parser/model truncation never accepted Budget boundaries independently test UTF-8 bytes/UTF-16 units/nodes/depth/attributes/output; malformed transport/lone surrogate/NUL variants need encoded-input harness, not only JSON string examples

Audit duplicate attributes before browser loses them, malformed anchor/list repair, foreign namespaces/mutation, named/numeric entities and escaped/custom URL forms Inert parsing must cause no script execution/subresource fetch; instrument actual browser requests and rendering context Synthetic parsing/regex helper not sufficient

Client policy/fingerprint/target list altered, stale auth/field/profile worker callback, terminal expiry, canonical mismatch Save, and reference-validation failure after earlier valid anchor must all leave authority/state correct Check immutable original snapshot B remains exact and newer C remains dirty; no Go rewrite/automatic merge/replay

## Evidence and exit

Record per fixture/case/variant passed/failed/blocked/notRun/manualReview with exact source+patch/package/parser/Go/framework/CSS/renderer/runtime/browser/OS/IME, command/CWD/counts/logs Native IME and actual framework tests cannot be replaced by stubs Static fixture shape/HTMLParser inspection is document validation only; no sanitizer runtime/certification

Shared Go framework still deferred per user Framework-dependent scenarios remain notRun/blocked as appropriate even if JS/pure-domain results later pass No release-ready or profile CSS readiness without actual cohort evidence
