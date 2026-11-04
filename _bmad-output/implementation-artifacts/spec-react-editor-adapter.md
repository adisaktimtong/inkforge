---
title: 'React editor adapter MVP'
type: 'feature'
created: '2026-09-17'
status: 'done'
baseline_commit: '7b2c56fde53b82f79eaf7c5e0bf8578cb41aae17'
route: 'full'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Consumers can parse and serialize article content but have no React component to edit it in CMS forms.

**Approach:** Add a small React adapter that renders a semantic contentEditable surface, accepts initial HTML, exposes controlled and uncontrolled usage, and emits sanitized HTML changes through a stable callback.

## Boundaries & Constraints

**Always:** Work in React 18+ and Next.js client components; use `@inkforge/editor-html` for the HTML boundary; avoid browser globals during module import; preserve sanitized content; expose accessible labeling and focus behavior.

**Never:** Add toolbar, modal/plugin APIs, image upload, collaboration, or persistence in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Uncontrolled | `defaultValue` HTML | Editor initializes once and emits changes | No error |
| Controlled | `value` HTML | DOM follows prop; edits call `onChange` | No error |
| Unsafe value | HTML with scripts/unsafe URLs | Sanitized HTML rendered and emitted | Diagnostics remain available via callback |
| Empty value | empty or undefined value | Empty editable surface | No error |
| SSR import | imported in Next.js server module graph | Module import does not access `window`/`document` | No error |

</frozen-after-approval>

## Code Map

- `packages/editor-react/src/index.ts`, `src/editor.css`, `tsdown.config.ts` -- empty React adapter; add `InkForgeEditor`, exported props, client boundary retained in built output, opt-in editor UI CSS. React peers stay `>=18.2 <20`.
- `packages/editor-html/src/index.ts` -- reuse pure `parseHtml(html)` returning `{ document, diagnostics: HtmlDiagnostic[] }` and `serializeHtml(document)`; never introduce a second sanitizer. It already supports paragraphs, headings, marks, links, lists and hard breaks. Core constructors and the serializer are available, but no transaction engine exists yet.
- `packages/editor-react/package.json`, `pnpm-lock.yaml` -- declare HTML runtime dependency; externalize public packages; never leak private internal adapters.
- `apps/react-playground/src/main.tsx`, optional local stylesheet -- replace scaffold with accessible controlled/uncontrolled examples, emitted HTML and diagnostics; import opt-in editor CSS.
- `apps/next-demo/app/page.tsx` -- preserve public content-only route. Add `app/editor/page.tsx` and client component for actual SSR/hydration integration; update demo manifest/lock dependencies.
- `tests/contracts/editor-html.test.mjs` -- existing built-dist Node contract pattern; add `editor-react.test.mjs` using React server rendering and exported types/contracts.
- `tests/browser/playwright.config.ts`, `workspace.spec.ts` -- currently no server. Add actual Playground/Next harness and browser editor tests. Keep existing browser projects Chromium, Firefox, WebKit.
- `scripts/check-packed-packages.mjs` -- packed consumers must resolve public dependencies without workspace-only internals. Existing workspace contract tests pin React peer ranges and package exports; preserve them.

## Tasks & Acceptance

