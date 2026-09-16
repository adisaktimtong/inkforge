---
title: 'HTML boundary hardening'
type: 'feature'
created: '2026-09-16'
status: 'done'
route: 'full'
baseline_commit: '40c6c3ffad18135c45f80a0d9cfbaa0afec37bf4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The MVP HTML boundary still has compatibility and safety gaps around escaped CSS, character references, hard line breaks, and bounded input.

**Approach:** Harden the existing parser/serializer without changing the public package split: decode common/numeric HTML entities, represent `<br>` explicitly, report input truncation, and normalize CSS escapes before strict property/value filtering.

## Boundaries & Constraints

**Always:** Keep server/browser behavior deterministic; never execute scripts or unsafe CSS; preserve supported article meaning; retain bounded-memory behavior; keep existing public APIs backward compatible.

**Never:** Add images, React UI, broad HTML support, or a new sanitizer dependency in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CSS escape | escaped `url`/`expression` tokens | unsafe declaration removed | diagnostic emitted |
| Entities | named and decimal/hex references | decoded text round-trips semantically | unknown references preserved safely |
| Hard break | `<p>a<br>b</p>` | explicit break preserved in model and HTML | no error |
| Input limit | input exceeds `maxInputLength` | bounded prefix parsed | truncation diagnostic emitted |

</frozen-after-approval>

## Code Map

- `packages/editor-core/src/index.ts` -- extend inline model with a hard-break node and helper.
- `packages/editor-html/src/index.ts` -- harden entity/CSS parsing, truncation diagnostics, and `<br>` serialization.
- `tests/contracts/editor-html.test.mjs` -- add regression tests for every matrix row.

## Tasks & Acceptance

**Execution:**
- [x] `packages/editor-core/src/index.ts` -- add hard-break inline node and constructor -- preserve explicit line breaks.
- [x] `packages/editor-html/src/index.ts` -- decode entities, normalize CSS escapes, diagnose truncation, and parse/serialize breaks -- close boundary gaps without DOM requirements.
- [x] `tests/contracts/editor-html.test.mjs` -- cover all matrix scenarios and server/browser parity -- prevent regressions.

**Acceptance Criteria:**
- Given escaped dangerous CSS, when parsing, then it is removed and diagnosed.
- Given named/numeric entities, when parsing and serializing, then visible text remains equivalent.
- Given `<br>`, when parsing and serializing, then the hard break remains in the same position.
- Given an input limit, when truncation occurs, then the result includes a truncation diagnostic and parses only the bounded prefix.

## Implementation Notes

- Added `HardBreakNode`/`createHardBreak`, entity decoding for common and numeric references, escaped CSS normalization, and `INPUT_TRUNCATED` diagnostics.
- Browser and server adapters share the same hardened implementation for deterministic SSR behavior.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm lint` -- expected: success.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm typecheck` -- expected: success.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm test` -- expected: all boundary tests pass.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm build` -- expected: public packages build.
