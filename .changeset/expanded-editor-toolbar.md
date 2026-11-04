---
'@inkforge/editor-react': minor
'@inkforge/editor-html': patch
---

Add a compact themed SVG toolbar with a text-style dropdown, strike/code, safe link editing, block alignment, text/highlight palettes and clear formatting. Preserve editor-owned selections across accessible popups and reject stale operations. Direct DOM tools retain the existing native-history limitation.

Merge nested inline presentation and classes with child style overrides while preserving CSS fallbacks and inheritance. Decode href entities exactly once before URL validation so query parameters and quotes round-trip safely.