**Execution:**
- [x] `packages/editor-react/src/index.ts`, `src/editor.css`, `tsdown.config.ts` -- implement accessible `InkForgeEditor` and exported props with controlled `value`, one-time uncontrolled `defaultValue`, sanitized HTML `onChange`, diagnostics callback, disabled/read-only states, native attributes and focus/ref support. Keep DOM owned by browser during typing; do not reset selection on ordinary controlled echoes or rerenders; normalize at safe boundaries and preserve selection when DOM replacement is necessary.
- [x] `packages/editor-react/package.json`, `pnpm-lock.yaml` -- add HTML dependency while preserving package identity and peer/exports contracts. Package output must retain client boundary and remain safe to import without DOM globals.
- [x] `apps/react-playground/src/main.tsx`, demo CSS -- provide working controlled/uncontrolled examples and external reset with emitted HTML/diagnostics visible.
- [x] `apps/next-demo/app/editor/*`, `apps/next-demo/package.json`, lock -- demonstrate a genuine Next.js client editor route; preserve public content route.
- [x] `tests/contracts/editor-react.test.mjs`, `tests/browser/*` -- cover every matrix row plus caret stability across typing/parent rerenders, external value replacement, composition deferral including blur finalization, keyboard focus/accessibility, formatted paste sanitization before DOM insertion, empty input, and disabled/read-only behavior. Browser tests run against real applications.
- [x] `README.md` and changeset -- document install/use, props, CSS and MVP limits; add a release note for the public feature.

**Acceptance Criteria:**
- Given editable initial HTML, when a user types, then sanitized HTML reaches `onChange` without jumping the caret; during composition no DOM normalization interrupts input and the committed value emits once.
- Given controlled `value`, when the host supplies a new value or resets after editing, then the sanitized value appears; unchanged value echoes and unrelated rerenders preserve selection. Changing `defaultValue` after mount does not reset an uncontrolled editor.
- Given unsafe input or clipboard HTML, when accepted, then executable markup never reaches the editable subtree or callback; diagnostics remain available.
- Given an accessible label, when keyboard users Tab into the editor, then it exposes a multiline textbox, visible focus, and read-only/disabled semantics.
- Given a Next.js build and packed consumer, when importing the package or opening the client route, then SSR import/build and hydration succeed without DOM-global errors or private runtime dependencies.

## Implementation Notes

- User authorized this existing draft with “ทำเลย” on 2026-11-04 after viewing the pending-work summary and spec link. Scope remains the frozen MVP; investigation details complete implementation/testing only. Existing untracked draft is the selected work, not unrelated dirty work.
- This is a small native contentEditable HTML adapter foundation, not completion of the architecture spine's future command/transaction/selection/history engine. No toolbar, plugin framework or pagebuilder integration in this increment; preserve current core/HTML contracts.
- Local main is behind cached origin/main by two release/version commits. Work from the recorded local baseline; no pull/push/remote operations.
- Toolchain: `PATH="/Users/adisak.t/.cache/node/corepack/v1/pnpm/12.4.2:$PATH" pnpm ...` uses the installed native pnpm 12.4.2 launcher (the default Corepack shim incorrectly expects pnpm.cjs). Do not change pinned dependency versions to fix the shim.

- Delivered `InkForgeEditor` with SSR-safe/client-boundary export, accessible native attributes and div ref, controlled reconciliation even without host updates, one-time uncontrolled default, composition deferral/blur finalization, shared sanitization, safe paste and blocked drops. Demos show host-owned controls and HTML output.
- Review patches preserve selection using semantic UTF-16/text/block/break offsets, merge cross-paragraph/list paste boundaries and retain suffixes, avoid empty insertion/split artifacts, reset deletion sentinels on external values, and report diagnostics once with immediate-echo handling. Shared HTML wrapper parsing now preserves supported nested blocks; public types remain unchanged.
- Final root verification (2026-11-04): `PATH="/tmp/inkforge-pnpm-bin:$PATH" pnpm validate` exited 0. Lint, formatting, typecheck, 21 Node contracts, all workspace/demo builds, Chromium31, publint, Are-the-Types-Wrong and packed installs/SSR render all passed. Packed React18.2 smoke explicitly asserts React and ReactDOM18.2 versions; standard demo consumers use React19.
- Final root `pnpm test:browser` exited 0: 93/93 cases, 31 each on Chromium/Firefox/WebKit. Logs: `/tmp/inkforge-react-final-validate.log`, `/tmp/inkforge-react-final-browsers.log`. Expected rejected private/deep imports print errors inside successful packed checks.
- Matrix audit: uncontrolled covered by external/reset/defaultValue test; controlled by echo/replacement/rejection tests; unsafe HTML by SSR contract and external/paste DOM assertions; empty by SSR and keyboard/empty browser test; SSR by DOM-free import/static render and real Next hydration tests. All ran and passed. Review regressions cover all16 findings; none deferred. OS Thai IME remains a manual release checklist, not verified by synthetic composition events.
- `/tmp/inkforge-pnpm-bin/pnpm` is a temporary executable shim to the installed pinned12.4.2 native binary for child-process package checks; repository dependency pins are unchanged.

