---
document_id: IF-U07C-NATIVE-SURFACE
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-C
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# U07-C — Controller-owned DOM, React and Common UI surface

The user assigns the next continuation after U07-B. This slice completes the native-surface prerequisite using the real public controller, not the legacy HTML/replaceDocument engine. [Actual evidence](u07c-evidence.md) identifies the exact packed cohort. Full LIB-03/U07/CMS acceptance remains partial; exact host field acknowledgment needs the HTML/profile witness and coordinator slice described below.

## Intent and public contract

A new optional `@inkforge/editor-react/engine` entry exports InkforgeEngineEditor and the separate EngineSurfaceHandle/status/diagnostic types. It requires a borrowed public EngineController. The forwarded ref remains HTMLDivElement; surfaceRef separately exposes getStatus/discardDraft. value/defaultValue/onChange and native editing event handlers do not create a second editor authority. Changing controller or uiAdapter identity requires a remount. Native attributes/ARIA/class/style remain host presentation; maxNativeTextUtf16 is a finite validated surface limit.

`@inkforge/editor-react/common-ui` additionally exports InkforgeEngineField. It consumes only the public useFieldControl port, requires a composite Field and applies its IDs/label/help/message/required/invalid relationships without acquiring content/history/save ownership. The owner-issued adapter now advertises controllerSurface/engineToolbar. Fixed private owner composition renders the public Common UI Toolbar with actual Button children/stable item IDs; Common UI owns its roving navigation. A native toolbar fallback keeps its own captured controller bookmark/fence. There is no public parts/vendor override bag.

The default InkForgeEditor and its prototype API remain unchanged. No engineBinding/hostField fallback is enabled on that legacy component. The pure core has no DOM/React/Common UI import added by this change. The private internal/editor-dom implementation is bundled into the public React artifact; consumers never resolve a private workspace dependency.

## Model / DOM / React authority

React renders the shell/toolbar and one escaped, initially noneditable semantic SSR seed. It never reconciles live editable children. The single private DOM adapter writes the editable subtree from immutable public nodeIndex/model snapshots, preserves existing node/text identities where possible and maps native anchor/focus to legal model positions. Runtime data attributes are view-only and are not written into model content or clipboard HTML.

Supported cancelable beforeinput is prevented and compiled into one controller command. Text, Unicode grapheme/word deletion through the engine's explicit segmentation provider, paragraph/hard-break, supported formatting and history use the same model history owner. Ctrl/Cmd-Z/Y is routed once at the editable root and stops outer handling; composing/229 input remains with the native IME. Format shortcuts and toolbar buttons use the public controller, not execCommand or DOM formatting.

Two additive Core forms close atomic input gaps: insertPlainText normalizes CRLF/CR to explicit model hard-break nodes in one transaction, and splitBlock accepts a disjoint selected-range form so Enter replaces a selection and splits with one revision/undo. Existing at-position split semantics and persisted AST shape remain unchanged.

Native selection events caused by a view restore are compared by semantic model extent; they do not fabricate a user selectionEpoch. A toolbar trigger captures the public bookmark before native pointer focus. Activation restores/checks the original exact token/selection/fence, applies one command and releases the tool. Changed model selection, owner context or fence rejects the old gesture. A tombstone prevents fallback activation from recapturing an old pointer gesture as a fresh one.

## Native composition and bounded reconciliation

compositionstart captures the committed selection, public begin token, original fence and affected text-block witness. The engine stays composing with its committed document unchanged while the browser owns its transient native text. Composition end validates the original prefix/suffix/region/context and commits one final replacement with the exact begin token. Trailing composition input cannot dispatch the final text twice. Toolbar/Save checkpoint paths cannot force blur or finalize composition to accelerate saving.

Theme/density changes retain the same native div and never toggle contentEditable/readonly during an active composition. Disabling/readonly/owner changes invalidate acceptance while preserving the buffer until browser completion and explicit review. Rejected/stale/unrecognized native drafts become inert text previews in RAM; they do not become model authority. Surface status reports pending/invalidDraft, and an armed engine composition blocks model checkpoints when retained. Explicit discard uses the original token/fence; it is not a save acknowledgment or an automatic retry.

For a declared noncancelable text-replacement path, the adapter captures the original token/fence/affected block before the native mutation, computes a bounded text diff, then dispatches one model replacement. Unknown mutation/input is quarantined. The qualified native cohort and synthetic noncancelable schedule are distinguished in evidence; other browser/OS spelling/autocorrect behavior remains unqualified.

## Visibility, disposal and clipboard/policy gates

Unmount unsubscribes/removes native listeners/observer and does not dispose the borrowed controller. A live native composition is retained in a per-controller RAM record; remount exposes an invalid draft for explicit review rather than replaying or committing it. Terminal controller disposal clears retained candidate text and prevents revival. Actual development StrictMode replays setup/cleanup, and repeated idle unmounts return native listeners/observers to baseline.

Clipboard supports explicit plain-text paste, with model hard breaks, and text-only copy without runtime-ID markup. Rich HTML paste is rejected until a validated slice/loss policy exists. Cut requires a confirmed clipboard writer; drop remains gated. Neither native HTML nor hidden clipboard styles enter the model. Model class/style/link policy that is not yet connected to the new renderer produces read-only safe presentation and a diagnostic while preserving the original model. It is not silently dropped and reopened for editing. Existing immutable HTML/profile contracts remain authoritative for the next bridge.

## Implementation and acceptance plan

1. Preserve the legacy source and U07-A/B evidence; add a separate private DOM writer and public React engine entry.
2. Bind semantic native selection, cancelable commands, bounded noncancelable reconciliation, original-ticket toolbar intents and RAM-only composition/draft lifecycle.
3. Add only the two atomic Core input forms needed by the native adapter, with actual inverse/selection/ID regression tests.
4. Build all five physical packages; exercise strict public declarations/SSR/optional-peer behavior and real production/development browser schedules, including native Chromium composition and resource cleanup.
5. Record exact source/package/runtime/log identities. Keep native OS IME/manual AT/browser-family/profile/host acknowledgment certification separate.

## Next: U07-D exact host boundary

Implement the canonical HTML/profile witness and PublicHostFieldPort acknowledgment/echo/lifecycle bridge, followed by Page Builder bound-field integration. FieldAck must correlate request/binding/epoch/child/parent tokens and exact accepted value; it is never a server Save receipt. The standalone branch must not create a fake Builder. View invalidDraft/composition status must participate in prepare barriers along with the controller; a bare model checkpoint is not a complete host save barrier. No opaque fence may be restamped after await or owner change.

LIB-04 profile parity, remaining list/link/slice/clipboard-writer/layout/plugin commands, production CSP for the new surface, manual AT/native OS IME, browser-family/performance and complete CMS release gates remain open. Shared Go framework and live Tenant/Domain/Azure values stay deferred. No commit/push, registry release or deployment is part of this slice.
