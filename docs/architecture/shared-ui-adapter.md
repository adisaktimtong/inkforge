---
document_id: DOC-IF-SHARED-UI-ADAPTER
artifact_type: spec
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui
usage: canonicalReference
---

# Inkforge shared UI adapter

This owner specification and [public port registry](../../contracts/shared-ui-adapter.json) extend [engine design](24-inkforge-editing-engine.md) and [owner handoff](../work-items/LIB-02-shared-ui/intent.md). CMS owns the current-draft cross-library protocol at `contracts/authoring-ui-adapter-contract.json` / `docs/architecture/26-authoring-ui-adapter-integration.md`; UI Component owns primitive/trigger contracts in `contracts/authoring-adapter-ports.json`. Documentation publication follows the containing commit; package APIs remain proposed and runtime unverified.

## 1. Additive surface and source baseline

At committed `9d7392d1aae9ef6c25040ce7c2318324f0a55d35`, InkForgeEditor has HTML value/defaultValue/onChange/onDiagnostics, disabled/readOnly, optional toolbar and forwarded HTMLDivElement ref Root/editor.css exports exist; new common-ui/controller ports remain proposed Public engine readiness cannot be inferred from dirty working-tree experiments

Proposed optional `@inkforge/editor-react/common-ui` exports `createInkforgeCommonUiAdapter`, an immutable version1 descriptor that allocates no engine/session/DOM at import Add `uiAdapter?` and separate opt-in engineBinding to React editor through public types; editor-core remains React/UI/CMS/Builder-independent Omitted optional props retain legacy behavior. The no-argument factory issues a nominal opaque descriptor with kind/metadata only. Exact proposed descriptor, host-field, echo/ack and native-ref types: [shared-ui-adapter-v1.d.ts](../../contracts/shared-ui-adapter-v1.d.ts).

```ts
type LegacyHtmlMode = { engineBinding?: never } & (
  | {value: string; defaultValue?: never; onChange?(html: string): void}
  | {value?: never; defaultValue?: string; onChange?(html: string): void}
); // preserve existing controlled/uncontrolled behavior
type EngineBoundMode = {
  engineBinding: Readonly<{controller: PublicEngineController; hostField: PublicHostFieldPort}>;
  value?: never; defaultValue?: never; onChange?: never;
};
```

The new engine-bound branch has one controller authority and uses public host-field/coordinator callbacks rather than an unversioned HTML echo setter It cannot also accept value/defaultValue/onChange as a second mutable authority on the same instance Shared native DOM props/onDiagnostics/ref remain available as appropriate Exact PublicEngineController/HostFieldPort types are owner public exports designed by LIB-03/NC, not existing symbols in baseline code Forwarded ref remains HTMLDivElement; controller comes through a separate explicit port/hook, never a minor-change ref reinterpretation

Legacy visual adoption does not enable engineBookmark/nested CMS capability until the real public controller bridge passes its own gates No new source adapter may scrape contentEditable internals or use execCommand to masquerade as an engine-owned command

## 2. Engine/public UI bridge

Use proposed LIB-03 public getSnapshot/subscribe/dispatch/setSelection/captureBookmark/restoreBookmark and immutable snapshot semantics Toolbar observes formatting/mixed/readOnly/composing state rather than inspecting DOM text Commands carry expected child session/revision, selectionEpoch when selection-dependent and host-held captured context No implicit Builder import is needed

Native selection changes update public selection state while authorized so keyboard/assistive toolbar activation retains the last logical bookmark Pointer tool intent captures before native focus; pre-open rechecks the same capture Current composing/invalid/stale status cancels or blocks the operation without forced blur/finalization A fallback activation-only path cannot promise cancellation of earlier native/AT focus; valid stored capture is required

Before apply, compare original selectionEpoch in addition to document revision Restore of the accepted bookmark is programmatic engine selection restoration under LIB-03 policy, not fabricated new user intent; dispatch still checks freshness Do not restore over a newer user caret merely because text revision is unchanged Unrelated parent sequence changes remain strict NC stale unless a fresh explicit tool intent is created

One command maps to one engine transaction/history group and one candidate submission Host/Builder terminal acknowledgement governs field delivery; engine acknowledgement is not server Save Inner undo has no automatic page fallback; parent echoes preserve inner history/session, explicit external replacement uses its own public origin

## 3. Shared Field, toolbar and overlays

Field/useFieldControl composite mode supplies stable IDs/ARIA for the contentEditable and helper/error labels It owns no HTML/selection/controller ref Engine-bound editor applies these props to the actual native div with visible label/aria-labelledby; no invalid label/htmlFor association to a div Placeholder is not the only label

Formatting tools use shared Toolbar/ToggleButton/Menu; links/media/color/token use shared overlay/field presentation with host typed result and policy Dialog trap/return focus is separate from engine bookmark Focus/IME/history/async results keep captured context; no forced commit because a popup closed

UiProvider/density/locale/dir/scoped CSS apply to authoring toolbar and portals; content CSS/profile/render/sanitizer remain separate UiProvider changes do not rewrite engine HTML, profile, history or dirty state Popup outside transformed/clipped Canvas uses same-document manager; explicit null waits and foreign Document is unsupported

## 4. Standalone and lifecycle

Standalone engine-bound editor uses public host field/version/prepare/ack with hostValueGeneration, not a synthetic Builder document/import A minimal plain-form host can own its field state while HTML/profile/validation remain explicit No CMS query/client/network/save dependency is introduced to Inkforge

React surfaces borrow an external engine when supplied Strict Mode/unmount releases subscriptions/DOM listeners without disposing that engine A host-owned logical binding may stay authorized with pending/rejected candidate while hidden; Save preparation still sees it Owner disposal is terminal/idempotent and clears model/history/composition/bookmarks/tool callbacks per existing policy

Authorized same-actor pre-expiry continuation preserves engine/IME/undo but invalidates old async tool captures New UI epoch never restamps old result Hard expiry/logout/revoke/different actor clears protected state and portal text; there is no browser draft persistence/automatic replay/revival

## 5. Delivery and proof

Owner UA-IF01–06 slices are in the work-item plan; public engine bridge and native IME are LIB-03 dependencies, independent of full downstream CMS certification Prove standalone first with actual public artifacts, then combined host under exact versions/CSS/patch hashes Shared palette or a mock controller echo cannot certify controller readiness All runtime/native browser/AT/packed cases remain notRun; no implementation/dependency/test/CI source is added here

## Declaration-level closure — RR-07

The version1 adapter descriptor is explicitly nominal/opaque and issued by its owning no-argument factory. Public fields are kind and immutable metadata only; there is no supported public parts/slot override bag. Earlier view-parts wording describes private implementation composition. Metadata alone cannot forge factory identity or certify a capability. The proposed contract declarations in the owner contracts directory now define the exact registration/lease or host-field/snapshot/ack surface, with disjoint echo/value modes and native div ref preserved. UI synchronous guard returns undefined so Promise-returning pre-open handlers fail the contract. Declaration-only fixtures/type smoke do not prove actual package exports/engine behavior; all runtime/cohort gates remain notRun.

## U07-A implemented subset

[Current implementation](../work-items/LIB-02-shared-ui/u07-presentation.md) / [actual evidence](../work-items/LIB-02-shared-ui/u07-evidence.md) now qualify only the additive presentation boundary. The proposed full controller/field ports above remain downstream. Use emitted declarations and explicit capabilities for current adoption; metadata is not authorization and unsupported bridge props fail.
