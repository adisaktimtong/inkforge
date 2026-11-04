---
title: 'Basic React editor toolbar'
type: 'feature'
created: '2026-11-04'
status: 'done'
route: 'full'
baseline_commit: '66423a0faf2deb564c82334fdee9074adf9581ac'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The React editor can edit and sanitize HTML but business users cannot discover or apply basic formatting through UI.

**Approach:** Add an optional compact English toolbar to `InkForgeEditor`: Bold, Italic, Underline; Paragraph and Heading1–3; Bulleted list and Numbered list. Enable it in the working demos. Existing consumers can keep the bare editable surface.

## Boundaries & Constraints

**Always:** Preserve selected text when mouse, touch or keyboard users operate controls; keep commands local to their editor; emit sanitized HTML through the existing controlled/uncontrolled contract. Preserve SSR-safe imports, client boundary, React18.2–19 support, ref and native attributes on the editable div. Use accessible labels, visible focus, active states and keyboard navigation. Keep disabled/readOnly/composition behavior safe.

**Never:** Add dependencies, pagebuilder integration, links/media dialogs, tables, custom history, full core transaction engine, publishing or remote Git operations in this increment.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Error handling |
| --- | --- | --- | --- |
| Inline formats | Select text or position caret, toggle Bold/Italic/Underline | Only selected text toggles; toggling again removes format; collapsed toggle applies to newly typed text | No error |
| Block style | Select paragraph(s), choose Paragraph/H1/H2/H3 | Supported semantic blocks change without losing inline content | No error |
| Lists | Select supported blocks, apply/remove/change bullet or numbered list | Correct list semantics; text, marks and links preserved through sanitize/blur/export/import | No error |
| Focus | Pointer activation or keyboard Tab/arrows/Enter/Space | Selection remains/restores; controls expose meaningful state; formatting affects intended range | No error |
| Isolation | Two editors, external replacement, selection outside editor | Never mutate another editor or page; stale selection is safely invalidated/remapped | Ignore unsafe/stale range |
| Locked/composing | Disabled, readOnly, active composition | Commands unavailable and cannot change content; normal behavior returns after unlock/commit | No error |
| No toolbar/SSR | `toolbar` omitted/false or server rendering | Existing bare div/ref preserved; optional toolbar renders/imports without DOM globals | No error |

</frozen-after-approval>

## Code Map

- `packages/editor-react/src/index.ts` -- current native DOM-owned MVP, `commit` sanitization, semantic selection offsets in `replaceHtml`, composition/blur hooks. Add `toolbar?: boolean` defaultfalse; preserve bare-div behavior and forwarded ref. Extract internal helpers if needed; no new public command API.
- `packages/editor-react/src/editor.css` -- scoped opt-in editor CSS. Add compact toolbar with theme-friendly custom properties, separated groups, ~32px controls, active/disabled/focus states and wrapping. Keep native attributes/className on editor.
- `packages/editor-html/src/index.ts` -- `blocks` currently calls itself per LI inline child, losing bold/link semantics. Group contiguous inline siblings into one paragraph while retaining block children, nested lists, presentation and diagnostics. Reuse same parser/serializer, no second sanitizer.
- `apps/react-playground/src/main.tsx` -- enable toolbar for controlled/uncontrolled examples; keep existing fixtures and change/diagnostic counts. Multiple independent toolbar editors can exercise isolation.
- `apps/next-demo/app/editor/editor-demo.tsx` -- enable optional toolbar in actual Next route; preserve public content-only route.
- `tests/browser/playwright.config.ts` -- real apps on4173/4174, Chromium/Firefox/WebKit. Existing93cases guard typing/paste/caret/composition/SSR. Add focused `toolbar.spec.ts`; don't weaken previous assertions.
- `tests/contracts/editor-react.test.mjs`, `editor-html.test.mjs`, `scripts/check-packed-packages.mjs` -- built-dist SSR contracts, shared-parser cases, packed React18/19 consumers.

