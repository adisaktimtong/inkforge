import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createEngine,
  createDocument,
  createParagraph,
  createText,
  createHeading,
  createList,
  createListItem,
  createLink,
} from '@inkforge/editor-core';
import { createContentProfile } from '@inkforge/editor-html';
import { parseContentHtml } from '@inkforge/editor-html/server';
import { createEngineContentCodec } from '@inkforge/editor-html/engine';
import { createEngineFieldBinding, createStandaloneHostField } from '@inkforge/editor-react/host';
import { createCore } from '@pagebuilder/headless/core';
import { builtInDefinitions, demoSiteConfiguration } from '@pagebuilder/headless/definitions';
import { createBoundFieldPort } from '@pagebuilder/headless/editor/field-binding';
let serial = 0;
const codec = createEngineContentCodec(
  createContentProfile({ tokenClasses: ['rte-accent'], routeKeys: ['home'] }),
  parseContentHtml,
);
const ready = () => ({ phase: 'ready', pending: false });
const make = (html = '<p>base</p>') => {
  const d = codec.decode(html);
  assert.equal(d.status, 'accepted', JSON.stringify(d));
  return createEngine({
    document: d.document,
    origin: 'persisted',
    instanceId: `host-${++serial}`,
    clock: () => 0,
  });
};
const type = (e, text) => {
  const s = e.getSnapshot(),
    r = e.dispatch({ kind: 'insertText', range: s.selection, text }, { expected: s.token });
  assert.notEqual(r.status, 'rejected', JSON.stringify(r));
};
function standalone(extra = {}) {
  const e = make(),
    host = createStandaloneHostField({
      codec,
      fieldBindingId: `standalone-${serial}`,
      interactionContextKey: 'owner-a',
      html: '<p>base</p>',
      isAuthorized: () => true,
      ...extra,
    });
  return {
    e,
    host,
    binding: createEngineFieldBinding({
      controller: e,
      hostField: host,
      codec,
      surfaceStatus: ready,
    }),
  };
}
function builder() {
  const def = {
    type: 'cms.richText',
    version: 1,
    capabilities: [],
    slots: {},
    properties: {
      html: {
        type: 'string',
        required: true,
        responsive: false,
        bindable: false,
        tokens: [],
        control: 'text',
        default: { kind: 'literal', value: '<p>base</p>' },
      },
      contentProfile: {
        type: 'enum',
        values: ['cms-body-v1'],
        required: true,
        responsive: false,
        bindable: false,
        tokens: [],
        control: 'select',
        default: { kind: 'literal', value: 'cms-body-v1' },
      },
    },
  };
  const made = createCore({
    definitions: [...builtInDefinitions, def],
    siteConfiguration: demoSiteConfiguration,
  });
  assert.equal(made.status, 'created', JSON.stringify(made));
  const core = made.core;
  core.createDocument({ expectedSessionId: null });
  const inserted = core.executeTransaction({
    expectedSessionId: core.getSnapshot().sessionId,
    operations: [
      {
        opKey: 'section',
        kind: 'insertNode',
        type: 'core.section',
        destination: { kind: 'root', placement: { kind: 'append' } },
      },
      {
        opKey: 'body',
        kind: 'insertNode',
        type: 'cms.richText',
        destination: {
          kind: 'slot',
          parent: { kind: 'created', opKey: 'section' },
          slotName: 'content',
          placement: { kind: 'append' },
        },
      },
    ],
  });
  assert.equal(inserted.status, 'committed', JSON.stringify(inserted));
  const nodeId = inserted.created.body;
  core.loadDocument({
    expectedSessionId: core.getSnapshot().sessionId,
    input: core.getSnapshot().document,
    origin: 'persisted',
  });
  let auth = 'a';
  const host = createBoundFieldPort({
    core,
    nodeId,
    nodeType: 'cms.richText',
    htmlProperty: 'html',
    profileProperty: 'contentProfile',
    profile: codec.profile,
    fieldBindingId: `builder-${++serial}`,
    bindingEpoch: 1,
    interactionContextKey: 'owner-a',
    captureContextFence: () => auth,
    isContextFenceCurrent: (r) => r === auth,
    validate: (html) => {
      const d = codec.decode(html);
      return d.status === 'accepted' ? [] : d.diagnostics;
    },
  });
  const e = make(),
    binding = createEngineFieldBinding({
      controller: e,
      hostField: host,
      codec,
      surfaceStatus: ready,
    });
  return {
    e,
    host,
    binding,
    core,
    nodeId,
    revoke: () => {
      auth = 'b';
    },
  };
}
const wrap = (host, submit) => ({
  getSnapshot: host.getSnapshot,
  subscribe: host.subscribe,
  captureFence: host.captureFence,
  isContextCurrent: host.isContextCurrent,
  isFenceCurrent: host.isFenceCurrent,
  submitFieldEdit: submit,
});

