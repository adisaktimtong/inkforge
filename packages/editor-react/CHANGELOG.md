# @inkforge/editor-react

## 0.1.0

### Minor Changes

- 3372cf9: Add an optional accessible basic formatting toolbar to the React editor, preserving selection, editor isolation, locked/composition guards and sanitized change emissions. Enable it in the playground and Next demo. This uses a private native browser command bridge, not the future core transaction engine.

  Preserve contiguous inline marks, links and spaces in list items and mixed block flow, including nested lists and paragraph presentation during HTML roundtrips.

- 40895f9: Add a compact themed SVG toolbar with a text-style dropdown, strike/code, safe link editing, block alignment, text/highlight palettes and clear formatting. Preserve editor-owned selections across accessible popups and reject stale operations. Direct DOM tools retain the existing native-history limitation.

  Merge nested inline presentation and classes with child style overrides while preserving CSS fallbacks and inheritance. Decode href entities exactly once before URL validation so query parameters and quotes round-trip safely.

- 66423a0: Add the accessible InkForgeEditor React adapter with controlled and uncontrolled HTML, shared sanitization and diagnostics, composition-safe editing, focus/ref support, and opt-in UI styles. Preserve the client boundary for Next.js consumers.

### Patch Changes

- Updated dependencies [3372cf9]
- Updated dependencies [40895f9]
- Updated dependencies [66423a0]
  - @inkforge/editor-html@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [7b2c56f]
  - @inkforge/editor-core@0.0.2

## 0.0.1

### Patch Changes

- 20e6040: Add repository metadata required for npm Trusted Publishing and publish the initial public package release.
- Updated dependencies [20e6040]
  - @inkforge/editor-core@0.0.1
