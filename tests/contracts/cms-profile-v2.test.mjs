import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createContentProfile,
  contentProfileFingerprint,
  isContentProfile,
  parseHtml,
  serializeHtml,
} from '../../packages/editor-html/dist/index.mjs';
import { parseContentHtml, sanitizeContentHtml } from '../../packages/editor-html/dist/server.mjs';

const tokenClasses = [
  'rte-align-left',
  'rte-align-center',
  'rte-align-right',
  'rte-align-justify',
  'rte-text-brand',
];
const v1 = createContentProfile({ tokenClasses });
const v2 = createContentProfile({ id: 'cms-body-v2', tokenClasses });
const codes = (html, profile = v2) => {
  const result = parseContentHtml(html, profile);
  return result.status === 'accepted' ? [] : result.diagnostics.map((d) => d.code);
};
const canonical = (html, profile = v2) => {
  const result = parseContentHtml(html, profile);
  assert.equal(result.status, 'accepted', JSON.stringify(result));
  assert.equal(sanitizeContentHtml(html, profile).canonicalHtml, result.canonicalHtml);
  return result.canonicalHtml;
};

test('cms-body-v1 is unchanged: same identity, fingerprint keys and tag set', () => {
  assert.equal(v1.id, 'cms-body-v1');
  assert.deepEqual(Object.keys(JSON.parse(contentProfileFingerprint(v1))), [
    'id',
    'version',
    'classPrefix',
    'tokenClasses',
    'routeKeys',
    'maxInputBytes',
    'maxNodes',
    'maxDepth',
  ]);
  assert.deepEqual(codes('<p>H<sub>2</sub>O</p>', v1), ['UNSUPPORTED_TAG']);
  assert.deepEqual(codes('<p>x<sup>2</sup></p>', v1), ['UNSUPPORTED_TAG']);
});

test('cms-body-v2 has its own identity and validates as a wire profile', () => {
  assert.equal(v2.id, 'cms-body-v2');
  assert.notEqual(contentProfileFingerprint(v2), contentProfileFingerprint(v1));
  assert.equal(isContentProfile(JSON.parse(JSON.stringify(v2))), true);
  assert.equal(isContentProfile({ ...v2, id: 'cms-body-v9' }), false);
  assert.throws(() => createContentProfile({ id: 'cms-body-v9' }));
});

test('cms-body-v2 accepts subscript and superscript and keeps them canonical', () => {
  assert.equal(canonical('<p>H<sub>2</sub>O</p>'), '<p>H<sub>2</sub>O</p>');
  assert.equal(
    canonical('<p>E = mc<sup><strong>2</strong></sup></p>'),
    '<p>E = mc<sup><strong>2</strong></sup></p>',
  );
  assert.equal(
    canonical('<ul><li>x<sup>2</sup> <a href="https://example.com">a<sub>1</sub></a></li></ul>'),
    '<ul><li>x<sup>2</sup> <a href="https://example.com">a<sub>1</sub></a></li></ul>',
  );
});

test('cms-body-v2 rejects subscript and superscript on the same text', () => {
  assert.deepEqual(codes('<p><sub><sup>x</sup></sub></p>'), ['INVALID_NESTING']);
  assert.deepEqual(codes('<p><sup>a<em><sub>x</sub></em></sup></p>'), ['INVALID_NESTING']);
});

test('cms-body-v2 accepts one alignment class on a text block', () => {
  for (const tag of ['p', 'h2', 'h3', 'h4'])
    assert.equal(
      canonical(`<${tag} class="rte-align-center">x</${tag}>`),
      `<${tag} class="rte-align-center">x</${tag}>`,
    );
  assert.equal(
    canonical('<ol><li class="rte-align-right">x</li></ol>'),
    '<ol><li class="rte-align-right">x</li></ol>',
  );
  assert.equal(
    canonical('<p class="rte-text-brand rte-align-justify">x</p>'),
    '<p class="rte-align-justify rte-text-brand">x</p>',
  );
});

test('cms-body-v2 rejects alignment on inline or list containers and conflicting alignment', () => {
  assert.deepEqual(codes('<p><span class="rte-align-center">x</span></p>'), [
    'INVALID_CLASS_PLACEMENT',
  ]);
  assert.deepEqual(codes('<ul class="rte-align-center"><li>x</li></ul>'), [
    'INVALID_CLASS_PLACEMENT',
  ]);
  assert.deepEqual(codes('<p><a class="rte-align-left" href="https://example.com">x</a></p>'), [
    'INVALID_CLASS_PLACEMENT',
  ]);
  assert.deepEqual(codes('<p class="rte-align-left rte-align-right">x</p>'), ['CONFLICTING_CLASS']);
  assert.deepEqual(codes('<p class="rte-align-start">x</p>'), ['UNREGISTERED_CLASS']);
});

