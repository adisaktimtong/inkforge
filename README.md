# Text Editor Engine

This repository is a pnpm 12.4.2/Turborepo workspace for independently versioned public editor packages. It includes a shared HTML parser/serializer and a small React editing adapter for CMS forms.

## Requirements and setup

Use Node `24.x`, npm `11.x` and pnpm `12.4.2` for the workspace/Common UI build. The pure editor package Node `>=22.18.0` compatibility contract remains separate from this build cohort.

```sh
corepack enable
# Requires the sibling source repository; exports only its pinned Git commit.
node scripts/prepare-ui-peer.mjs --repository ../ui-component
# Alternatively: node scripts/prepare-ui-peer.mjs --artifact /path/to/accepted-ui.tgz
pnpm install --frozen-lockfile
pnpm validate
```

Preparation verifies the exact Common UI source/artifact pin in [private build inputs](contracts/private-build-inputs.json). Its ignored tarball is a development dependency; the public optional peer remains unchanged. Missing or modified bytes fail before replacing an input. It does not publish UI, select a registry, change sibling source or require a temporary pnpm override. CI uses the same helper. A private sibling checkout needs appropriate read access (`UI_COMPONENT_READ_TOKEN` where the default token cannot read it); enter credentials in CI settings, not source or chat. Actual GitHub job success is separate from local verification.

Run `pnpm test:frozen-install` after preparation to exercise clean source export, frozen/offline repeat, input retention and actual package build/contracts. `INKFORGE_PNPM_STORE` selects a cache; `INKFORGE_INSTALL_OFFLINE=1` requires it to be populated. [U08-A](docs/work-items/LIB-03-inkforge-engine/u08a-reproducible-install.md) records scope and verification limits. The existing full `pnpm validate` gate is broader than this scoped install/build check. `pnpm test:contracts` runs the eight owner contract files; `pnpm test:integration` requires the sibling Page Builder/Common UI checkouts and runs their existing packed A–E integration pipeline, including both public host fixtures. Every new contract fixture must be explicitly classified.

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
  return <InkForgeEditor toolbar aria-label="Article body" value={html} onChange={setHtml} />;
}
```

Use `defaultValue` instead of `value` for uncontrolled editing; it is read only on mount. `onChange(html)` receives sanitized HTML for distinct committed edits. `onDiagnostics(diagnostics)` reports the HTML boundary's diagnostics for values and accepted edits. A controlled host should echo changes into `value`; supplying a different value replaces the document. Do not switch between controlled and uncontrolled usage.

The component forwards a ref to its `HTMLDivElement` for `focus()` and supports native div attributes/events, `aria-label`/`aria-labelledby`, `className`, `tabIndex`, `disabled` and `readOnly`. It exposes a multiline textbox; disabled editors leave the tab sequence and read-only editors remain focusable. The host must supply an accessible name. `children`, `contentEditable` and `dangerouslySetInnerHTML` are owned by the adapter.

Initial and external HTML and formatted clipboard HTML use the shared parser/serializer. Ordinary typing keeps the browser DOM and caret; blur and committed composition normalize markup with selection preservation. Intermediate composition does not emit changes, and blur finalizes a composition if its end event is missing. External value changes during composition wait until finalization. Native HTML drops are blocked; paste is accepted outside composition. Supported article content includes paragraphs, headings, marks, links, lists and hard breaks.

Set `toolbar` to show the compact SVG toolbar: Bold, Italic, Underline, Strikethrough, Inline code, a Paragraph/Heading 1–3 dropdown, lists, Left/Center/Right/Justify alignment, Text color, Highlight, Link and Clear formatting. It defaults to `false`, preserving the bare editable div and stable forwarded ref. Colors offer swatches, a native custom picker, six-digit hex input and a reset for only that property. Reset removes the selected inline override and returns to inherited block defaults. Clear formatting removes selected inline marks/styles while preserving block presentation, block/list structure and link destinations. Link accepts safe absolute or relative URLs, retains selected text and uses the URL as its label at a collapsed caret; unsafe or empty URLs show an inline error without editing content.

Pointer/touch activation preserves the intended editor selection. Tab enters the toolbar at one control; Left/Right arrows move between its top-level controls, Home/End jump to the first/last, and Enter/Space activate. Popup inputs receive focus, Tab moves through their controls, Escape/Cancel closes without applying and returns focus to the trigger. Outside clicks, external replacement and locked modes close/invalidate popups. Controls are unavailable while disabled, read-only or composing. Theme with `--inkforge-toolbar-border`, `--inkforge-toolbar-background`, `--inkforge-toolbar-color`, `--inkforge-toolbar-hover`, `--inkforge-toolbar-active` and `--inkforge-toolbar-focus`.

The React editing adapter uses native input and private DOM formatting operations, committing accepted edits into the core's atomic document history. Undo/redo, Source replacements, save checkpoints and session/revision fences now share that history. Granular model-owned formatting commands and a general plugin API remain open; this is not completion of the full editor-engine specification.

For the strict CMS profile, host-owned sessions, safe Source and save APIs, shared content tokens, checks and the combined Page Builder consumer, read [CMS integration delivery](docs/cms-integration.md). It includes the actual implemented boundary and outstanding release gates. Inkforge works as a standalone field or as a registered Page Builder custom control; the CMS backend still owns validation, permissions and persistence.

Run the React playground for controlled/uncontrolled, reset and diagnostics examples. The Next demo's `/editor` route exercises server rendering while `/` remains a content-only route. Real-browser behavior and manual Thai IME remain separate gates in `tests/ime-manual/thai-ime-checklist.md`.
