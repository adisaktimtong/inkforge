---
'@inkforge/editor-html': patch
---

A styled span around a link now styles the link text instead of the link element, and a styled span around a line break leaves the break unstyled. Before, the canonical output of such input was rejected by the same strict profile on the next check.
