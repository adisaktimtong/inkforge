import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEngine,
  createDocument,
  createParagraph,
  createHeading,
  createText,
  createLink,
  createHardBreak,
  createList,
  createListItem,
  mapPosition,
} from '../../packages/editor-core/dist/index.mjs';
let next = 0;
const doc = (text) => createDocument([createParagraph([createText(text)])]);
const make = (text = 'abcdef', extra = {}) =>
  createEngine({
    document: doc(text),
    instanceId: 'test-' + ++next,
    origin: 'persisted',
    clock: () => 0,
    ...extra,
  });
const ctx = (e, extra = {}) => ({ expected: e.getSnapshot().token, ...extra });
const nodes = (e, type) =>
  Object.values(e.getSnapshot().nodeIndex).filter((n) => n.node.type === type);
const tid = (e) => nodes(e, 'text')[0].id;
const pos = (id, offset, affinity = 'forward') => ({ nodeId: id, offset, affinity });
const range = (e, a, b = a) => ({ anchor: pos(tid(e), a), head: pos(tid(e), b) });
const run = (e, command, context = ctx(e)) => e.dispatch(command, context);
const ok = (result) => {
  assert.notEqual(result.status, 'rejected', JSON.stringify(result));
  return result;
};
const rejected = (result, code) => {
  assert.equal(result.status, 'rejected');
  assert.equal(result.diagnostics[0].code, code);
};
const at = (e, a, b = a) => ok(e.setSelection(range(e, a, b), ctx(e)));
const type = (e, text, extra = {}) =>
  ok(run(e, { kind: 'insertText', range: e.getSnapshot().selection, text, ...extra }));
const text = (e) =>
  (function visit(n) {
    return n.type === 'text'
      ? n.text
      : n.type === 'hard-break'
        ? '\n'
        : (n.children ?? n.items ?? []).map(visit).join('');
  })(e.getSnapshot().document);
const mark = (e, a, b, value = 'bold', kind = 'setMark') =>
  ok(run(e, { kind, range: range(e, a, b), mark: value }));
const bookmark = (e, context = ctx(e)) => {
  const r = e.captureBookmark(context);
  assert.equal(r.status, 'captured', JSON.stringify(r));
  return r.bookmark;
};
const checkpoint = (e, context = ctx(e)) => {
  const r = e.captureCheckpoint(context);
  assert.equal(r.status, 'captured', JSON.stringify(r));
  return r.checkpoint;
};

