import type { EngineController } from '@inkforge/editor-core';
import type { EngineContentCodec } from '@inkforge/editor-html/engine';
import {
  createEngineFieldBinding,
  type PublicHostFieldPort,
  type HostFieldAck,
  type ParentToken,
} from '@inkforge/editor-react/host';
import type { BoundFieldPort } from '@pagebuilder/headless/editor/field-binding';
declare const e: EngineController,
  codec: EngineContentCodec,
  host: PublicHostFieldPort,
  builder: BoundFieldPort;
const compatible: PublicHostFieldPort = builder;
createEngineFieldBinding({
  controller: e,
  hostField: compatible,
  codec,
  surfaceStatus: () => ({ phase: 'ready', pending: false }),
});
// @ts-expect-error original-context checks are required separately from a parent sequence check
const missingContext: PublicHostFieldPort = {
  getSnapshot: host.getSnapshot,
  subscribe: host.subscribe,
  captureFence: host.captureFence,
  isFenceCurrent: host.isFenceCurrent,
  submitFieldEdit: host.submitFieldEdit,
};
// @ts-expect-error surface readiness must be supplied explicitly
createEngineFieldBinding({ controller: e, hostField: host, codec });
// @ts-expect-error Builder and standalone parent tokens are disjoint
const parent: ParentToken = { kind: 'standalone', sessionId: 'fake', sequence: 0 };
// @ts-expect-error successful ack must carry exact accepted value and actual parent token
const ack: HostFieldAck = {
  status: 'committed',
  requestId: 'r',
  fieldBindingId: 'f',
  bindingEpoch: 1,
  acceptedChildToken: { sessionId: 'c', revision: 1 },
  diagnostics: [],
};
// @ts-expect-error non-success ack cannot claim accepted HTML
const rejected: HostFieldAck = {
  status: 'stale',
  requestId: 'r',
  fieldBindingId: 'f',
  bindingEpoch: 1,
  acceptedChildToken: { sessionId: 'c', revision: 1 },
  diagnostics: [],
  actualParentToken: null,
  exactAcceptedHtml: '<p>x</p>',
};
createEngineFieldBinding({
  // @ts-expect-error native HTML value cannot replace a borrowed controller
  controller: '<p>x</p>',
  hostField: host,
  codec,
  surfaceStatus: () => null,
});
void [missingContext, parent, ack, rejected];