## Tasks & Acceptance

- [x] `packages/editor-react/src/index.ts` and private helper modules -- optional toolbar; guarded formatting bridge, selection/bookmark ownership, active state updates and accessible keyboard behavior. Native browser commands may be used privately for this existing DOM-owned MVP; do not misrepresent as completed core engine. Sanitize emitted content without losing caret or typed-format state. Reuse existing commit path and deduplicate native input/command emissions.
- [x] `packages/editor-react/src/editor.css` -- compact consistent UI, icons via inline SVG or familiar typographic symbols, accessible English button names, focus/pressed/disabled states.
- [x] `packages/editor-html/src/index.ts`, `tests/contracts/editor-html.test.mjs` -- preserve inline runs/marks/links inside list items and mixed inline/block flow; add roundtrip fixtures including nested lists.
- [x] `apps/react-playground/src/main.tsx`, `apps/next-demo/app/editor/editor-demo.tsx` -- enable toolbar demos without disrupting existing test fixtures.
- [x] `tests/browser/toolbar.spec.ts`, existing SSR contracts/packed smoke -- cover every matrix row, pointer and real keyboard formatting, toggle on/off, each heading, both lists including marks/links and multiple selected blocks, collapsed typing, command guards, two editors, external replacement, and form button safety. Run on all three browsers.
- [x] `README.md`, `.changeset/*` -- document toolbar prop/actions/keyboard behavior and private native-command/browser limits; release notes for React feature and HTML fix.

**Acceptance Criteria:**
- Given selected content, when formatting via pointer or keyboard, then intended content changes and the same sanitized output reaches the host, with correct subsequent typing position.
- Given toolbar absent or disabled/readOnly/composing state, when rendering or operating editor, then legacy editing/accessibility/SSR contracts remain valid and locked content stays unchanged.
- Given list conversion with marked/link text, when exported and reloaded, then text/marks/links and list semantics survive.

## Implementation Notes

- User explicitly requested implementation of basic toolbar; proceed within this cohesive feature without asking again for permission. Previous story's no-toolbar boundary applies to that completed MVP increment only.
- This remains a native HTML adapter foundation. Native editing command bridge is isolated/private and checked on three engines; architecture's future command/transaction system is separate.
- Toolchain `PATH="/tmp/inkforge-pnpm-bin:$PATH" pnpm ...`; shim executes installed `/Users/adisak.t/.cache/node/corepack/v1/pnpm/12.4.2/pnpm-native` to avoid broken Corepack/ENOEXEC launcher. Recreate executable shim if missing; don't alter pins. Playground previously owned exec48928 has been stopped for tests. Root owns workflow; implementation agent must not activate nested workflows or spawn reviewers.

- Delivered nine compact English actions via optional `toolbar`: Bold, Italic, Underline, Paragraph, Heading1–3, Bulleted and Numbered lists. Stable keyed Fragment keeps the editable node, native attributes, ref, DOM edits and selections across dynamic toolbar toggles; absent toolbar retains bare-div markup.
- Private inline commands preserve native pending typing marks; supported block/list transformations use selection markers and DOM helpers for consistent boundaries across engines. Pressed heading state derives from selected semantic blocks. Command completion uses existing sanitizer once and guards readOnly/disabled/live composition; owned bookmarks, external-remap boundary snapshots and keyboard focus handoff prevent cross-editor/stale selection use.
- Shared HTML parser now groups inline list content without losing marks/links/spaces, closes innermost matching tags, preserves explicit block presentation/nested lists, and ignores converted-empty inline nodes without introducing empty paragraphs.
- Root audit: all matrix rows have passing tests: inline selected/collapsed on/off, every heading and Paragraph, bullet/numbered roundtrip/type/removal including mixed/nested/partial cases, real keyboard navigation, pointer/synthetic touch/form safety, isolation/external/ref-created/cleared ranges, locked/composition guards, toolbar on/off/ref persistence, SSR and real Next hydration. No test skips. Synthetic touch/composition fixtures do not constitute OS/device IME/touch acceptance.
- Final root `PATH="/tmp/inkforge-pnpm-bin:$PATH" pnpm validate` exited0: lint, formatting, typecheck, all builds (including Next editor/public routes), Node24contracts, Chromium65cases, publint, Are-the-Types-Wrong and packed React18.2/default19 imports/render all passed. Log `/tmp/inkforge-toolbar-final-validate.log`; expected rejected private/deep imports print errors within successful checks.
- Final root `pnpm test:browser` exited0:195/195cases,65each on Chromium/Firefox/WebKit, including93legacy and102toolbar cases. Log `/tmp/inkforge-toolbar-final-browsers.log`. Git whitespace check passed. Visual preview inspected at `/tmp/inkforge-toolbar-preview.png`; Playground reopened on4173 (exec65880).
- Review outcome: all eleven local corrections and their regressions passed. One medium history limitation is explicitly documented in README and recorded in deferred-work: heading/paragraph/list DOM transformations do not participate in native undo/redo. Full transactional history and manual OS Thai IME remain outside this increment. No new dependencies or remote operations.