test('CB01 immutable isolated AST/index and no persisted runtime IDs', () => {
  const input = doc('ไทย');
  const e = make('', { document: input });
  const s = e.getSnapshot();
  input.children[0].children[0].text = 'changed';
  assert.equal(text(e), 'ไทย');
  assert.equal(e.getSnapshot(), s);
  assert(Object.isFrozen(s.document.children[0].children));
  assert(Object.isFrozen(s.nodeIndex));
  assert.equal(s.document.children[0].children[0].id, undefined);
  assert.equal(s.nodeIndex[tid(e)].node, s.document.children[0].children[0]);
  assert.equal(s.dirty, false);
  assert.throws(() => s.document.children.push({}), TypeError);
});
test('CB02 rejects cycles, shared nodes, accessors, invalid unicode and unknown fields before opening', () => {
  const sparse = new Array(1);
  sparse.extra = createParagraph([]);
  assert.throws(
    () => make('', { document: { type: 'document', children: sparse } }),
    /INVALID_CHILDREN/,
  );
  const sparseMarks = new Array(1);
  assert.throws(
    () =>
      make('', {
        document: createDocument([
          createParagraph([{ type: 'text', text: 'x', marks: sparseMarks }]),
        ]),
      }),
    /INVALID_MARKS/,
  );
  const shared = createText('a');
  const cycle = createDocument();
  cycle.children.push(cycle);
  for (const document of [
    cycle,
    createDocument([createParagraph([shared, shared])]),
    doc('\uD800'),
    { ...doc('x'), secret: true },
    createDocument([createParagraph([createLink('x', [createLink('y', [])])])]),
  ])
    assert.throws(() => make('', { document }));
  const node = createText('x');
  Object.defineProperty(node, 'text', {
    get() {
      throw Error('Must not execute');
    },
    enumerable: true,
  });
  assert.throws(
    () => make('', { document: createDocument([createParagraph([node])]) }),
    /MODEL_ACCESSOR/,
  );
});
test('CB03 finite validated config and explicit origin/clock', () => {
  for (const extra of [
    { origin: 'unknown' },
    { clock: null },
    { limits: { maxDepth: 0 } },
    { limits: { mystery: 1 } },
    { typingGapMs: Infinity },
    { mystery: true },
  ])
    assert.throws(() => make('x', extra));
  assert.equal(make('x', { origin: 'unsaved' }).getSnapshot().dirty, true);
});
test('CB04 user selection changes epoch/state once without content revision or dirty', () => {
  const e = make();
  let events = 0;
  e.subscribe(() => events++);
  const s = e.getSnapshot();
  at(e, 4, 1);
  assert.equal(e.getSnapshot().revision, 0);
  assert.equal(e.getSnapshot().selectionEpoch, s.selectionEpoch + 1);
  assert.equal(events, 1);
  assert.equal(e.getSnapshot().dirty, false);
  const selected = e.getSnapshot();
  at(e, 4, 1);
  assert.equal(e.getSnapshot(), selected);
});
test('CB05 invalid/surrogate/atomic positions reject without publishing', () => {
  const e = make('a😀b');
  const s = e.getSnapshot();
  for (const p of [
    pos(tid(e), 2),
    pos('foreign', 0),
    pos(tid(e), -1),
    pos(tid(e), 99),
    pos(tid(e), 1, 'bad'),
  ])
    rejected(e.setSelection({ anchor: p, head: p }, ctx(e)), 'INVALID_POSITION');
  assert.equal(e.getSnapshot(), s);
});
test('CB06 insert text is granular with stable identity, one revision and exact inverse', () => {
  const e = make('ab');
  at(e, 1);
  const id = tid(e),
    before = e.getSnapshot();
  const result = type(e, 'ไทย😀');
  assert.equal(text(e), 'aไทย😀b');
  assert.equal(tid(e), id);
  assert.equal(e.getSnapshot().revision, 1);
  assert.equal(e.getSnapshot().selectionEpoch, before.selectionEpoch);
  assert.equal(result.mapping.steps[0].kind, 'insertText');
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'ab');
  assert.equal(tid(e), id);
  assert.equal(e.getSnapshot().dirty, false);
  ok(run(e, { kind: 'redo' }));
  assert.equal(text(e), 'aไทย😀b');
  assert.equal(e.getSnapshot().revision, 3);
});
test('CB07 empty-document typing creates a schema-valid paragraph without changing constructors', () => {
  const e = make('', { document: createDocument() });
  type(e, 'hello');
  assert.equal(text(e), 'hello');
  assert.equal(nodes(e, 'paragraph').length, 1);
  ok(run(e, { kind: 'undo' }));
  assert.deepEqual(e.getSnapshot().document, createDocument());
});
test('CB08 backward selected replacement is atomic and collapses at the inserted text end', () => {
  const e = make();
  at(e, 5, 1);
  type(e, 'XY');
  assert.equal(text(e), 'aXYf');
  assert.equal(e.getSnapshot().selection.anchor.offset, 3);
  ok(run(e, { kind: 'undo' }));
  assert.deepEqual(e.getSnapshot().selection, range(e, 5, 1));
  assert.equal(text(e), 'abcdef');
});
test('CB09 range mark splits retain left ID and undo/redo restore exact logical identities', () => {
  const e = make();
  at(e, 4, 1);
  const original = tid(e);
  mark(e, 1, 4);
  const firstIds = nodes(e, 'text').map((n) => n.id);
  assert.equal(firstIds[0], original);
  assert.deepEqual(
    nodes(e, 'text').map((n) => [n.node.text, n.node.marks ?? []]),
    [
      ['a', []],
      ['bcd', ['bold']],
      ['ef', []],
    ],
  );
  assert.equal(e.getSnapshot().selection.anchor.nodeId, firstIds[2]);
  ok(run(e, { kind: 'undo' }));
  assert.equal(tid(e), original);
  assert.equal(nodes(e, 'text').length, 1);
  ok(run(e, { kind: 'redo' }));
  assert.deepEqual(
    nodes(e, 'text').map((n) => n.id),
    firstIds,
  );
});
test('CB10 clearing marks normalizes equal text and maps the removed right ID', () => {
  const e = make('', {
    document: createDocument([createParagraph([createText('ab'), createText('cd', ['bold'])])]),
  });
  const right = nodes(e, 'text')[1].id,
    r = { anchor: pos(right, 0), head: pos(right, 2) };
  const result = ok(run(e, { kind: 'clearMark', range: r, mark: 'bold' }));
  assert.equal(nodes(e, 'text').length, 1);
  assert.deepEqual(mapPosition(pos(right, 1), result.mapping.steps), pos(tid(e), 3));
});
test('CB11 stored marks/collapsed mark intent are transient, then type into model marks', () => {
  const e = make('ab');
  at(e, 1);
  const rev = e.getSnapshot().revision;
  mark(e, 1, 1);
  assert.equal(e.getSnapshot().revision, rev);
  assert.equal(e.getSnapshot().dirty, false);
  assert.equal(e.getSnapshot().canUndo, false);
  type(e, 'X');
  assert.deepEqual(
    nodes(e, 'text').map((n) => [n.node.text, n.node.marks ?? []]),
    [
      ['a', []],
      ['X', ['bold']],
      ['b', []],
    ],
  );
});
test('CB12 noChange and rejected edits preserve exact snapshot and redo', () => {
  const e = make();
  at(e, 2);
  type(e, 'X');
  ok(run(e, { kind: 'undo' }));
  const s = e.getSnapshot();
  assert.equal(type(e, '').status, 'noChange');
  rejected(run(e, { kind: 'replaceDocument', document: doc('bad') }), 'UNSUPPORTED_COMMAND');
  assert.equal(e.getSnapshot(), s);
  assert.equal(s.canRedo, true);
});
test('CB13 partial multi-target block edits reject as one whole transaction', () => {
  const e = make();
  const s = e.getSnapshot();
  let calls = 0;
  e.subscribe(() => calls++);
  rejected(
    run(e, {
      kind: 'setBlockType',
      blocks: [nodes(e, 'paragraph')[0].id, 'missing'],
      type: 'heading',
      level: 2,
    }),
    'UNKNOWN_NODE',
  );
  assert.equal(e.getSnapshot(), s);
  assert.equal(calls, 0);
});
test('CB14 block type changes preserve descendants and inverse restores schema fields', () => {
  const e = make();
  const paragraph = nodes(e, 'paragraph')[0].id,
    id = tid(e);
  ok(run(e, { kind: 'setBlockType', blocks: [paragraph], type: 'heading', level: 3 }));
  assert.equal(nodes(e, 'heading')[0].id, paragraph);
  assert.equal(tid(e), id);
  ok(run(e, { kind: 'undo' }));
  assert.equal(nodes(e, 'paragraph')[0].node.level, undefined);
});
test('CB15 split and join text blocks preserve descendant IDs and junction caret', () => {
  const e = make('abcd');
  at(e, 2);
  ok(run(e, { kind: 'splitBlock', at: e.getSnapshot().selection.anchor }));
  const blocks = nodes(e, 'paragraph');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].node.children[0].text, 'ab');
  assert.equal(blocks[1].node.children[0].text, 'cd');
  ok(run(e, { kind: 'joinBlocks', leftBlockId: blocks[0].id, rightBlockId: blocks[1].id }));
  assert.equal(text(e), 'abcd');
  assert.equal(e.getSnapshot().selection.anchor.nodeId, tid(e));
  assert.equal(e.getSnapshot().selection.anchor.offset, 2);
  ok(run(e, { kind: 'undo' }));
  assert.deepEqual(
    nodes(e, 'paragraph').map((n) => n.id),
    blocks.map((n) => n.id),
  );
});
test('CB16 heading-end Enter creates a paragraph and undo restores original IDs', () => {
  const e = make('', { document: createDocument([createHeading(2, [createText('abc')])]) });
  at(e, 3);
  const id = tid(e);
  ok(run(e, { kind: 'splitBlock', at: e.getSnapshot().selection.anchor }));
  assert.equal(nodes(e, 'heading').length, 1);
  assert.equal(nodes(e, 'paragraph').length, 1);
  ok(run(e, { kind: 'undo' }));
  assert.equal(nodes(e, 'paragraph').length, 0);
  assert.equal(tid(e), id);
});
test('CB17 hard-break insertion and deletion are one reversible command each', () => {
  const e = make('abcd');
  at(e, 2);
  ok(run(e, { kind: 'insertHardBreak', range: e.getSnapshot().selection }));
  assert.equal(text(e), 'ab\ncd');
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'abcd');
  ok(run(e, { kind: 'redo' }));
  assert.equal(text(e), 'ab\ncd');
});
test('CB18 mixed structural replacement refuses to flatten unsupported list content', () => {
  const e = make('', {
    document: createDocument([
      createParagraph([createText('a')]),
      createList(false, [createListItem([createParagraph([createText('b')])])]),
    ]),
  });
  const ids = nodes(e, 'text').map((n) => n.id),
    s = e.getSnapshot();
  rejected(
    run(e, {
      kind: 'insertText',
      range: { anchor: pos(ids[0], 0), head: pos(ids[1], 1) },
      text: 'X',
    }),
    'UNSUPPORTED_CROSS_BLOCK_RANGE',
  );
  assert.equal(e.getSnapshot(), s);
});
test('CB19 grapheme deletion uses explicit segmentation, preserving emoji and Thai clusters', () => {
  const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });
  const e = make('Aก้👩‍👩‍👧‍👦B', {
    segmentation: {
      locale: 'th',
      fingerprint: 'test-intl/' + process.versions.icu,
      boundaries: (value) => [
        ...Array.from(segmenter.segment(value), (s) => s.index),
        value.length,
      ],
    },
  });
  at(e, text(e).length - 1);
  ok(run(e, { kind: 'deleteBackward', range: e.getSnapshot().selection, unit: 'grapheme' }));
  assert.equal(text(e), 'Aก้B');
  ok(run(e, { kind: 'deleteBackward', range: e.getSnapshot().selection, unit: 'grapheme' }));
  assert.equal(text(e), 'AB');
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'Aก้👩‍👩‍👧‍👦B');
  ok(run(e, { kind: 'redo' }));
  assert.equal(text(e), 'AB');
});
test('CB20 unavailable, malformed, throwing and surrogate-splitting segmentation never falls back', () => {
  for (const boundaries of [
    null,
    () => [0, 2, 4],
    () => [0, 3, 1, 4],
    () => {
      throw Error('bad');
    },
    () => Promise.reject(Error('async segmentation')),
  ]) {
    const e = make(
      'a😀b',
      boundaries ? { segmentation: { locale: 'th', fingerprint: 'bad', boundaries } } : {},
    );
    at(e, 3);
    const s = e.getSnapshot();
    assert.equal(
      run(e, { kind: 'deleteBackward', range: s.selection, unit: 'grapheme' }).status,
      'rejected',
    );
    assert.equal(e.getSnapshot(), s);
  }
});
test('CB21 opaque tokens reject JSON copies and other controllers with identical diagnostic IDs', () => {
  const a = make('a', { instanceId: 'same' }),
    b = make('b', { instanceId: 'same' });
  rejected(a.setSelection(null, { expected: b.getSnapshot().token }), 'INVALID_CONTROLLER_TOKEN');
  rejected(
    a.setSelection(null, { expected: { ...a.getSnapshot().token } }),
    'INVALID_CONTROLLER_TOKEN',
  );
});
test('CB22 bookmark restore preserves selectionEpoch and repeated restore is idempotent', () => {
  const e = make();
  at(e, 2, 4);
  const b = bookmark(e),
    s = e.getSnapshot();
  assert.equal(e.restoreBookmark(b, ctx(e)).status, 'noChange');
  assert.equal(e.getSnapshot(), s);
  ok(run(e, { kind: 'setMark', range: b.selection, mark: 'bold' }, ctx(e, { bookmark: b })));
  assert.equal(e.getSnapshot().selectionEpoch, s.selectionEpoch);
});
test('CB23 old selection, old revision and released bookmarks are rejected without restamping', () => {
  const e = make();
  at(e, 1);
  const b = bookmark(e);
  at(e, 2);
  rejected(e.restoreBookmark(b, ctx(e)), 'STALE_BOOKMARK');
  const c = bookmark(e);
  type(e, 'x');
  rejected(e.restoreBookmark(c, ctx(e)), 'STALE_BOOKMARK');
  const d = bookmark(e);
  e.releaseBookmark(d);
  rejected(e.restoreBookmark(d, ctx(e)), 'STALE_BOOKMARK');
});
test('CB24 foreign and forged bookmarks fail even if metadata matches exactly', () => {
  const a = make(),
    b = make();
  const bm = bookmark(a);
  rejected(b.restoreBookmark(bm, ctx(b)), 'INVALID_BOOKMARK');
  rejected(a.restoreBookmark({ ...bm }, ctx(a)), 'INVALID_BOOKMARK');
});
test('CB25 original host fence is retained; a fresh ticket cannot revive an old bookmark', () => {
  const e = make();
  at(e, 1);
  let current = 'old';
  const fence = { reference: 'old', isCurrent: (ref) => ref === current };
  const b = bookmark(e, ctx(e, { fence }));
  current = 'new';
  fence.reference = 'new';
  const s = e.getSnapshot();
  rejected(
    e.restoreBookmark(b, ctx(e, { fence: { reference: 'new', isCurrent: () => true } })),
    'STALE_HOST_FENCE',
  );
  assert.equal(e.getSnapshot(), s);
});
test('CB26 last fence check occurs after validation and rejection is atomic', () => {
  let valid = true,
    armed = false;
  const e = make('abc', {
    validate: () => {
      if (armed) valid = false;
      return [];
    },
  });
  at(e, 1);
  const s = e.getSnapshot();
  armed = true;
  rejected(
    run(
      e,
      { kind: 'insertText', range: s.selection, text: 'X' },
      ctx(e, { fence: { reference: 'ticket', isCurrent: () => valid } }),
    ),
    'STALE_HOST_FENCE',
  );
  assert.equal(e.getSnapshot(), s);
});
test('CB27 validator/reentrant subscriber failures cannot partially commit or roll back accepted content', () => {
  let e,
    armed = false,
    nested;
  e = make('abc', {
    validate: () => {
      if (armed) nested = e.setSelection(null, ctx(e));
      return [];
    },
  });
  e.subscribe(() => {
    throw Error('observer');
  });
  at(e, 1);
  armed = true;
  type(e, 'x');
  rejected(nested, 'REENTRANT_OPERATION');
  assert.equal(text(e), 'axbc');
});
test('CB28 validators are synchronous, frozen and policy rejection preserves the exact snapshot', () => {
  let armed = false;
  const e = make('abc', {
    validate: (input) => {
      assert(Object.isFrozen(input));
      return armed ? [{ code: 'POLICY' }] : [];
    },
  });
  at(e, 1);
  const s = e.getSnapshot();
  armed = true;
  rejected(run(e, { kind: 'insertText', range: s.selection, text: 'x' }), 'POLICY');
  assert.equal(e.getSnapshot(), s);
  assert.throws(() => make('', { validate: async () => [] }), /INVALID_VALIDATOR_RESULT/);
});
test('CB29 typing groups include 1000ms boundary and close after 1001ms or a save barrier', () => {
  let now = 0;
  const e = make('', { clock: () => now });
  at(e, 0);
  type(e, 'A', { typing: true });
  now = 1000;
  type(e, 'B', { typing: true });
  now = 2001;
  type(e, 'C', { typing: true });
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'AB');
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), '');
  type(e, 'D', { typing: true });
  checkpoint(e);
  type(e, 'E', { typing: true });
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'D');
});
test('CB30 history group operation bounds retain usable undo rather than a false canUndo', () => {
  const e = make('', { limits: { maxOperations: 3 } });
  at(e, 0);
  for (const c of 'abcdefghij') type(e, c, { typing: true });
  while (e.getSnapshot().canUndo) ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), '');
});
test('CB31 too-large history/document/operation/normalization candidates reject before publication', () => {
  const e = make('a', { limits: { maxHistoryBytes: 1 } });
  at(e, 1);
  const s = e.getSnapshot();
  rejected(run(e, { kind: 'insertText', range: s.selection, text: 'x' }), 'HISTORY_BYTES');
  assert.equal(e.getSnapshot(), s);
  const limited = make('a', { limits: { maxTextUtf16: 2 } });
  at(limited, 1);
  const before = limited.getSnapshot();
  rejected(
    run(limited, { kind: 'insertText', range: before.selection, text: 'long' }),
    'TEXT_LIMIT',
  );
  assert.equal(limited.getSnapshot(), before);
  const operations = make('abcdef', { limits: { maxOperations: 1 } });
  const os = operations.getSnapshot();
  rejected(
    run(operations, { kind: 'setMark', range: range(operations, 1, 4), mark: 'bold' }),
    'OPERATION_LIMIT',
  );
  assert.equal(operations.getSnapshot(), os);
  const normalization = make('', {
    document: createDocument([createParagraph([createText('ab'), createText('cd', ['bold'])])]),
    limits: { maxNormalizationPasses: 1 },
  });
  const n = nodes(normalization, 'text')[1],
    ns = normalization.getSnapshot();
  rejected(
    run(normalization, {
      kind: 'clearMark',
      range: { anchor: pos(n.id, 0), head: pos(n.id, 2) },
      mark: 'bold',
    }),
    'NORMALIZATION_LIMIT',
  );
  assert.equal(normalization.getSnapshot(), ns);
  const documentBytes = make('a', {
    limits: { maxDocumentBytes: JSON.stringify(doc('a')).length + 2 },
  });
  at(documentBytes, 1);
  const ds = documentBytes.getSnapshot();
  rejected(
    run(documentBytes, { kind: 'insertText', range: ds.selection, text: 'too long' }),
    'DOCUMENT_BYTES',
  );
  assert.equal(documentBytes.getSnapshot(), ds);
  const checkpoints = make('a', { limits: { maxCheckpointBytes: 1 } });
  rejected(checkpoints.captureCheckpoint(ctx(checkpoints)), 'CHECKPOINT_BYTES');
});
test('CB32 exact checkpoint B acknowledged while C stays dirty, and undo to B becomes clean', () => {
  const e = make('A');
  at(e, 1);
  type(e, 'B');
  const b = checkpoint(e);
  type(e, 'C');
  ok(e.acknowledgeCheckpoint(b, ctx(e)));
  assert.equal(e.getSnapshot().dirty, true);
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'AB');
  assert.equal(e.getSnapshot().dirty, false);
  rejected(e.acknowledgeCheckpoint(b, ctx(e)), 'STALE_CHECKPOINT');
});
test('CB33 forged/released/older checkpoint cannot replace a newer saved witness', () => {
  const e = make();
  const a = checkpoint(e);
  at(e, 1);
  type(e, 'x');
  const b = checkpoint(e);
  ok(e.acknowledgeCheckpoint(b, ctx(e)));
  rejected(e.acknowledgeCheckpoint(a, ctx(e)), 'STALE_CHECKPOINT');
  rejected(e.acknowledgeCheckpoint({ ...b }, ctx(e)), 'INVALID_CHECKPOINT');
  const c = checkpoint(e);
  e.releaseCheckpoint(c);
  rejected(e.acknowledgeCheckpoint(c, ctx(e)), 'STALE_CHECKPOINT');
});
test('CB34 bounded bookmark/checkpoint ledgers release capacity and fence saved witnesses', () => {
  let current = true;
  const e = make('', { limits: { maxBookmarks: 1, maxCheckpoints: 1 } });
  const b = bookmark(e);
  rejected(e.captureBookmark(ctx(e)), 'BOOKMARK_LIMIT');
  e.releaseBookmark(b);
  bookmark(e);
  const cp = checkpoint(e, ctx(e, { fence: { reference: 'old', isCurrent: () => current } }));
  rejected(e.captureCheckpoint(ctx(e)), 'CHECKPOINT_LIMIT');
  current = false;
  rejected(e.acknowledgeCheckpoint(cp, ctx(e)), 'STALE_HOST_FENCE');
  e.releaseCheckpoint(cp);
  checkpoint(e);
});
test('CB35 composition keeps the committed model stable, blocks actions and commits once', () => {
  const e = make('ab');
  at(e, 1);
  const document = e.getSnapshot().document;
  ok(run(e, { kind: 'beginComposition', compositionId: 'ime-1' }));
  assert.equal(e.getSnapshot().document, document);
  rejected(e.captureCheckpoint(ctx(e)), 'COMPOSITION_ACTIVE');
  rejected(e.captureBookmark(ctx(e)), 'COMPOSITION_ACTIVE');
  rejected(run(e, { kind: 'undo' }), 'COMPOSITION_ACTIVE');
  ok(run(e, { kind: 'commitComposition', compositionId: 'ime-1', text: 'ไทย' }));
  assert.equal(text(e), 'aไทยb');
  assert.equal(e.getSnapshot().revision, 1);
  rejected(
    run(e, { kind: 'commitComposition', compositionId: 'ime-1', text: 'duplicate' }),
    'STALE_COMPOSITION',
  );
  ok(run(e, { kind: 'undo' }));
  assert.equal(text(e), 'ab');
});
test('CB36 canceled/empty composition has no content revision or phantom history', () => {
  const e = make();
  at(e, 1);
  ok(run(e, { kind: 'beginComposition', compositionId: 'x' }));
  ok(run(e, { kind: 'cancelComposition', compositionId: 'x' }));
  assert.equal(e.getSnapshot().canUndo, false);
  assert.equal(e.getSnapshot().dirty, false);
  ok(run(e, { kind: 'beginComposition', compositionId: 'y' }));
  ok(run(e, { kind: 'commitComposition', compositionId: 'y', text: '' }));
  assert.equal(e.getSnapshot().revision, 0);
  assert.equal(e.getSnapshot().canUndo, false);
});
test('CB37 old composition callbacks cannot target a later reused ID', () => {
  const e = make();
  at(e, 1);
  ok(run(e, { kind: 'beginComposition', compositionId: 'same' }));
  const old = ctx(e);
  ok(run(e, { kind: 'cancelComposition', compositionId: 'same' }));
  ok(run(e, { kind: 'beginComposition', compositionId: 'same' }));
  const s = e.getSnapshot();
  rejected(
    run(e, { kind: 'commitComposition', compositionId: 'same', text: 'bad' }, old),
    'STALE_COMPOSITION',
  );
  assert.equal(e.getSnapshot(), s);
});
test('CB38 original composition fence is checked again and invalid draft stays pending', () => {
  let valid = true;
  const e = make();
  at(e, 1);
  ok(
    run(
      e,
      { kind: 'beginComposition', compositionId: 'x' },
      ctx(e, { fence: { reference: 'old', isCurrent: () => valid } }),
    ),
  );
  valid = false;
  const s = e.getSnapshot();
  rejected(
    run(
      e,
      { kind: 'commitComposition', compositionId: 'x', text: 'bad' },
      ctx(e, { fence: { reference: 'fresh', isCurrent: () => true } }),
    ),
    'STALE_HOST_FENCE',
  );
  assert.equal(e.getSnapshot(), s);
  assert.equal(s.composing, true);
});
test('CB39 external load opens a fresh session and unsaved load preserves saved baseline', () => {
  const e = make('A');
  const s = e.getSnapshot(),
    b = bookmark(e),
    cp = checkpoint(e);
  ok(e.loadExternal(doc('B'), 'unsaved', ctx(e)));
  assert.notEqual(e.getSnapshot().sessionId, s.sessionId);
  assert.equal(e.getSnapshot().revision, 0);
  assert(e.getSnapshot().stateVersion > s.stateVersion);
  assert.equal(e.getSnapshot().dirty, true);
  rejected(e.restoreBookmark(b, ctx(e)), 'STALE_BOOKMARK');
  rejected(e.acknowledgeCheckpoint(cp, ctx(e)), 'STALE_CHECKPOINT');
  ok(e.loadExternal(doc('A'), 'unsaved', ctx(e)));
  assert.equal(e.getSnapshot().dirty, false);
});
test('CB40 readonly transitions invalidate armed tools without dropping a composition', () => {
  const e = make();
  const b = bookmark(e);
  ok(e.setReadOnly(true, ctx(e)));
  rejected(run(e, { kind: 'undo' }), 'READ_ONLY');
  ok(e.setReadOnly(false, ctx(e)));
  rejected(e.restoreBookmark(b, ctx(e)), 'STALE_BOOKMARK');
  ok(run(e, { kind: 'beginComposition', compositionId: 'x' }));
  ok(e.setReadOnly(true, ctx(e)));
  assert.equal(e.getSnapshot().composing, true);
});
test('CB41 terminal disposal clears owned protected state and suppresses revival/callbacks', () => {
  const e = make('protected');
  const b = bookmark(e);
  let calls = 0;
  const stop = e.subscribe(() => calls++);
  ok(e.dispose());
  const s = e.getSnapshot();
  assert.deepEqual(s.document, createDocument());
  assert.equal(s.selection, null);
  assert.equal(s.dirty, false);
  assert.equal(calls, 1);
  assert.equal(e.dispose().status, 'noChange');
  rejected(e.restoreBookmark(b, ctx(e)), 'DISPOSED');
  assert.equal(calls, 1);
  stop();
  stop();
});
test('CB42 randomized text replacement/undo/redo matches a separate string oracle over 500 edits', () => {
  let seed = 1729;
  const random = (max) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  const e = make('abc', { limits: { maxHistoryEntries: 1000 } });
  let expected = 'abc';
  for (let i = 0; i < 500; i++) {
    const a = random(expected.length + 1),
      b = random(expected.length + 1),
      insert = ['x', 'ไทย', '', 'Z'][random(4)];
    at(e, a, b);
    const before = expected;
    type(e, insert);
    expected = before.slice(0, Math.min(a, b)) + insert + before.slice(Math.max(a, b));
    assert.equal(text(e), expected);
    if (expected !== before) {
      ok(run(e, { kind: 'undo' }));
      assert.equal(text(e), before);
      ok(run(e, { kind: 'redo' }));
      assert.equal(text(e), expected);
    }
    for (const n of nodes(e, 'text')) assert.equal(e.getSnapshot().nodeIndex[n.id].node, n.node);
  }
});

