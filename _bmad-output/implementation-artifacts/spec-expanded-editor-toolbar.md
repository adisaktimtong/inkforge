---
title: 'Modern toolbar and richer text tools'
type: 'feature'
created: '2026-11-04'
status: 'done'
route: 'full'
baseline_commit: '3372cf90ac4ed31e39a2aaf8f2cfe1dc44c8ee7f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The toolbar looks like a basic prototype and lacks common text-editing tools. User explicitly chose both visual improvement and additional tools.

**Approach:** Deliver a compact modern English toolbar with grouped consistent SVG icons, a Paragraph/Heading1–3 dropdown, tooltips, and polished active/hover/focus states. Keep existing formatting/list tools and add Strikethrough, Inline code, Link edit/remove, Left/Center/Right/Justify alignment, Text color/Highlight palettes with custom color picker/reset, and Clear formatting.

## Boundaries & Constraints

**Always:** Keep optional `toolbar` boolean, stable editable div/ref, controlled/uncontrolled HTML, SSR-safe imports and React18.2–19 compatibility. Reuse shared sanitization and owned selection/commit bridge. Tools apply only to intended text/editor, preserve unrelated text/marks/links, and respect disabled/readOnly/live composition. Popups are keyboard accessible, use meaningful labels and preserve or safely invalidate captured ranges. Compact themed UI wraps without horizontal overflow at320px; panels fit viewport.

**Never:** Add dependencies, new document node types, pagebuilder integration, media/tables, font registries, public command APIs or a history engine. Existing direct-DOM undo limitation remains documented. No remote Git operations.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Error handling |
| --- | --- | --- | --- |
| Existing basics | Marks, type dropdown and lists | Prior formatting/selection/state behavior retained | No error |
| Strike/code | Selected text or collapsed caret | Toggle mark; typed text inherits enabled mark without placeholder characters in HTML | No error |
| Alignment | Selected P/headings/LI text | Apply chosen text-align to intended semantic blocks; preserve content | No error |
| Colors | Selected/collapsed text, swatch/custom hex/reset | Text color and highlight coexist with marks/links; reset affects chosen property only | Ignore invalid color |
| Link | Selected text/existing anchor or collapsed caret | Create/edit/unlink safely; collapsed insertion uses URL as label; selected text retained | Unsafe/empty URL shows inline error without DOM mutation |
| Clear | Partial selection with inline formatting | Remove selected marks/inline styles while preserving text, block/list structure and link destinations | No error |
| Popup lifecycle | Mouse/touch/keyboard open, input, apply/cancel, Escape/outside click | Captured selection remains valid; inputs focus; no change on cancel; meaningful focus return | No error |
| Stale/locked | Other editor, external value, mode change, disabled/readOnly/composition | Popup closes or invalidates; stale apply cannot alter new/foreign content | Ignore stale operation |
| SSR/small viewport | No DOM globals or320px container | Public exports render; scoped UI and popup remain usable; bare editor unchanged | No error |

</frozen-after-approval>

## Code Map

- `packages/editor-react/src/toolbar.ts` -- existing owned-range bookmark, stale-remap snapshot, command deduplication, typing mark recovery and keyboard handoff. Extend one bridge; popup input focus must not cause `refresh()` to discard captured selection. Use private modules to keep UI and transformations manageable.
- `packages/editor-react/src/formatting.ts` -- selected-leaf/block detection and marker preservation; reuse for alignment/inline operations. Keep heading/list regressions intact.
- `packages/editor-react/src/index.ts` -- stable keyed Fragment and sanitizer/commit path; preserve surface ownership through toolbar toggles and callbacks.
- `packages/editor-react/src/editor.css` -- existing theme variables. Add neutral surface, consistent ~32px SVG controls, separators, subtle blue active state, real tooltip, polished menus/palettes/link panel, visible focus, viewport-safe wrapping. Native attributes/className remain on editor.
- `packages/editor-html/src/index.ts` -- existing strike/code, links, color/background-color/text-align support. Nested span currently overwrites child styles/classes; merge inherited presentation with child overrides and class union through same sanitizer. Native font tags lose color, so do not rely on unnormalized font output.
- `apps/react-playground/src/main.tsx`, Next `app/editor/editor-demo.tsx` -- existing demos automatically use toolbar; retain useful fixtures. No redesign of unrelated demo controls.
- `tests/browser/toolbar.spec.ts`, `workspace.spec.ts` --195 prior cases. Adapt heading/button-count assertions to real dropdown structure without weakening content/selection assertions. Add expanded-tools tests. Node contracts and packed script verify SSR and React18.2/19.

## Tasks & Acceptance

