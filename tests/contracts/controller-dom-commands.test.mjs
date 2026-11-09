import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEngine,
  createDocument,
  createParagraph,
  createText,
} from '../../packages/editor-core/dist/index.mjs';
const document = () => createDocument([createParagraph([createText('abcdef')])]);
function setup() {
  const e = createEngine({
    document: document(),
    instanceId: 'atomic-input',
    origin: 'persisted',
    clock: () => 0,
  });
  const text = Object.values(e.getSnapshot().nodeIndex).find((v) => v.node.type === 'text').id;
  const r = {
    anchor: { nodeId: text, offset: 1, affinity: 'backward' },
    head: { nodeId: text, offset: 5, affinity: 'forward' },
  };
  e.setSelection(r, { expected: e.getSnapshot().token });
  return { e, r };
}
test('CC01 plaintext multiline insertion normalizes CRLF to model hard breaks in one transaction', () => {
  const { e, r } = setup();
  const result = e.dispatch(
    { kind: 'insertPlainText', range: r, text: 'one\r\ntwo\rthree' },
    { expected: e.getSnapshot().token },
  );
  assert.equal(result.status, 'committed');
  assert.equal(e.getSnapshot().revision, 1);
  assert.equal(
    e.getSnapshot().document.children[0].children.filter((n) => n.type === 'hard-break').length,
    2,
  );
  assert.equal(
    e.dispatch({ kind: 'undo' }, { expected: e.getSnapshot().token }).status,
    'committed',
  );
  assert.deepEqual(e.getSnapshot().document, document());
});
test('CC02 selected-range Enter deletes and splits atomically and restores the original selection', () => {
  const { e, r } = setup();
  const ids = Object.keys(e.getSnapshot().nodeIndex);
  assert.equal(
    e.dispatch({ kind: 'splitBlock', range: r }, { expected: e.getSnapshot().token }).status,
    'committed',
  );
  assert.equal(e.getSnapshot().revision, 1);
  assert.equal(e.getSnapshot().document.children.length, 2);
  e.dispatch({ kind: 'undo' }, { expected: e.getSnapshot().token });
  assert.deepEqual(e.getSnapshot().document, document());
  assert.deepEqual(e.getSnapshot().selection, r);
  assert.deepEqual(Object.keys(e.getSnapshot().nodeIndex), ids);
});