test('CB43 cross-block replacement preserves untouched descendants and undo restores every original ID', () => {
  const original = createDocument([
    createParagraph([createText('abcd')]),
    createParagraph([createText('middle')]),
    createParagraph([createText('WXYZ')]),
  ]);
  const e = make('', { document: original });
  const ids = Object.keys(e.getSnapshot().nodeIndex),
    texts = nodes(e, 'text');
  const r = { anchor: pos(texts[0].id, 2), head: pos(texts[2].id, 2) };
  ok(e.setSelection(r, ctx(e)));
  type(e, 'ไทย');
  assert.equal(text(e), 'abไทยYZ');
  assert.equal(nodes(e, 'paragraph').length, 1);
  ok(run(e, { kind: 'undo' }));
  assert.deepEqual(e.getSnapshot().document, original);
  assert.deepEqual(Object.keys(e.getSnapshot().nodeIndex), ids);
  assert.deepEqual(e.getSnapshot().selection, r);
  ok(run(e, { kind: 'redo' }));
  assert.equal(text(e), 'abไทยYZ');
});
test('CB44 splitting inside a link preserves href, marks and logical descendant lineage', () => {
  const original = createDocument([
    createParagraph([createLink('https://example.test', [createText('abcd', ['italic'])])]),
  ]);
  const e = make('', { document: original });
  at(e, 2);
  const ids = Object.keys(e.getSnapshot().nodeIndex);
  ok(run(e, { kind: 'splitBlock', at: e.getSnapshot().selection.anchor }));
  assert.equal(nodes(e, 'paragraph').length, 2);
  assert.deepEqual(
    nodes(e, 'link').map((n) => n.node.href),
    ['https://example.test', 'https://example.test'],
  );
  assert.deepEqual(
    nodes(e, 'text').map((n) => [n.node.text, n.node.marks]),
    [
      ['ab', ['italic']],
      ['cd', ['italic']],
    ],
  );
  ok(run(e, { kind: 'undo' }));
  assert.deepEqual(e.getSnapshot().document, original);
  assert.deepEqual(Object.keys(e.getSnapshot().nodeIndex), ids);
});
test('CB45 word-delete, forward-delete and block-boundary join use the same semantic history owner', () => {
  const e = make('one two', {
    segmentation: { locale: 'en', fingerprint: 'explicit-words/v1', boundaries: () => [0, 4, 7] },
  });
  at(e, 4);
  ok(run(e, { kind: 'deleteForward', range: e.getSnapshot().selection, unit: 'word' }));
  assert.equal(text(e), 'one ');
  const blocks = make('', {
    document: createDocument([
      createParagraph([createText('ab')]),
      createParagraph([createText('cd')]),
    ]),
  });
  at(blocks, 2);
  ok(
    run(blocks, { kind: 'deleteForward', range: blocks.getSnapshot().selection, unit: 'grapheme' }),
  );
  assert.equal(text(blocks), 'abcd');
  assert.equal(blocks.getSnapshot().selection.anchor.offset, 2);
});
test('CB46 monotonic-clock failure and async fences reject before mutation', () => {
  let time = 10;
  const e = make('a', { clock: () => time });
  at(e, 1);
  type(e, 'x');
  const s = e.getSnapshot();
  time = 9;
  rejected(
    run(e, { kind: 'insertText', range: s.selection, text: 'y' }),
    'INVALID_MONOTONIC_CLOCK',
  );
  assert.equal(e.getSnapshot(), s);
  rejected(
    e.captureBookmark(ctx(e, { fence: { reference: 'x', isCurrent: async () => true } })),
    'STALE_HOST_FENCE',
  );
});
const vectors = [
  {
    id: 'IE-V01',
    step: { kind: 'insertText', nodeId: 't1', offset: 1, length: 2 },
    input: [pos('t1', 1, 'backward'), pos('t1', 1), pos('t1', 2)],
    expected: [pos('t1', 1, 'backward'), pos('t1', 3), pos('t1', 4)],
  },
  {
    id: 'IE-V02',
    step: { kind: 'insertText', nodeId: 't1', offset: 1, length: '😀'.length },
    input: [pos('t1', 1), pos('t1', 2)],
    expected: [pos('t1', 3), pos('t1', 4)],
  },
  {
    id: 'IE-V03',
    step: { kind: 'deleteText', nodeId: 't1', from: 1, to: 4 },
    input: [pos('t1', 0), pos('t1', 2, 'backward'), pos('t1', 4), pos('t1', 5)],
    expected: [pos('t1', 0), pos('t1', 1, 'backward'), pos('t1', 1), pos('t1', 2)],
  },
  {
    id: 'IE-V04',
    step: { kind: 'splitText', leftId: 't1', rightId: 't2', offset: 2, parentId: 'p', index: 0 },
    input: [pos('t1', 2, 'backward'), pos('t1', 2), pos('t1', 4)],
    expected: [pos('t1', 2, 'backward'), pos('t2', 0), pos('t2', 2)],
  },
  {
    id: 'IE-V05',
    step: { kind: 'joinText', leftId: 't1', rightId: 't2', leftLength: 2, parentId: 'p', index: 0 },
    input: [pos('t1', 1), pos('t2', 0), pos('t2', 2)],
    expected: [pos('t1', 1), pos('t1', 2), pos('t1', 4)],
  },
  {
    id: 'IE-V06',
    step: { kind: 'insertText', nodeId: 't1', offset: 2, length: 1 },
    input: [pos('t1', 2)],
    expected: [pos('t1', 3)],
  },
];
for (const vector of vectors)
  test(vector.id + ' normative position mapping', () =>
    assert.deepEqual(
      vector.input.map((p) => mapPosition(p, [vector.step])),
      vector.expected,
    ),
  );
