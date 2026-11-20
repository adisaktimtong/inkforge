---
'@inkforge/editor-core': minor
'@inkforge/editor-html': minor
'@inkforge/editor-react': minor
'@inkforge/editor-content': minor
'@inkforge/editor-checks': minor
---

Add subscript and superscript marks, and the `cms-body-v2` content profile: a superset of `cms-body-v1` that accepts `sub`/`sup` and gives alignment classes (`<prefix>align-left|center|right|justify`) a fixed placement of one per text block. The profile-aware toolbar offers alignment buttons for the registered alignment classes and subscript/superscript buttons. `cms-body-v1` keeps its identity, fingerprint and accepted tags.

Add block quote, code block and horizontal rule block types to the document model, HTML codec, controller and toolbar. `cms-body-v2` stores them as `blockquote`, `pre` and `hr`; a quote and a code block hold inline content only, and line breaks in a code block are `br`.
