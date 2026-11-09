# CMS integration delivery

Status: implementation in progress, not a production release. Updated 2026-11-06 (Asia/Bangkok).

CMS implementation waits for the library integration gates. Inkforge remains usable independently of Page Builder. CMS identity, authorization, asset ownership, persistence, locale and public reference resolution belong to the host. No package calls a CMS API or Azure Blob directly.

## Implemented boundary

| Package        | Public behavior                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| editor-core    | Immutable snapshots; atomic document replacement; undo/redo; selection; composition barrier; bounded history; session/revision checks; exact save checkpoint acknowledgement                               |
| editor-html    | Neutral profile contract; native browser parser + DOMPurify; server parse5 + sanitize-html; shared policy and syntax envelope; registered classes; logical CMS references; host-resolved public links      |
| editor-react   | Optional host-owned engine; controller ref; external-store subscription; history shortcuts and beforeinput history; selection restoration; profile-aware toolbar; atomic Source API; HTML save checkpoints |
| editor-content | Bounded token registry compiler; stable prefixed classes; responsive content CSS; opt-in example preset shared by editing and public rendering                                                             |
| editor-checks  | Revision-bound content-only reports; heading/link review; host-supplied contrast results; explicit manual/not-evaluated states; cancellation and failure                                                   |

The CMS profile accepts paragraph, H2–H4, lists, inline marks, hard breaks, links and explicitly registered content classes. It rejects unsupported tags, inline CSS, unregistered classes, unsafe links and malformed/truncated source as a whole. Native paragraph artifacts created while editing may normalize to paragraphs; externally supplied source and clipboard HTML do not receive that exception. Legacy `parseHtml`/`serializeHtml` remain compatibility APIs and do not implement the strict CMS policy.

Browser and server adapters use separate parsers and sanitizers. The shared syntax envelope rejects duplicate attributes, discarded wrappers, mismatched tags and missing closing tags before either parser repairs them. Full parity still requires the real-browser fixture run. This is syntax/content policy, never proof of ownership or authorization. The Go backend must independently validate content and references before accepting a write.

## Host use

```tsx
'use client';
import { useMemo, useRef, useState } from 'react';
import { InkForgeEditor, type InkForgeController } from '@inkforge/editor-react';
import { createContentProfile } from '@inkforge/editor-html';
import { defaultContentStylesheet } from '@inkforge/editor-content';
import '@inkforge/editor-react/editor.css';
import '@inkforge/editor-content/content.css';

export function RichTextField() {
  const [value, setValue] = useState('<p>เริ่มเขียน</p>');
  const controller = useRef<InkForgeController>(null);
  const profile = useMemo(
    () =>
      createContentProfile({
        tokenClasses: defaultContentStylesheet.tokenClasses,
        routeKeys: ['home'],
      }),
    [],
  );
  return (
    <InkForgeEditor
      className="inkforge-content"
      profile={profile}
      toolbar
      value={value}
      onChange={setValue}
      controllerRef={controller}
      contentTokenLabels={{
        'rte-typo-body': 'เนื้อหาปกติ',
        'rte-typo-lead': 'ข้อความนำ',
        'rte-text-brand': 'สีหลัก',
      }}
      aria-label="เนื้อหา"
    />
  );
}
```

Use the same generated content stylesheet and profile registry version in authoring preview and the public site. `classPrefix` alone grants no permission to use a class. `editor.css` styles authoring controls; public routes import only content styles and the server HTML adapter. The host maps its one authoring design system into toolbar CSS variables and Page Builder's `theme`; the public website's content theme is independently owned.

Do not change the engine, profile configuration, or controlled/uncontrolled mode during a mounted editor session. Remount with a new key when changing a field/site/locale. A profile editor renders an empty read-only surface during SSR and validates its initial HTML in the browser before allowing edits. If initial validation fails, the host retains the original value for review; saving is rejected.

## Saving and asynchronous dialogs

Call `controller.createSaveCheckpoint()` and persist its returned **html**, not a later `getHtml()` value. A composition in progress rejects checkpoint creation. After a successful server write, acknowledge the exact returned `checkpoint` through `controller.engine.acknowledgeSaved(checkpoint)`. Later typing remains dirty; an older acknowledgement cannot move the baseline backwards. On a failed/cancelled write, release the checkpoint. The host owns optimistic concurrency, server write ordering and cancellation.

For an authorized Source dialog, capture `getHtml()` and retain its `snapshot.sessionId` and `snapshot.revision`. Apply with `applyHtml(source,{expectedSessionId,expectedRevision})`. Invalid or stale source leaves document/history unchanged; an accepted replacement is one undoable edit. Unsupported legacy source is rejected when parsing would discard information. This API does not enable Source in the production CMS automatically.

`engine.captureSelection()`/`restoreSelection()` provide revision-bound bookmarks. Do not reuse a modal result after a session or revision change. Current public commands replace an entire document or set selection; a general plugin command/menu API and selection-range insert commands remain unfinished.

## Public rendering

Use `renderContentHtml` from `@inkforge/editor-html/server`. The host resolves `cms-ref:*` and registered `cms-route:*` to currently authorized public URLs. A null resolution removes the anchor while retaining its text. Unsafe or failed resolutions reject rendering. The returned HTML contains no unresolved logical hrefs. Temporary delivery URLs are output-only and never replace stored logical references.

## Verification and unfinished scope

Executed: build, typecheck, contract tests, package lint/type resolution, clean packed React 18/19 consumers, and the combined packed Next.js host's production HTTP probes. The Page Builder repository contains `examples/cms-host` and a reproducible pack/build/probe script using only public package exports.

Real Chromium/Firefox/WebKit behavior and manual native Thai IME are release gates, not replaced by SSR or synthetic composition. In this environment Chromium download was rejected by network policy; a saved environment draft requests `cdn.playwright.dev` and needs the environment owner's Review/Save/Publish before retrying.

The full architecture-spine feature set is **not complete**: engine-owned granular editing/formatting commands, general plugin surfaces and asynchronous media insertion, image/blockquote/code-block models, lossless unsupported Raw HTML mode, checker UI/navigation/fixes, full responsive/theme contrast evidence, and full browser/IME/visual verification remain open. The checks package explicitly reports unsupported image checks as not-evaluated. Do not mark the CMS compatibility manifest certified or publish a stable cohort from this implementation alone.
