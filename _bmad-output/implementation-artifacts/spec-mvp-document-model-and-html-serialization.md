---
title: 'MVP document model and HTML serialization'
type: 'feature'
created: '2026-09-16'
status: 'done'
route: 'full'
baseline_commit: 'ed1c950c673872cb116f1adb778c5928eab1e0e9'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The published packages are only scaffolds, so CMS consumers cannot yet represent editor content safely or preserve existing HTML articles.

**Approach:** Implement a small, typed document model in `editor-core` and deterministic HTML parse/serialize plus sanitization in `editor-html`. The first slice supports the semantic content needed by a CMS article and provides a stable foundation for the React editor.

## Boundaries & Constraints

**Always:** Preserve semantic structure; round-trip supported HTML deterministically; reject executable content; keep browser and server entry points environment-safe; expose typed APIs; preserve safe `class` attributes and `style` declarations only from a strict documented property allowlist; unwrap unknown/unsupported tags while retaining their safe child content.

**Never:** Add React UI, collaboration, persistence, CSS/theme rendering, or script execution; accept `<script>` or event-handler attributes; introduce private runtime dependencies into public packages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Basic article | headings, paragraphs, lists, links, emphasis, text | Stable document model and equivalent sanitized HTML | No error |
| Existing HTML | legacy HTML with class/style attributes | Supported semantics and safe presentation attributes preserved; unsafe values removed | No error |
| Unsafe markup | script, iframe, event handlers, javascript URLs, unsafe CSS values | Executable nodes/attributes and unsafe CSS omitted | Return sanitized result and diagnostics |
| Unsupported tag | custom or non-allowlisted wrapper with safe children | Wrapper removed; safe child content retained in document order | No error; emit diagnostic when useful |
| Empty content | empty string or empty document | Valid empty document and empty HTML | No error |
| Malformed HTML | unclosed/nested tags | Best-effort normalized document | Never throw for user content |

</frozen-after-approval>

## Code Map

- `packages/editor-core/src/index.ts` -- public document node types, document factory, and structural helpers; currently an empty API scaffold.
- `packages/editor-html/src/index.ts` -- environment-neutral parse/serialize contracts; must not depend on DOM globals.
- `packages/editor-html/src/browser.ts` -- browser adapter for DOM-backed parsing when available.
- `packages/editor-html/src/server.ts` -- server-safe parsing path with no `window`/`document` assumptions.
- `packages/*/package.json` -- public export boundaries and package metadata; preserve ESM-only exports.
- `tests/contracts/*.test.mjs` -- workspace-level package and release contracts; extend with serialization invariants.

## Tasks & Acceptance

**Execution:**
- [x] `packages/editor-core/src/index.ts` -- define typed block/inline nodes, document type, constructors, and traversal helpers -- establish stable engine contracts.
- [x] `packages/editor-html/src/index.ts` -- define parse/serialize options, diagnostics, and deterministic model-to-HTML serializer -- keep core independent of DOM.
- [x] `packages/editor-html/src/browser.ts` -- implement browser parsing and sanitization -- support CMS HTML input safely.
- [x] `packages/editor-html/src/server.ts` -- implement server-compatible parsing adapter -- support Next.js SSR without browser globals.
- [x] `tests/contracts/editor-html.test.mjs` -- test round-trip, malformed HTML, unsafe markup, and empty content -- lock down edge cases.
- [x] `packages/editor-core/package.json`, `packages/editor-html/package.json` -- expose the new APIs through declared exports -- keep consumer imports explicit.

**Acceptance Criteria:**
- Given supported article HTML, when parsed and serialized, then headings, paragraphs, lists, links, emphasis, and text remain semantically equivalent.
- Given unsafe tags, event attributes, or `javascript:` URLs, when content is parsed, then they are removed and diagnostics identify sanitization.
- Given a non-allowlisted tag with safe descendants, when content is parsed, then the wrapper is unwrapped and descendants remain in document order.
- Given safe `class` and allowlisted `style` attributes, when content is parsed, then they are preserved without executable CSS; non-allowlisted properties are removed and diagnosed.
- Given server execution without DOM globals, when the server adapter parses content, then it returns the same model contract without throwing.
- Given malformed or empty input, when parsing runs, then it returns a valid document result rather than throwing.
- Given a package consumer, when importing documented public subpaths, then TypeScript and Node ESM resolution succeed.

## Implementation Notes

- Implemented a deterministic tokenizer/parser shared by browser and server entry points; the browser adapter intentionally has no DOM dependency in this MVP to keep SSR parity.
- Inline and block nodes preserve sanitized `className` and strict-allowlisted `style`; unknown wrappers unwrap their children.
- Strict style properties currently include `color`, `background-color`, `text-align`, `font-size`, `font-family`, `font-weight`, `font-style`, and `text-decoration`.

## Spec Change Log

## Review Triage Log

- `medium` — `editor-html` inline presentation — verified class/style loss on mark tags; patched by preserving sanitized attributes on inline nodes.
- `medium` — `editor-html` list-item presentation — verified class/style loss on `li`; patched by adding presentation fields to list items and serializer output.
- `high` — `editor-html` direct serialization — verified unsafe model href/style bypass; patched by sanitizing URL, class, and style at serialization.
- `medium` — `editor-html` CSS filtering — literal-only dangerous-token detection leaves escaped CSS forms; deferred to a dedicated sanitizer hardening story.
- `medium` — `editor-html` entities — decoder covers only a small subset; deferred until the HTML compatibility profile is expanded.
- `medium` — `editor-html` line breaks — `<br>` has no model representation; deferred because the approved MVP content profile is text blocks without hard line-break nodes.
- `low` — `editor-html` input limit — truncation has no diagnostic; deferred as an options-contract enhancement.
- `low` — `editor-core` constructors — presentation parameters were inconsistent; patched for paragraph, heading, list, and list-item constructors.
- `medium` — `editor-html` browser export verification — import-only coverage was insufficient; patched with a browser API behavior test.
- `medium` — `editor-core` helper verification — constructors, predicates, and traversal lacked tests; patched with focused contract assertions.
- `medium` — `editor-html` unmatched/mismatched markup paths — tokenizer and unsafe-skip edge cases remain candidates for parser hardening; deferred pending compatibility fixtures.
- `low` — `editor-html` unknown marks and heading levels — serializer now skips unknown marks and clamps heading levels.
- `medium` — clean-checkout test ordering — contract tests consume built dist output; existing validation builds before running them, so standalone `pnpm test` remains a workflow limitation to address separately.

## Design Notes

The model should distinguish block nodes from inline marks so responsive presentation and toolbar commands can be layered later without rewriting stored HTML. Sanitization is part of the HTML boundary, not the core model, so consumers can use the core independently.

## Verification

**Commands:**
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm lint` -- expected: no ESLint errors.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm typecheck` -- expected: all packages typecheck.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm test` -- expected: contract and serialization tests pass.
- `PATH="/tmp/texteditor-pnpm12:$PATH" pnpm build` -- expected: public packages build with declared exports.
