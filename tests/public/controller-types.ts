import {
  createEngine,
  createDocument,
  type EngineController,
  type ControllerToken,
  type ModelPosition,
  type ControllerCommand,
  type ControllerCheckpoint,
  type EngineBookmark,
} from '@inkforge/editor-core';
const controller: EngineController = createEngine({
  document: createDocument(),
  instanceId: 'typed-host',
  origin: 'unsaved',
  clock: () => 0,
});
const s = controller.getSnapshot();
controller.setSelection(null, { expected: s.token });
// @ts-expect-error token identity can only be issued by this controller
const forged: ControllerToken = {
  engineInstanceId: 'x',
  sessionId: 'x',
  revision: 0,
  selectionEpoch: 0,
};
controller.setSelection(null, {
  // @ts-expect-error a plain JSON copy of the proposed structural data is not a valid controller token
  expected: { sessionId: 'x', revision: 0, selectionEpoch: 0, engineInstanceId: 'x' },
});
// @ts-expect-error model selection addresses IDs/UTF-16 with affinity, not legacy semantic numeric offsets
controller.setSelection({ anchor: 0, head: 1 }, { expected: s.token });
// @ts-expect-error the new engine does not expose a replaceDocument command fallback
controller.dispatch({ kind: 'replaceDocument', document: createDocument() }, { expected: s.token });
// @ts-expect-error snapshot content cannot be mutated by subscribers
s.document.children.push({ type: 'paragraph', children: [] });
// @ts-expect-error token metadata is immutable
s.token.revision = 99;
createEngine({
  document: createDocument(),
  instanceId: 'x',
  origin: 'persisted',
  clock: () => 0,
  // @ts-expect-error live DOM is not an input to the pure model engine
  editorElement: document.createElement('div'),
});
// @ts-expect-error HTML callbacks do not substitute for captured transaction context
controller.dispatch({ kind: 'undo' }, { onChange: () => {} });
// @ts-expect-error affinity is explicit
const missingAffinity: ModelPosition = { nodeId: 'x', offset: 0 };
const html: ControllerCommand = {
  kind: 'insertText',
  range: { anchor: missingAffinity, head: missingAffinity },
  text: '<p>x</p>',
  // @ts-expect-error raw HTML replacement is outside the model command boundary
  html: '<p>x</p>',
};
// @ts-expect-error checkpoints are nominally issued, not a document-shaped receipt
const cp: ControllerCheckpoint = { id: 'forged', token: s.token, document: s.document };
// @ts-expect-error bookmarks cannot be constructed from copied public fields
const bm: EngineBookmark = {
  token: s.token,
  selection: { anchor: missingAffinity, head: missingAffinity },
};
void [forged, missingAffinity, html, cp, bm];