test('the general HTML codec round-trips subscript and superscript marks', () => {
  const parsed = parseHtml('<p>H<sub>2</sub>O and x<sup>2</sup></p>');
  assert.deepEqual(parsed.diagnostics, []);
  const texts = parsed.document.children[0].children;
  assert.deepEqual(texts[1].marks, ['subscript']);
  assert.deepEqual(texts[3].marks, ['superscript']);
  assert.equal(serializeHtml(parsed.document), '<p>H<sub>2</sub>O and x<sup>2</sup></p>');
});

test('cms-body-v2 accepts block quote, code block and horizontal rule', () => {
  assert.deepEqual(codes('<blockquote>x</blockquote>', v1), ['UNSUPPORTED_TAG']);
  assert.deepEqual(codes('<pre>x</pre>', v1), ['UNSUPPORTED_TAG']);
  assert.deepEqual(codes('<hr>', v1), ['UNSUPPORTED_TAG']);
  assert.equal(
    canonical('<blockquote>Quoted <em>text</em></blockquote><hr><p>after</p>'),
    '<blockquote>Quoted <em>text</em></blockquote><hr><p>after</p>',
  );
  assert.equal(canonical('<pre>a &lt; b<br>  c</pre>'), '<pre>a &lt; b<br>  c</pre>');
  assert.equal(canonical('<pre>a\n  b</pre>'), '<pre>a<br>  b</pre>');
  assert.equal(
    canonical('<blockquote class="rte-align-center">x</blockquote>'),
    '<blockquote class="rte-align-center">x</blockquote>',
  );
  assert.equal(
    canonical('<ul><li><blockquote>q</blockquote><hr></li></ul>'),
    '<ul><li><blockquote>q</blockquote><hr></li></ul>',
  );
});

test('cms-body-v2 rejects misplaced block quote, code block and horizontal rule', () => {
  assert.deepEqual(codes('<p><hr></p>'), ['INVALID_HTML']);
  assert.deepEqual(codes('<blockquote><p>x</p></blockquote>'), ['INVALID_HTML']);
  assert.deepEqual(codes('<p>a<pre>x</pre></p>'), ['INVALID_HTML']);
  assert.deepEqual(codes('<hr>x</hr>'), ['INVALID_HTML']);
  assert.deepEqual(codes('<pre class="rte-align-center">x</pre>'), ['INVALID_CLASS_PLACEMENT']);
  assert.deepEqual(codes('<hr class="rte-text-brand">'), ['INVALID_CLASS_PLACEMENT']);
});

test('the general HTML codec round-trips the new blocks', () => {
  const parsed = parseHtml(
    '<blockquote><p>one</p><p>two</p></blockquote><pre><code>a\nb</code></pre><hr><p>x</p>',
  );
  assert.deepEqual(parsed.diagnostics, []);
  assert.deepEqual(
    parsed.document.children.map((n) => n.type),
    ['blockquote', 'blockquote', 'code-block', 'horizontal-rule', 'paragraph'],
  );
  assert.equal(
    serializeHtml(parsed.document),
    '<blockquote>one</blockquote><blockquote>two</blockquote><pre>a<br>b</pre><hr><p>x</p>',
  );
});

test('cms-body-v2 places content style classes on a span or a text block', () => {
  const styled = createContentProfile({
    id: 'cms-body-v2',
    tokenClasses: [...tokenClasses, 'rte-typo-body', 'rte-typo-lead'],
  });
  const ok = (html) => assert.deepEqual(codes(html, styled), [], html);
  ok('<p>a <span class="rte-text-brand">b</span></p>');
  ok('<p class="rte-text-brand">a <span class="rte-typo-lead">b</span></p>');
  ok('<h2 class="rte-text-brand rte-typo-lead">a</h2>');
  ok('<ul><li class="rte-text-brand">a</li></ul>');
  ok('<blockquote class="rte-typo-lead">a</blockquote>');
  for (const html of [
    '<p><strong class="rte-text-brand">a</strong></p>',
    '<p><a class="rte-text-brand" href="https://example.com">a</a></p>',
    '<ul class="rte-text-brand"><li>a</li></ul>',
    '<p>a<br class="rte-text-brand">b</p>',
  ])
    assert.deepEqual(codes(html, styled), ['INVALID_CLASS_PLACEMENT'], html);
  assert.deepEqual(codes('<p><span class="rte-typo-body rte-typo-lead">a</span></p>', styled), [
    'CONFLICTING_CLASS',
  ]);
  // cms-body-v1 keeps its original, looser rule.
  const loose = createContentProfile({ tokenClasses: ['rte-typo-body', 'rte-typo-lead'] });
  assert.deepEqual(
    codes('<p><strong class="rte-typo-body rte-typo-lead">a</strong></p>', loose),
    [],
  );
});