test('CB47 container boundaries map through text split/join without changing their semantic extent', () => {
  const split = {
    kind: 'splitText',
    leftId: 'a',
    rightId: 'b',
    offset: 2,
    parentId: 'p',
    index: 0,
  };
  assert.deepEqual(mapPosition(pos('p', 1, 'backward'), [split]), pos('p', 2, 'backward'));
  const join = {
    kind: 'joinText',
    leftId: 'a',
    rightId: 'b',
    leftLength: 2,
    parentId: 'p',
    index: 0,
  };
  assert.deepEqual(mapPosition(pos('p', 1), [join]), pos('a', 2));
});

test('CB48 randomized formatting maps match a per-character mark oracle and restore exact IDs', () => {
  const e = make('abcdefgh');
  let expected = Array.from('abcdefgh', () => false),
    seed = 91;
  const random = (max) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % max;
  };
  const p = (offset) => {
    let rest = offset;
    for (const n of nodes(e, 'text')) {
      if (rest <= n.node.text.length) return pos(n.id, rest);
      rest -= n.node.text.length;
    }
    throw Error('Bad independent oracle offset');
  };
  for (let i = 0; i < 150; i++) {
    const a = random(8),
      b = a + 1 + random(8 - a),
      set = random(2) === 0;
    const r = { anchor: p(i % 2 ? b : a), head: p(i % 2 ? a : b) };
    ok(e.setSelection(r, ctx(e)));
    const before = e.getSnapshot();
    ok(run(e, { kind: set ? 'setMark' : 'clearMark', range: r, mark: 'bold' }));
    expected = expected.map((v, index) => (index >= a && index < b ? set : v));
    assert.deepEqual(
      nodes(e, 'text').flatMap((n) =>
        Array.from(n.node.text, () => n.node.marks?.includes('bold') ?? false),
      ),
      expected,
    );
    if (e.getSnapshot().revision !== before.revision) {
      const after = e.getSnapshot();
      ok(run(e, { kind: 'undo' }));
      assert.deepEqual(e.getSnapshot().document, before.document);
      assert.deepEqual(Object.keys(e.getSnapshot().nodeIndex), Object.keys(before.nodeIndex));
      ok(run(e, { kind: 'redo' }));
      assert.deepEqual(e.getSnapshot().document, after.document);
      assert.deepEqual(Object.keys(e.getSnapshot().nodeIndex), Object.keys(after.nodeIndex));
    }
  }
});
