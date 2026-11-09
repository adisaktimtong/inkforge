---
document_id: IF-U07A-PRESENTATION
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui/U07-A
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# Inkforge — U07-A additive presentation implementation

The current user assignment advances the [owner plan](plan.md) through its independent presentation boundary. The complete [target specification](spec.md) remains authoritative; U07-A is not full LIB-02 or CMS acceptance.

## Intent and delivered contract

`@inkforge/editor-react/common-ui` now exports the no-argument `createInkforgeCommonUiAdapter` factory. Its nominal descriptor has only kind/metadata, frozen metadata/capabilities and an owner-private runtime identity. Copied/foreign descriptors and factory options fail. The optional uiAdapter prop requires UiProvider and explicit Common UI plus editor styles. Omission preserves the legacy editor entry; changing adapter identity requires a remount. The core has no Common UI/React dependency introduced by this change.

The implemented capabilities are scopedTheme, nativeButtons, compositeField, legacyHtmlSurface. Existing actions render public Common UI Button through fixed private owner composition. This does not expose a public parts bag or certify full toolbar/menu/overlay/tree/field families. Persisted formats, owner permissions, saved/dirty semantics and network delivery remain unchanged.

The optional entry also exports InkforgeFieldEditor. It requires a composite Field, consumes public useFieldControl, forwards the real HTMLDivElement ref and projects IDs/ARIA without moving HTML/history into Field. Initial Common UI readiness blocks the adapted surface until its first ready commit; subsequent presentation changes never toggle contentEditable, including during active composition. Context replacement invalidates the retained legacy formatting panel/bookmark. Proposed engineBinding fails explicitly. The preexisting editor-core engine.ts and DOM/execCommand toolbar remain unreviewed prototype dependencies; no LIB-03 engine-owned command/bookmark acceptance is inferred. UA-IF01 is delivered; UA-IF03/04 are partial; UA-IF02/05 and full UA-IF06 remain open.

The tsdown client directive now applies only to JavaScript chunks; strict emitted declarations compile without skipLibCheck. The external Common UI package stays unbundled and optional; the default React entry renders with UI absent.

## Implementation / test / evidence

Add owner-private issuance, optional exports and additive rendering first; then exercise real physical packages with the public APIs. [Owner evidence](u07-evidence.md) records actual source/artifact hashes and the exact cohort. The owning tests use a real Next consumer maintained with Common UI; no editor source aliases, private consumer imports or substitute controller are used.

Next is U07-B: real public engine-owned command/selectionEpoch/bookmark work, exact standalone/Builder host fences and terminal field acknowledgments, followed by shared toolbar/overlay replacement. No unsupported capability silently falls back to existing HTML callbacks. CMS owns complete integration/security/save/publishing. No commit/push/package release or live configuration is part of this slice.