test('HD01 profile codec rejects model loss instead of stripping style, classes, unsupported headings or links', () => {
  for (const node of [
    createText('x', [], { style: 'color:red' }),
    createText('x', [], { className: 'arbitrary' }),
  ])
    assert.equal(codec.encode(createDocument([createParagraph([node])])).status, 'rejected');
  assert.equal(
    codec.encode(createDocument([createHeading(1, [createText('x')])])).status,
    'rejected',
  );
  assert.equal(
    codec.encode(
      createDocument([createParagraph([createLink('javascript:bad', [createText('x')])])]),
    ).status,
    'rejected',
  );
  assert.equal(codec.decode('<p onclick="bad()">x</p>').status, 'rejected');
  assert.equal(codec.decode('<p><b>x</b></p>').status, 'rejected');
});
test('HD02 canonical round trips retain Thai spaces, marks, registered presentation, safe references, lists and escaping', () => {
  for (const html of [
    '<p> ภาษาไทย &lt;safe&gt; </p>',
    '<p><strong><em>x</em></strong></p>',
    '<p><span class="rte-accent">x</span><br>tail</p>',
    '<ul><li>one</li><li>two</li></ul>',
    '<p><a href="cms-route:home" target="_blank" rel="noopener noreferrer">Home</a></p>',
  ]) {
    const d = codec.decode(html);
    assert.equal(d.status, 'accepted', JSON.stringify({ html, d }));
    assert.equal(codec.encode(d.document).canonicalHtml, html);
  }
  assert.equal(
    codec.encode(
      createDocument([createList(false, [createListItem([createParagraph([createText('x')])])])]),
    ).canonicalHtml,
    '<ul><li>x</li></ul>',
  );
});
test('HD03 standalone terminal field acknowledgment preserves child session/history and never acknowledges server save', async () => {
  const { e, host, binding } = standalone();
  type(e, 'A');
  const before = e.getSnapshot();
  const result = await binding.flush();
  assert.equal(result.status, 'delivered', JSON.stringify(result));
  assert.equal(host.getSnapshot().parent.kind, 'standalone');
  assert.equal(binding.getStatus().localDirty, false);
  assert.equal(binding.getStatus().serverDirty, true);
  assert.equal(e.getSnapshot().sessionId, before.sessionId);
  assert.equal(e.getSnapshot().canUndo, true);
  assert.equal(binding.acceptExternalValue().status, 'accepted');
  assert.equal(e.getSnapshot().revision, before.revision);
});
test('HD04 delayed exact acknowledgment of A cannot overwrite or clean newer child B', async () => {
  const { e, host } = standalone();
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: wrap(host, async (edit) => {
      const ack = await host.submitFieldEdit(edit);
      await gate;
      return ack;
    }),
    codec,
    surfaceStatus: ready,
  });
  type(e, 'A');
  const promise = binding.flush();
  type(e, 'B');
  const latest = e.getSnapshot();
  release();
  assert.equal((await promise).status, 'delivered');
  assert.equal(e.getSnapshot(), latest);
  assert.equal(binding.getStatus().localDirty, true);
  assert.equal(e.getSnapshot().dirty, true);
  assert.equal((await binding.flush()).status, 'delivered');
  assert.equal(binding.getStatus().localDirty, false);
});
test('HD05 a second pending submit is blocked and a rejected edit stays in RAM with history', async () => {
  const { e, host } = standalone();
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: wrap(host, async (edit) => {
      await gate;
      return {
        ...(await host.submitFieldEdit(edit)),
        status: 'rejected',
        diagnostics: ['POLICY_REJECT'],
      };
    }),
    codec,
    surfaceStatus: ready,
  });
  type(e, 'draft');
  const promise = binding.flush();
  assert.equal((await binding.flush()).diagnostics[0], 'DELIVERY_PENDING');
  release();
  assert.equal((await promise).status, 'blocked');
  assert.equal(binding.getStatus().localDirty, true);
  assert.equal(e.getSnapshot().canUndo, true);
});
test('HD06 request, epoch, child, parent and exact HTML acknowledgment forgery all fail', async () => {
  for (const mutate of [
    (a) => ({ ...a, requestId: 'forged' }),
    (a) => ({ ...a, bindingEpoch: 999 }),
    (a) => ({ ...a, acceptedChildToken: { ...a.acceptedChildToken, revision: 999 } }),
    (a) => ({ ...a, actualParentToken: { kind: 'standalone', hostValueGeneration: 999 } }),
    (a) => ({ ...a, exactAcceptedHtml: '<p>different</p>' }),
  ]) {
    const { e, host } = standalone(),
      binding = createEngineFieldBinding({
        controller: e,
        hostField: wrap(host, async (edit) => mutate(await host.submitFieldEdit(edit))),
        codec,
        surfaceStatus: ready,
      });
    type(e, 'candidate');
    assert.equal((await binding.flush()).status, 'blocked');
    assert.equal(binding.getStatus().localDirty, true);
    assert.equal(e.getSnapshot().canUndo, true);
  }
});
test('HD07 preparation is privately issued and rejects model/selection/context changes', () => {
  const { e, host, binding } = standalone();
  const p = binding.prepareField();
  assert.equal(p.status, 'ready');
  assert.equal(binding.isPreparedCurrent({ ...p.field }), false);
  assert.equal(binding.isPreparedCurrent(p.field), true);
  type(e, 'x');
  assert.equal(binding.isPreparedCurrent(p.field), false);
  const next = binding.prepareField();
  host.suspend();
  assert.equal(binding.isPreparedCurrent(next.field), false);
  assert.equal(binding.prepareField().status, 'blocked');
});
test('HD08 active composition and invalid/unknown native surface state block preparation', () => {
  const { e, host } = standalone();
  let surface = { phase: 'ready', pending: false };
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: host,
    codec,
    surfaceStatus: () => surface,
  });
  surface = { phase: 'invalidDraft', pending: true };
  assert.equal(binding.prepareField().diagnostics[0], 'SURFACE_DRAFT_PENDING');
  surface = null;
  assert.equal(binding.prepareField().diagnostics[0], 'SURFACE_STATUS_UNAVAILABLE');
  surface = { phase: 'ready', pending: false };
  const token = e.getSnapshot().token;
  e.dispatch({ kind: 'beginComposition', compositionId: 'ime' }, { expected: token });
  assert.equal(binding.prepareField().diagnostics[0], 'COMPOSITION_ACTIVE');
});
test('HD09 parent replacement requires explicit local review and starts a new child session', () => {
  const { e, host, binding } = standalone();
  type(e, 'local');
  const old = e.getSnapshot().sessionId;
  assert.equal(host.replace('<p>parent</p>', 'parentUndo'), true);
  assert.equal(binding.prepareField().status, 'blocked');
  assert.equal(binding.acceptExternalValue().status, 'rejected');
  assert.equal(binding.acceptExternalValue({ discardLocal: true }).status, 'accepted');
  assert.notEqual(e.getSnapshot().sessionId, old);
  assert.equal(e.getSnapshot().canUndo, false);
  assert.equal(e.getSnapshot().dirty, true);
});
test('HD10 terminal host disposal clears controller and rejects a late original acknowledgment', async () => {
  const { e, host } = standalone();
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: wrap(host, async (edit) => {
      const ack = await host.submitFieldEdit(edit);
      await gate;
      return ack;
    }),
    codec,
    surfaceStatus: ready,
  });
  type(e, 'protected');
  const promise = binding.flush();
  host.dispose();
  assert.equal(e.getSnapshot().disposed, true);
  assert.equal(e.getSnapshot().document.children.length, 0);
  release();
  assert.equal((await promise).diagnostics[0], 'DISPOSED');
  assert.equal(binding.getStatus().localDirty, false);
});
test('HD11 standalone host detects request-ID payload reuse and returns identical duplicate terminal outcomes', async () => {
  const { host } = standalone();
  const edit = {
    requestId: 'same',
    capturedHostFenceRef: host.captureFence(),
    child: { sessionId: 'child', revision: 1 },
    canonicalHtml: '<p>new</p>',
    profile: codec.profile,
  };
  const a = await host.submitFieldEdit(edit),
    b = await host.submitFieldEdit({ ...edit });
  assert.deepEqual(a, b);
  assert.equal(
    (await host.submitFieldEdit({ ...edit, canonicalHtml: '<p>attack</p>' })).diagnostics[0],
    'REQUEST_ID_REUSED',
  );
  assert.equal(host.getSnapshot().html, '<p>new</p>');
});
test('HD12 standalone authorization is evaluated again after profile validation before commit', async () => {
  let allowed = true;
  const { host } = standalone({ isAuthorized: () => allowed });
  const ref = host.captureFence();
  allowed = false;
  const ack = await host.submitFieldEdit({
    requestId: 'auth',
    capturedHostFenceRef: ref,
    child: { sessionId: 'c', revision: 1 },
    canonicalHtml: '<p>new</p>',
    profile: codec.profile,
  });
  assert.equal(ack.status, 'stale');
  assert.equal(host.getSnapshot().html, '<p>base</p>');
});
test('HD13 actual Builder commits html/profile atomically in one sequence and page history entry', async () => {
  const { e, host, binding, core, nodeId } = builder();
  type(e, 'A');
  const before = core.getSnapshot().changeToken;
  const outcome = await binding.flush();
  assert.equal(outcome.status, 'delivered', JSON.stringify(outcome));
  assert.equal(core.getSnapshot().changeToken.sequence, before.sequence + 1);
  assert.equal(core.getSnapshot().document.nodes[nodeId].props.contentProfile.value, 'cms-body-v1');
  assert.equal(core.getSnapshot().document.nodes[nodeId].props.body, undefined);
  host.setExternalOrigin('parentUndo');
  assert.equal(core.undo({ expectedSessionId: before.sessionId }).status, 'committed');
  assert.equal(host.getSnapshot().html, '<p>base</p>');
  assert.equal(binding.acceptExternalValue().status, 'accepted');
});
test('HD14 unrelated Builder sequence and revoked context invalidate the original ticket without restamping', async () => {
  const { host, core, nodeId, revoke } = builder();
  const edit = {
    requestId: 'stale',
    capturedHostFenceRef: host.captureFence(),
    child: { sessionId: 'c', revision: 1 },
    canonicalHtml: '<p>candidate</p>',
    profile: codec.profile,
  };
  core.execute({
    expectedSessionId: core.getSnapshot().sessionId,
    operation: {
      kind: 'setProperty',
      node: { kind: 'id', id: nodeId },
      propertyName: 'html',
      target: { kind: 'base' },
      value: { kind: 'literal', value: '<p>parent</p>' },
    },
  });
  assert.equal((await host.submitFieldEdit(edit)).status, 'stale');
  const current = { ...edit, requestId: 'revoke', capturedHostFenceRef: host.captureFence() };
  revoke();
  assert.equal((await host.submitFieldEdit(current)).status, 'stale');
  assert.equal(host.getSnapshot().html, '<p>parent</p>');
});
test('HD15 Builder node removal terminally closes binding and cannot revive a same-address replacement', () => {
  const { host, e, core, nodeId, binding } = builder();
  core.execute({
    expectedSessionId: core.getSnapshot().sessionId,
    operation: { kind: 'removeNode', node: { kind: 'id', id: nodeId } },
  });
  assert.equal(host.getSnapshot().lifecycle, 'disposed');
  assert.equal(e.getSnapshot().disposed, true);
  assert.equal(binding.prepareField().status, 'blocked');
});
test('HD16 Builder noChange has a real exact terminal ack and leaves both persistence baselines untouched', async () => {
  const { e, core, binding } = builder();
  const outcome = await binding.flush();
  assert.equal(outcome.status, 'delivered', JSON.stringify(outcome));
  assert.equal(outcome.ack.status, 'noChange');
  assert.equal(core.getSnapshot().dirty, false);
  assert.equal(e.getSnapshot().dirty, false);
});
test('HD17 authorization lost after parent commit but before ack release cannot acknowledge field delivery', async () => {
  let allowed = true,
    release;
  const gate = new Promise((r) => {
    release = r;
  });
  const { e, host } = standalone({ isAuthorized: () => allowed });
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: wrap(host, async (edit) => {
      const ack = await host.submitFieldEdit(edit);
      await gate;
      return ack;
    }),
    codec,
    surfaceStatus: ready,
  });
  type(e, 'A');
  const promise = binding.flush();
  allowed = false;
  release();
  assert.equal((await promise).diagnostics[0], 'HOST_CONTEXT_CHANGED');
  assert.equal(binding.getStatus().localDirty, true);
  assert.equal(e.getSnapshot().dirty, true);
});
test('HD18 an explicit external child load invalidates an in-flight old-session acknowledgment', async () => {
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const { e, host } = standalone();
  const binding = createEngineFieldBinding({
    controller: e,
    hostField: wrap(host, async (edit) => {
      const ack = await host.submitFieldEdit(edit);
      await gate;
      return ack;
    }),
    codec,
    surfaceStatus: ready,
  });
  type(e, 'A');
  const promise = binding.flush();
  e.loadExternal(createDocument([createParagraph([createText('new session')])]), 'unsaved', {
    expected: e.getSnapshot().token,
  });
  release();
  assert.equal((await promise).diagnostics[0], 'STALE_CHILD_SESSION');
  assert.equal(e.getSnapshot().dirty, true);
});
test('HD19 suspended host retains draft/history in RAM while all mutation and prepare tickets fail', () => {
  const { e, host, binding } = standalone();
  type(e, 'draft');
  const token = e.getSnapshot().token,
    ref = host.captureFence();
  host.suspend();
  assert.equal(host.isFenceCurrent(ref), false);
  assert.equal(host.isContextCurrent(ref), false);
  assert.equal(binding.prepareField().status, 'blocked');
  assert.equal(e.getSnapshot().token, token);
  assert.equal(e.getSnapshot().canUndo, true);
});
test('HD20 public model witness rejects invalid nested models, cycles and byte-limit overflow', () => {
  const cycle = createParagraph([]);
  cycle.children.push(cycle);
  for (const d of [
    createDocument([createText('wrong block')]),
    createDocument([cycle]),
    createDocument([createParagraph([createParagraph([])])]),
    createDocument([createParagraph([createText('\u0000')])]),
    createDocument([createParagraph([createText('', ['bold'])])]),
  ])
    assert.equal(codec.encode(d).status, 'rejected');
  const tiny = createEngineContentCodec(
    createContentProfile({ maxInputBytes: 8 }),
    parseContentHtml,
  );
  assert.equal(
    tiny.encode(createDocument([createParagraph([createText('overflow')])])).status,
    'rejected',
  );
});
