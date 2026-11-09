import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createContentStylesheet,
  defaultContentStylesheet,
} from '../../packages/editor-content/dist/index.mjs';
import {
  runContentChecks,
  isCheckReportCurrent,
} from '../../packages/editor-checks/dist/index.mjs';
import { createContentProfile } from '../../packages/editor-html/dist/index.mjs';
import { parseContentHtml } from '../../packages/editor-html/dist/server.mjs';
const snapshot = (html) => {
  const parsed = parseContentHtml(
    html,
    createContentProfile({ tokenClasses: defaultContentStylesheet.tokenClasses }),
  );
  assert.equal(parsed.status, 'accepted');
  return { sessionId: 'session', revision: 1, document: parsed.document };
};
const status = (r, id) => r.rules.find((rule) => rule.ruleId === id).status;
test('same immutable content token registry drives policy and responsive website CSS', () => {
  const theme = {
    breakpoints: { desktop: 1024 },
    tokens: [
      {
        id: 'body',
        kind: 'typography',
        values: { base: { fontSize: '1rem' }, desktop: { fontSize: '1.25rem' } },
      },
    ],
  };
  const output = createContentStylesheet(theme);
  theme.tokens[0].values.base.fontSize = '100px';
  assert.deepEqual(output.tokenClasses, ['rte-typo-body']);
  assert.match(output.cssText, /@media \(min-width:1024px\)/);
  assert.ok(!output.cssText.includes('100px'));
  assert.equal(
    parseContentHtml(
      '<p class="rte-typo-body">ไทย</p>',
      createContentProfile({ tokenClasses: output.tokenClasses }),
    ).status,
    'accepted',
  );
  for (const token of [
    { id: 'x', kind: 'text', values: { base: { color: 'red;}</style><script>evil()</script>' } } },
    { id: 'x', kind: 'font', values: { base: { fontFamily: 'url(evil)' } } },
  ])
    assert.throws(() => createContentStylesheet({ tokens: [token] }));
  assert.throws(() => createContentStylesheet({ tokens: [theme.tokens[0]], breakpoints: {} }));
  assert.ok(Object.isFrozen(output.tokenClasses));
});
test('content review reports missing context honestly and is deterministic and snapshot bound', async () => {
  const input = snapshot(
    '<h2>หัวข้อ</h2><h4>ข้าม</h4><p><a href="https://example.com">อ่านเพิ่มเติม</a></p>',
  );
  const a = await runContentChecks(input),
    b = await runContentChecks(input);
  assert.deepEqual(a, b);
  assert.equal(a.status, 'complete');
  assert.equal(status(a, 'heading-structure'), 'failed');
  assert.equal(status(a, 'descriptive-links'), 'manual-review');
  assert.equal(status(a, 'contrast'), 'not-evaluated');
  assert.equal(status(a, 'color-meaning'), 'manual-review');
  assert.equal(status(a, 'image-alternatives'), 'not-evaluated');
  assert.ok(
    a.issues.every(
      (issue) =>
        issue.ruleId &&
        typeof issue.nodeId === 'string' &&
        issue.message &&
        issue.standardReference,
    ),
  );
  assert.equal(isCheckReportCurrent(a, input), true);
  assert.equal(isCheckReportCurrent(a, { ...input, revision: 2 }), false);
  assert.equal(isCheckReportCurrent(a, { ...input, sessionId: 'other' }), false);
});
test('contrast evaluates all supplied variants and missing variants cannot become a pass', async () => {
  const input = snapshot('<p class="rte-text-brand">Brand</p>');
  let classes;
  const report = await runContentChecks(input, {
    contrast: async (context) => {
      classes = context.tokenClasses;
      return [
        { variant: 'light-mobile', status: 'passed' },
        { variant: 'dark-mobile', status: 'failed' },
        { variant: 'dark-desktop', status: 'not-evaluated' },
      ];
    },
  });
  assert.deepEqual(classes, ['rte-text-brand']);
  assert.equal(status(report, 'contrast'), 'failed');
  const unknown = await runContentChecks(input, {
    contrast: async () => [
      { variant: 'one', status: 'not-evaluated' },
      { variant: 'two', status: 'manual-review' },
    ],
  });
  assert.equal(status(unknown, 'contrast'), 'not-evaluated');
});
test('async checks isolate input, expose cancellation and failures without reporting passed', async () => {
  const input = snapshot('<p>A</p>');
  const abort = new AbortController();
  let finish;
  const pending = runContentChecks(input, {
    signal: abort.signal,
    contrast: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  input.revision = 99;
  input.document.children = [];
  abort.abort();
  finish([{ variant: 'light', status: 'passed' }]);
  const cancelled = await pending;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.revision, 1);
  assert.notEqual(status(cancelled, 'contrast'), 'passed');
  const failed = await runContentChecks(snapshot('<p>A</p>'), {
    contrast: async () => {
      throw Error('host failure');
    },
  });
  assert.equal(failed.status, 'failed');
  assert.equal(
    (
      await runContentChecks({
        sessionId: 'x',
        revision: 0,
        document: { type: 'document', children: [{ type: 'image' }] },
      })
    ).status,
    'failed',
  );
});

test('cancellation completes even if a host checker ignores its AbortSignal', async () => {
  const controller = new AbortController();
  const pending = runContentChecks(snapshot('<p>A</p>'), {
    signal: controller.signal,
    contrast: () => new Promise(() => {}),
  });
  controller.abort();
  assert.equal((await pending).status, 'cancelled');
});
