---
'@inkforge/editor-react': minor
'@inkforge/editor-html': patch
---

Add an optional accessible basic formatting toolbar to the React editor, preserving selection, editor isolation, locked/composition guards and sanitized change emissions. Enable it in the playground and Next demo. This uses a private native browser command bridge, not the future core transaction engine.

Preserve contiguous inline marks, links and spaces in list items and mixed block flow, including nested lists and paragraph presentation during HTML roundtrips.