- [x] `packages/editor-react/src/toolbar.ts`, private UI/icon/operation helpers and `index.ts` as needed -- new grouped UI/tools, top-level-only roving navigation, accessible dropdown/popup focus, captured range ownership and revision invalidation; one sanitized committed edit per action. Pointer prevention must not block URL/color input focus. Safe URL must be validated through existing HTML boundary before href enters DOM.
- [x] `packages/editor-react/src/formatting.ts` and private inline helpers -- precise strike/code/color/highlight/clear/link/alignment operations across partial selections and semantic blocks; preserve unselected suffixes and collapsed typing. Clear inline formatting keeps block/list structure and link targets.
- [x] `packages/editor-react/src/editor.css` -- modern compact consistent icons/groups, themeable states, color swatches/native custom picker, link errors, keyboard-visible tooltips and panels fitting small containers. Visually inspect real screenshots before completion.
- [x] `packages/editor-html/src/index.ts`, `tests/contracts/editor-html.test.mjs` -- nested text/highlight/class/mark/link roundtrip; child style overrides inherited style without weakening unsafe CSS/URL policy.
- [x] `tests/browser/*`, SSR contracts and packed smoke -- cover each matrix row on Chromium/Firefox/WebKit, unsafe link and invalid color no-mutation, partial formatting/clear, popup keyboard/cancel/focus, combined formatting roundtrip, collapsed typing, locked/stale/multiple-editor safety and320px overflow. Keep all prior behaviors tested even when UI selectors change.
- [x] `README.md`, `.changeset/*` -- updated tools/use/keyboard/color/link behavior and explicit existing native-history limits; React feature/HTML fix release notes, no dependency pin changes.

**Acceptance Criteria:**
- Given the existing editor, when users use new tools via pointer or keyboard, then visible content and emitted sanitized HTML agree, selection remains in the intended location, and existing formatting survives unrelated operations.
- Given a popup containing inputs, when applying/canceling or invalidating its snapshot, then only a valid owned range can change, and cancel/stale actions leave document unchanged.
- Given current demo routes on wide and narrow screens, when viewing/operating toolbar, then controls have clear icons/groups/names and no clipped or overflowing menus.

## Implementation Notes

- User approved visual improvement plus added tools through async reply, then root announced the concrete tool set. Proceed with the authorized implementation; no further permission needed. Root owns bmad workflow; implementation agent must not activate nested skills/workflows or spawn reviewers.
- Existing native/DOM adapter foundation remains; no full transactional history. Reuse bridge instead of parallel mutable state.
- Toolchain `PATH="/tmp/inkforge-pnpm-bin:$PATH" pnpm ...`, pinned native12.4.2 shim. Recreate shim if absent; no dependency changes. Root stopped owned Playground exec65880 for testing.

- Root WIP visual inspection found brittle nth-child separators splitting Bold from Italic and panels positioned far from their triggers. Finish using explicit stable group boundaries, trigger-anchored viewport-clamped panels, white panel surfaces, readable headers, clear primary Apply versus secondary/remove/cancel hierarchy, URL placeholder, menu-like type rows and no duplicate tooltip while popup is expanded. Editor border should visually match toolbar while retaining visible focus. WIP screenshots at `/tmp/inkforge-expanded-toolbar-wip.png` and `/tmp/inkforge-expanded-link-wip.png`; separate root inspection server4175 was stopped.

- Delivered grouped SVG toolbar with type dropdown, strike/code, four alignments, safe link panel, text/highlight palettes/native picker/hex/reset and clear formatting. Explicit separators and white anchored panels with primary actions, viewport-clamped tooltips, wrapping and vertical popup flipping were visually inspected on desktop/320px. Bare div/ref and dynamic toolbar mode behavior remain intact.
- Reused owned editing/commit bridge. Native beforeinput has recursion guard/deduplication and preserves B/I/U when applying pending custom formats. Composition start captures owned replacement offsets; finalization applies captured inline state once to committed text on compositionend/blur, never transient composition. Popup range+HTML snapshots reject foreign/stale content; actual popup input/native-picker focus remains supported.
- Shared parser preserves safe CSS fallbacks, class/style inheritance, child overrides and same-element importance; it decodes href entities exactly once before URL validation. Link edit/unlink preserves unrelated presentation and collapsed insertion leaves caret after label. CSS contract output now retains fallback declarations instead of deduplicating them; stronger browser computed-color tests verify unchanged/desired appearance rather than merely matching an implementation string.
- Review outcome: fourteen verified corrections passed targeted regressions; one inherited-block Reset expectation was rejected because Reset removes inline overrides and inherits existing block defaults. No new work deferred; existing native-history limitation remains explicit in README/prior deferred-work. Real OS Thai IME and native color-picker interaction remain manual acceptance, distinct from synthetic/browser input tests.
- Matrix audit passed: legacy basics/type/lists retained; selected/collapsed strike/code; P/heading/nested-LI alignments and mixed states; combined colors/marks/links plus inverse resets/native picker fill; safe/unsafe/encoded/query+quote links and unlink; partial clear; popup pointer/keyboard/cancel/native-blur; external/locked/foreign invalidation; bare/SSR/React18.2 and320px/bottom-viewport geometry. Every row ran with no skips.
- Final root `PATH="/tmp/inkforge-pnpm-bin:$PATH" pnpm validate` exited0: lint, format, typecheck, all workspace/demo builds,28 Node contracts, Chromium88 cases, publint, Are-the-Types-Wrong and packed React18.2/19 checks passed. Expected rejected private/deep imports print errors inside successful packed checks. Log `/tmp/inkforge-expanded-final-validate.log`.
- Final root `pnpm test:browser` exited0:264/264,88each on Chromium/Firefox/WebKit. Log `/tmp/inkforge-expanded-final-browsers.log`. Screenshots inspected: `/tmp/inkforge-expanded-desktop.png`, `-link.png`, `-color.png`, `-narrow.png` and final `/tmp/inkforge-expanded-final.png`. Final Playground reopened on4173, exec11794. No dependencies or remote operations added.

