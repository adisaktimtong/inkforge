import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEditorEngine,
  createDocument,
  createParagraph,
  createText,
} from '../../packages/editor-core/dist/index.mjs';

const doc = (text) => createDocument([createParagraph([createText(text)])]);
const edit = (engine, text, extra = {}) =>
  engine.dispatch(
    { kind: 'replaceDocument', document: doc(text), ...extra },
    { expectedSessionId: engine.getSnapshot().sessionId },
  );
const command = (engine, kind) =>
  engine.dispatch({ kind }, { expectedSessionId: engine.getSnapshot().sessionId });
const checkpoint = (engine) => {
  const result = engine.createSaveCheckpoint();
  assert.equal(result.status, 'created');
  return result.checkpoint;
};

test('kernel runs without DOM/React, freezes isolated snapshots and ignores caller mutation', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  const input = doc('ไทย');
  const engine = createEditorEngine({ document: input });
  const first = engine.getSnapshot();
  input.children[0].children[0].text = 'mutated';
  assert.equal(first.document.children[0].children[0].text, 'ไทย');
  assert.equal(engine.getSnapshot(), first);
  assert.equal(first.dirty, false);
  assert.throws(() => {
    first.document.children.length = 0;
  }, TypeError);
});
test('atomic validation failure preserves document, revision, history and subscriber state', () => {
  const engine = createEditorEngine({ document: doc('A') });
  let calls = 0;
  engine.subscribe(() => calls++);
  const before = engine.getSnapshot();
  assert.equal(
    engine.dispatch(
      {
        kind: 'replaceDocument',
        document: { type: 'document', children: [{ type: 'heading', level: 9, children: [] }] },
      },
      { expectedSessionId: before.sessionId },
    ).status,
    'rejected',
  );
  assert.equal(engine.getSnapshot(), before);
  assert.equal(calls, 0);
});
test('undo/redo preserve semantic content while revision remains monotonic', () => {
  const engine = createEditorEngine({ document: doc('A') });
  edit(engine, 'B');
  edit(engine, 'C');
  command(engine, 'undo');
  const revision = engine.getSnapshot().revision;
  assert.equal(engine.getSnapshot().document.children[0].children[0].text, 'B');
  command(engine, 'redo');
  assert.ok(engine.getSnapshot().revision > revision);
  assert.equal(engine.getSnapshot().document.children[0].children[0].text, 'C');
});
test('typing groups close on selection/save boundaries and no-op preserves redo', () => {
  const engine = createEditorEngine({ document: doc('A') });
  edit(engine, 'AB', { historyGroup: 'typing' });
  edit(engine, 'ABC', { historyGroup: 'typing' });
  command(engine, 'undo');
  assert.equal(engine.getSnapshot().dirty, false);
  edit(engine, 'A');
  assert.equal(engine.getSnapshot().canRedo, true);
  command(engine, 'redo');
  checkpoint(engine);
  edit(engine, 'ABCD', { historyGroup: 'typing' });
  command(engine, 'undo');
  assert.equal(engine.getSnapshot().document.children[0].children[0].text, 'ABC');
});
test('save B while typing C acknowledges only B and undo back to B becomes clean', () => {
  const engine = createEditorEngine({ document: doc('A') });
  edit(engine, 'B');
  const b = checkpoint(engine);
  edit(engine, 'C');
  assert.equal(engine.acknowledgeSaved(b).status, 'committed');
  assert.equal(engine.getSnapshot().dirty, true);
  command(engine, 'undo');
  assert.equal(engine.getSnapshot().dirty, false);
});
test('late acknowledgment cannot move baseline backwards or accept a forged checkpoint', () => {
  const engine = createEditorEngine({ document: doc('A') });
  edit(engine, 'B');
  const b = checkpoint(engine);
  edit(engine, 'C');
  const c = checkpoint(engine);
  assert.equal(engine.acknowledgeSaved({ ...c }).diagnostics[0].code, 'UNKNOWN_CHECKPOINT');
  engine.acknowledgeSaved(c);
  assert.equal(engine.acknowledgeSaved(b).diagnostics[0].code, 'STALE_CHECKPOINT');
  assert.equal(engine.getSnapshot().dirty, false);
});
test('composition is a save/command barrier, not an intermediate persisted revision', () => {
  const engine = createEditorEngine({ document: doc('ก') });
  command(engine, 'beginComposition');
  assert.equal(engine.createSaveCheckpoint().diagnostics[0].code, 'COMPOSITION_ACTIVE');
  assert.equal(edit(engine, 'กา').diagnostics[0].code, 'COMPOSITION_ACTIVE');
  command(engine, 'endComposition');
  edit(engine, 'กา');
  assert.equal(engine.getSnapshot().revision, 1);
});
test('reload invalidates old session, async modal bookmarks and save acknowledgments', () => {
  const engine = createEditorEngine({ document: doc('A') });
  const old = engine.getSnapshot();
  const saved = checkpoint(engine);
  const bookmark = engine.captureSelection();
  engine.load(doc('other site'), { expectedSessionId: old.sessionId, origin: 'persisted' });
  assert.equal(
    engine.dispatch({ kind: 'undo' }, { expectedSessionId: old.sessionId }).diagnostics[0].code,
    'STALE_SESSION',
  );
  assert.equal(engine.restoreSelection(bookmark).diagnostics[0].code, 'STALE_BOOKMARK');
  assert.equal(engine.acknowledgeSaved(saved).diagnostics[0].code, 'STALE_SESSION');
});
test('modal result after intervening edit is rejected even in the same session', () => {
  const engine = createEditorEngine({ document: doc('A') });
  const bookmark = engine.captureSelection();
  edit(engine, 'B');
  assert.equal(engine.restoreSelection(bookmark).diagnostics[0].code, 'STALE_BOOKMARK');
});
test('history and pending checkpoint budgets fail safely', () => {
  const engine = createEditorEngine({
    document: doc('A'),
    maxHistoryEntries: 1,
    maxPendingCheckpoints: 1,
  });
  const cp = checkpoint(engine);
  assert.equal(engine.createSaveCheckpoint().diagnostics[0].code, 'CHECKPOINT_LIMIT_EXCEEDED');
  engine.releaseSaveCheckpoint(cp);
  checkpoint(engine);
  edit(engine, 'B');
  edit(engine, 'C');
  command(engine, 'undo');
  command(engine, 'undo');
  assert.equal(engine.getSnapshot().document.children[0].children[0].text, 'B');
});
test('subscriber exception does not roll back or skip later observers; reentrancy is refused', () => {
  const engine = createEditorEngine({ document: doc('A') });
  let called = false;
  engine.subscribe(() => {
    throw new Error('listener');
  });
  engine.subscribe(() => {
    called = true;
    assert.equal(edit(engine, 'reentrant').diagnostics[0].code, 'REENTRANT_MUTATION');
  });
  edit(engine, 'B');
  assert.equal(called, true);
  assert.equal(engine.getSnapshot().document.children[0].children[0].text, 'B');
});
test('unsaved origin starts dirty; host validator is atomic and disposal fences stale commands', () => {
  const engine = createEditorEngine({
    document: doc('A'),
    origin: 'unsaved',
    validate: (d) => (JSON.stringify(d).includes('blocked') ? [{ code: 'HOST_POLICY' }] : []),
  });
  assert.equal(engine.getSnapshot().dirty, true);
  assert.equal(edit(engine, 'blocked').diagnostics[0].code, 'HOST_POLICY');
  engine.dispose();
  assert.equal(edit(engine, 'B').diagnostics[0].code, 'DISPOSED');
});

test('selection is bounded by document semantics and undo restores both directional endpoints', () => {
  const engine = createEditorEngine({ document: doc('abc') });
  const select = (selection) =>
    engine.dispatch(
      { kind: 'setSelection', selection },
      { expectedSessionId: engine.getSnapshot().sessionId },
    );
  assert.equal(select({ anchor: 5, focus: 0 }).status, 'rejected');
  select({ anchor: 3, focus: 1 });
  edit(engine, 'abcd', { selection: { anchor: 4, focus: 4 } });
  command(engine, 'undo');
  assert.deepEqual(engine.getSnapshot().selection, { anchor: 3, focus: 1 });
  command(engine, 'redo');
  assert.deepEqual(engine.getSnapshot().selection, { anchor: 4, focus: 4 });
  edit(engine, '');
  assert.equal(engine.getSnapshot().selection, null);
  const { restoreSelection } = engine;
  assert.notEqual(restoreSelection(engine.captureSelection()).status, 'rejected');
});