## Spec Change Log

## Review Triage Log

Review pass1: high1, medium10, low1, false0, maybe-false0. All twelve findings are individually recorded; duplicate mixed-heading findings share one correction.

| Finding | Verdict | Route | Evidence/action |
| --- | --- | --- | --- |
| Verification: heading/list pressed states untested | medium | patch | Tests assert aria-pressed only for inline actions. Add state and selection-movement assertions for all block/list actions. |
| Edge: toolbar prop toggles lose edits | high | patch | Conditional wrapper replaces editable surface, initialized from frozen initial HTML while committed ref still tracks edits; preserve live content/selection across mode changes. |
| Edge: forwarded ref stale after toolbar toggle | medium | patch | useImperativeHandle has empty deps while surface node changes; rebind ref and test focus on actual editable node. |
| Edge: mixed paragraph/direct-LI heading partial | medium | patch | formatBlocks processes P/H/DIV only and returns handled once paragraph converted, skipping selected LI inline runs. Include supported list text. |
| Blind: block/list commands absent from native undo | medium | defer | Confirmed direct DOM formatting cannot undo through native history. Full custom history/core transactions are explicitly excluded in this MVP increment and prior adapter already has this limitation for normalization/paste; record for future engine work and document block/list behavior precisely. No undo button is offered. |
| Blind: mixed paragraph/list heading partial | medium | patch | Same demonstrated formatBlocks omission as edge row; test both selected blocks and untouched list siblings. |
| Blind: merging only one following list | medium | patch | Single if merges A+B but leaves C adjacent; loop through full compatible contiguous run. |
| Blind: empty inline results produce blank paragraphs | low | patch | flush tests raw nodes, not converted inline children; ignore unknown/unsupported empty inline nodes without inserting visible blank blocks. |
| Blind: marker comments create blank paragraphs on list removal | medium | patch | removeList wraps marker comments around existing P in fresh paragraphs; markers must travel without materializing empty blocks. |
| Blind: item presentation lost when promoting child blocks | medium | patch | Existing P/H promoted directly without inheriting LI class/style; merge applicable presentation while retaining child overrides. |
| Blind: external replacement blocks programmatic fresh focus | medium | patch | invalidated clears only pointer/key events, not valid fresh focus/selection; re-enable on owned fresh focus safely while rejecting stale external remap. |
| Blind: no-range selection retains old bookmark | medium | patch | refresh returns before clearing bookmark when rangeCount0; clear bookmark/pressed/pending marks and ensure command cannot use stale selection. |


## Verification

Run sequentially; build before contracts. `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:browser` (all3engines), `pnpm check:packages` must pass. Stop owned demo servers before browser suite; root reopens Playground after completion. Native OS Thai IME remains a manual release check.
