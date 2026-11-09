import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, createDocument, createParagraph, createText } from '@inkforge/editor-core';
import { createEngineContentCodec } from '@inkforge/editor-html/engine';
import { createContentProfile } from '@inkforge/editor-html';
import { parseContentHtml } from '@inkforge/editor-html/server';
import { createStandaloneHostField, createEngineFieldBinding } from '@inkforge/editor-react/host';
test('HP01 unchanged parent field observation preserves local draft/history but invalidates old issued tickets', async () => {
  const codec = createEngineContentCodec(createContentProfile(), parseContentHtml),
    e = createEngine({
      document: createDocument([createParagraph([createText('base')])]),
      origin: 'persisted',
      instanceId: 'parent-observation',
      clock: () => 0,
    });
  const host = createStandaloneHostField({
    codec,
    html: '<p>base</p>',
    fieldBindingId: 'f',
    interactionContextKey: 'owner',
    isAuthorized: () => true,
  });
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: host,
    codec,
    surfaceStatus: () => ({ phase: 'ready', pending: false }),
  });
  const s = e.getSnapshot();
  e.dispatch({ kind: 'insertText', range: s.selection, text: 'local' }, { expected: s.token });
  const before = e.getSnapshot(),
    prepared = binding.prepareField();
  host.replace('<p>base</p>', 'ownerLoad');
  assert.equal(binding.isPreparedCurrent(prepared.field), false);
  assert.equal(e.getSnapshot(), before);
  assert.equal(e.getSnapshot().canUndo, true);
  assert.equal(binding.getStatus().localDirty, true);
  assert.equal((await binding.flush()).status, 'delivered');
  assert.equal(e.getSnapshot(), before);
  assert.equal(binding.getStatus().localDirty, false);
  assert.equal(e.getSnapshot().dirty, true);
});
