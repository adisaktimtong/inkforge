# Text Editor Engine

This repository is a pnpm 12.4.2/Turborepo workspace for independently versioned public editor packages. It includes a shared HTML parser/serializer and a small React editing adapter for CMS forms.

## Requirements and setup

Use Node `>=22.18.0` (Node 24 is the release runtime) and pnpm `12.4.2`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm validate
```

Public packages use the `@inkforge` npm scope. Consumers may import only entries declared in each package's `exports`; `internal/*` and `apps/*` are private and are never published. `@inkforge/editor-react` peers `@inkforge/editor-core`, React, and React DOM; future internal adapters must be bundled rather than left as runtime dependencies.

## Release contract

Changesets version public packages independently and the `Release PR` workflow only prepares a version PR. Canary/snapshot packages are for pull requests, `beta` is for release candidates, and `latest` is promoted only after the release cohort's packed-consumer, compatibility, and three-browser checks pass. Stable cohorts publish under a temporary dist-tag first, are smoke-tested, then promote atomically; rollback restores range-compatible last-known-good tags, deprecates broken versions, and forward-fixes without unpublishing.

Publishing is manual and approval-gated by the `npm-production` GitHub Environment. It runs on GitHub-hosted Node 24 with npm Trusted Publishing/OIDC; no npm credentials are stored in this repository. Configure npm trusted-publisher mappings for each `@inkforge` package and confirm environment reviewers before publishing. Security fixes deprecate affected versions, correct dist-tags, and release a forward fix.

`pnpm check:packages` runs publint, Are the Types Wrong, packs public packages, installs tarballs in a clean consumer, verifies declared entry points, and rejects private/deep imports.

## React editor

Install `@inkforge/editor-react`, `@inkforge/editor-core`, `react` and `react-dom` (React 18.2 or 19). The React adapter depends on the public `@inkforge/editor-html` boundary. Import the opt-in UI stylesheet separately:

```tsx
'use client';

import { useState } from 'react';
import { InkForgeEditor } from '@inkforge/editor-react';
import '@inkforge/editor-react/editor.css';

export function ArticleForm() {
  const [html, setHtml] = useState('<p>Start writing</p>');
  return <InkForgeEditor aria-label="Article body" value={html} onChange={setHtml} />;
}
```

Use `defaultValue` instead of `value` for uncontrolled editing; it is read only on mount. `onChange(html)` receives sanitized HTML for distinct committed edits. `onDiagnostics(diagnostics)` reports the HTML boundary's diagnostics for values and accepted edits. A controlled host should echo changes into `value`; supplying a different value replaces the document. Do not switch between controlled and uncontrolled usage.

The component forwards a ref to its `HTMLDivElement` for `focus()` and supports native div attributes/events, `aria-label`/`aria-labelledby`, `className`, `tabIndex`, `disabled` and `readOnly`. It exposes a multiline textbox; disabled editors leave the tab sequence and read-only editors remain focusable. The host must supply an accessible name. `children`, `contentEditable` and `dangerouslySetInnerHTML` are owned by the adapter.

Initial and external HTML and formatted clipboard HTML use the shared parser/serializer. Ordinary typing keeps the browser DOM and caret; blur and committed composition normalize markup with selection preservation. Intermediate composition does not emit changes, and blur finalizes a composition if its end event is missing. External value changes during composition wait until finalization. Native HTML drops are blocked; paste is accepted outside composition. Supported article content includes paragraphs, headings, marks, links, lists and hard breaks.

This MVP has no toolbar, commands/transaction engine, plugin API, uploads, collaboration, persistence or custom history. Typing uses native browser editing/undo; sanitization and paste DOM replacements do not provide a custom undo history. It does not integrate with pagebuilder. Run the React playground for controlled/uncontrolled, reset and diagnostics examples; the Next demo's `/editor` route exercises server rendering and hydration while `/` remains a content-only route. Automated composition checks supplement the manual OS Thai IME checklist in `tests/ime-manual/thai-ime-checklist.md`.
