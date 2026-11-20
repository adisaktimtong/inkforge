---
'@inkforge/editor-react': patch
---

Keep the caret inside an inline wrapper when the editor restores the selection after typing, so a format switched on or off for the next characters applies to exactly those characters. Stop a controlled value replaced from outside from pulling focus back into the editor, which also let a toolbar command act on the replaced document with a stale selection.