## Spec Change Log

## Review Triage Log

Review pass1: high1, medium13, false1 (15 individual findings). Duplicated IME/viewport findings remain separate rows and share fixes. No new public API or schema changes required.

| Finding | Verdict | Route | Evidence/action |
| --- | --- | --- | --- |
| Verification: reset preserves other color untested | medium | patch | Existing test only checks foreground disappears, then clears all formatting. Assert remaining highlight and inverse reset independently in DOM/export. |
| Verification: native picker value never applied | medium | patch | Current custom test fills hex text; picker test only focuses. Change native color input and Apply, assert intended selection/export. |
| Blind: reset/clear leaves inherited block color | false | reject | These tools remove selected inline presentation and Reset returns to inherited block defaults; block styles remain intentionally. A P-level color is not an inline override, so leaving that supported block presentation is expected. Clarify README wording without altering block structure/styles. |
| Blind: link edit/unlink loses anchor presentation | medium | patch | Unwrapping A removes its class/style unlike mark-preserving operations; preserve unrelated presentation for selection and collapsed unlink. |
| Blind: collapsed link insertion remains selected | medium | patch | Insertion selects label and leaves range noncollapsed, so next typing replaces URL; collapse after inserted label. |
| Blind: pending tools not applied to IME | medium | patch | beforeInput handles insertText only and composition finalization commits without applying pending edits; apply to committed composition range once without touching transient IME DOM. |
| Blind: alignment always aria-pressed false | medium | patch | All alignment buttons use default active=false; derive selected semantic alignment, account for mixed state. |
| Blind: code/strike state only checks first ancestor | medium | patch | Toggle checks all leaves but state reads only start; make state agree with toggle on mixed selections. |
| Blind: popup below viewport | medium | patch | Absolute panel always below bar with70vh limit independent of available space; flip/clamp and test near bottom. |
| Blind: invalid duplicate CSS loses fallback | medium | patch | Dedup keeps invalid last CSS value, dropping earlier valid fallback; preserve safe fallback declarations rather than assuming every value valid. |
| Blind: foreign selection ignored during popup | high | patch | Snapshot-valid early return precedes selection ownership; a selection outside editor/popup can leave stale captured operation enabled. Distinguish popup/native-widget focus from actual foreign ranges. |
| Edge: pending composition styles missing | medium | patch | Same insertText-only path as blind finding; synthetic committed composition regression plus existing manual OS acceptance caveat. |
| Edge: nested color inherit loses parent value | medium | patch | Flattened child color:inherit refers to surrounding block after merge instead of the prior span; resolve supported inheritance during flattening. |
| Edge: near-bottom panel claim | medium | patch | Same viewport placement issue as blind row; verify all popup controls remain reachable via internal scrolling. |

| Root: href entities double-escaped | medium | patch | Verified built parser preserves amp entity in model href then serializes amp;amp, so new Link form corrupts ordinary multi-parameter query URLs. Decode href exactly once before URL validation, keep encoded unsafe protocols rejected, and cover parser/UI query+quote roundtrip. |

## Verification

Sequential: build, lint, format:check, typecheck, test, test:browser (all3engines), check:packages. Real app browser tests and packed React18.2/19 must pass. Adapt old layout selectors, retain behavioral checks. Root inspects desktop/narrow screenshots and opens Playground after completion; manual OS Thai IME remains a release checklist.
