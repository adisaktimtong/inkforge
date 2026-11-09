// Proposed public design declarations; EngineController is the LIB-03 public target, not an existing export.
import type { Ref } from 'react';
import type { EngineController } from '@inkforge/editor-core';
declare const inkforgeUiAdapterBrand: unique symbol;
export interface InkforgeUiAdapterV1 {
  readonly [inkforgeUiAdapterBrand]:true; readonly kind:'inkforge';
  readonly metadata:Readonly<{kind:'inkforge'; adapterApiVersion:1; uiContractVersion:'0.2.0';
    tokenSourceVersion:'0.2.0'; cssFingerprint:string; capabilities:readonly string[]}>;
}
export declare function createInkforgeCommonUiAdapter():InkforgeUiAdapterV1;
export interface ChildToken { readonly sessionId:string; readonly revision:number }
export type ParentToken = Readonly<{kind:'builder'; sessionId:string; sequence:number}>
  | Readonly<{kind:'standalone'; hostValueGeneration:number}>;
export interface ProfileIdentity { readonly id:string; readonly version:string; readonly fingerprint:string }
interface HostFieldSnapshotBase {
  readonly fieldBindingId:string; readonly bindingEpoch:number;
  readonly lifecycle:'active'|'suspended'|'disposed'; readonly interactionContextKey:string;
  readonly parent:ParentToken; readonly html:string; readonly profile:ProfileIdentity;
}
export type HostFieldSnapshot = Readonly<HostFieldSnapshotBase> & (
  | Readonly<{origin:'echo'; acceptedRequestId:string; acceptedChildToken:ChildToken}>
  | Readonly<{origin:'ownerLoad'|'parentUndo'|'parentRedo'|'conflictResolution';
      acceptedRequestId?:never; acceptedChildToken?:never}>
);
export interface HostFieldEdit {
  readonly requestId:string; readonly capturedHostFenceRef:string; readonly child:ChildToken;
  readonly canonicalHtml:string; readonly profile:ProfileIdentity;
}
export type HostFieldAck = Readonly<{requestId:string; fieldBindingId:string; bindingEpoch:number;
  acceptedChildToken:ChildToken; diagnostics:readonly string[]}> & (
  | Readonly<{status:'committed'|'noChange'; actualParentToken:ParentToken; exactAcceptedHtml:string}>
  | Readonly<{status:'rejected'|'stale'|'disposed'; actualParentToken:ParentToken|null; exactAcceptedHtml?:never}>
);
export interface PublicHostFieldPort {
  getSnapshot():HostFieldSnapshot;
  subscribe(listener:()=>void):()=>void;
  captureFence():string;
  isFenceCurrent(capturedHostFenceRef:string):boolean;
  submitFieldEdit(edit:HostFieldEdit):Promise<HostFieldAck>;
}
export type EngineBoundMode = Readonly<{engineBinding:Readonly<{
  controller:EngineController; hostField:PublicHostFieldPort}>; value?:never; defaultValue?:never; onChange?:never}>;
export type LegacyHtmlMode = Readonly<{engineBinding?:never}> & (
  | Readonly<{value:string; defaultValue?:never; onChange?:(html:string)=>void}>
  | Readonly<{value?:never; defaultValue?:string; onChange?:(html:string)=>void}>
);
// Native forwarded HTMLDivElement ref is separate from the controller and remains unchanged.

export type InkforgeNativeRef = Ref<HTMLDivElement>;
export type EditorAdapterProps = (LegacyHtmlMode|EngineBoundMode) & Readonly<{
  uiAdapter?:InkforgeUiAdapterV1; disabled?:boolean; readOnly?:boolean;
}>;
