---
'@inkforge/editor-core': minor
'@inkforge/editor-react': minor
---

Add the `setLink` and `removeLink` controller commands, and Link and Remove link actions on the controller-based surface when it has a content profile. A host can supply its own picker through `requestLink`; every address is checked against the profile before it is stored.

`requestLink` may resolve with `{ href, target }` so a host picker can ask for a new tab.

`requestLink` receives a second argument, `{ target }`, so a picker reopened on a link knows whether it opens in a new tab.
