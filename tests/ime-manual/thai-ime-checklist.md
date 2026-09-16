# Thai IME acceptance checklist

Run this checklist on Chrome/Edge, Firefox, and Safari stable before a release candidate.

1. Start Thai composition in an empty paragraph; commit once and confirm no duplicate or reordered text.
2. Compose over a ranged selection and confirm the replacement is a single undoable transaction.
3. Blur during composition; confirm the adapter finalizes or restores the committed document once.
4. Use undo/redo after composition and confirm UTF-16 selection positions remain correct.

Record browser version, OS input method, result, and any diagnostics with the release cohort.