## Spec Change Log

## Review Triage Log

Review pass 1: high 2, medium 12, low 2, false 0, maybe-false 0 (16 findings; blind arithmetic is not a finding). All are local patches without a public API change. Duplicate observations retain individual rows.

| Finding | Verdict | Route | Evidence / action |
| --- | --- | --- | --- |
| Verification: drop cancellation untested | medium | patch | Handler always prevents drop but no browser test invokes it; add cancellation/content/emission assertion. |
| Verification: backward/noncollapsed selection untested | medium | patch | Existing selection tests set identical endpoints only; assert backward range and replacement typing. |
| Edge: paste spanning list items drops text | high | patch | Range leaves text directly under UL; serializer only reads LI children. Merge selected boundaries before insertion and add regression. |
| Edge: empty sanitized clipboard deletes selection | medium | patch | No guard follows sanitization; empty fragment still deletes and splits selected content. Return before mutation. |
| Edge: parent child-index bookmark after text merging | medium | patch | Same parent path is retained even when inline nodes coalesce, so child index points after different content; restore semantic text/break offset. |
| Edge: browserEmpty survives external value | medium | patch | External replacement updates committed HTML without resetting empty-sentinel state. Reset at authoritative replacements. |
| Edge claim: caret after plain paste before native B | medium | patch | Same bookmark root cause as prior edge row; regression must type immediately after paste. |
| Blind: paste spanning paragraphs does not join | high | patch | Inline insertion uses Range without merging surviving paragraph boundaries; merge and preserve suffix. |
| Blind: caret outside final pasted block | medium | patch | setStartAfter(last) leaves root-level caret for block paste; position at editable end inside final block. |
| Blind: gratuitous empty split boundary blocks | low | patch | Clone inserted even with no suffix; omit empty boundary clones. |
| Blind: fallback ignores hard breaks | medium | patch | Range.toString and text walker treat BR as zero width, collapsing before/after positions when wrappers change; count breaks in bookmarks. |
| Blind: stale browserEmpty flag | medium | patch | Duplicate edge row; clear on external replacement including deferred composition updates. |
| Blind: historical echo suppresses diagnostics | medium | patch | lastEmitted is retained forever; a later clean external value equal to a prior emission skips diagnostics clearing. Consume immediate echo once. |
| Blind: duplicate mount diagnostics | low | patch | Initial effect and controlled effect both notify on mount; emit once for mounted initial value. |
| Blind: React 18 compatibility not exercised | medium | patch | All demos use React19 despite advertised18.2 peer minimum; add packed consumer18.2 runtime render check. |
| Blind: wrapped clipboard paragraphs flatten | medium | patch | Existing shared parser treats DIV children as inline, newly exposed by real clipboard editing. Preserve supported child blocks via shared parser without adding a parallel sanitizer; regression and HTML changeset. |


## Verification

Run sequentially with the pnpm PATH above; contract tests consume built dist, so build first.
- `pnpm install --frozen-lockfile` after manifest/lock update; expected reproducible workspace.
- `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` -- expected all pass, including demos and SSR contracts.
- `pnpm test:browser` -- exercise actual editing/controlled/uncontrolled/sanitization/composition behavior on Chromium, Firefox and WebKit; synthetic composition does not replace the existing manual OS Thai IME release checklist.
- `pnpm check:packages` -- expected exports, types and packed-consumer validation pass.
