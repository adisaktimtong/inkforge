import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseHtml, serializeHtml } from '../../packages/editor-html/dist/index.mjs';
import { parseHtml as parseServerHtml } from '../../packages/editor-html/dist/server.mjs';
import * as browser from '../../packages/editor-html/dist/browser.mjs';
import {
  createDocument,
  createHardBreak,
  createHeading,
  createList,
  createListItem,
  createParagraph,
  createText,
  isBlockNode,
  isInlineNode,
  walkDocument,
} from '../../packages/editor-core/dist/index.mjs';

describe('editor HTML model boundary', () => {
  test('decodes named and numeric entities while preserving unknown references safely', () => {
    const result = parseHtml('<p>&copy; &#169; &#x1f600; &unknown;</p>');
    assert.equal(result.document.children[0].children[0].text, '© © 😀 &unknown;');
    assert.equal(serializeHtml(result.document), '<p>© © 😀 &amp;unknown;</p>');
  });

  test('preserves hard breaks in the inline model and HTML', () => {
    const result = parseHtml('<p>a<br>b</p>');
    assert.deepEqual(result.document.children[0].children, [
      { type: 'text', text: 'a' },
      { type: 'hard-break' },
      { type: 'text', text: 'b' },
    ]);
    assert.equal(serializeHtml(result.document), '<p>a<br>b</p>');
    assert.deepEqual(createHardBreak(), { type: 'hard-break' });
  });

  test('normalizes escaped CSS keywords before filtering and diagnoses them', () => {
    const result = parseHtml(
      '<p style="color:red; u\\72l(javascript:alert(1)); expre\\73sion(alert(1))">x</p>',
    );
    assert.equal(result.document.children[0].style, 'color: red');
    assert.equal(result.diagnostics.filter((d) => d.code === 'UNSAFE_STYLE').length, 2);
  });

  test('parses only the bounded prefix and reports truncation', () => {
    const result = parseHtml('<p>abcdef</p>', { maxInputLength: 5 });
    assert.equal(result.diagnostics[0].code, 'INPUT_TRUNCATED');
    assert.equal(result.document.children[0].children[0].text, 'ab');
  });

  test('keeps hardening behavior consistent across browser and server adapters', () => {
    const html = '<p>&#x41;<br>z</p>';
    assert.deepEqual(browser.parseHtml(html), parseServerHtml(html));
  });

  test('round-trips supported article semantics deterministically', () => {
    const parsed = parseHtml(
      '<h1>Title</h1><p>Hello <strong>world</strong> <a href="https://example.com">link</a></p><ul><li>One</li><li>Two</li></ul>',
    );
    assert.equal(parsed.diagnostics.length, 0);
    assert.equal(
      serializeHtml(parsed.document),
      '<h1>Title</h1><p>Hello <strong>world</strong> <a href="https://example.com">link</a></p><ul><li>One</li><li>Two</li></ul>',
    );
  });

  test('removes executable markup, handlers, unsafe URLs and CSS', () => {
    const result = parseHtml(
      '<p onclick="alert(1)" style="color: red; position: fixed; background-image:url(x)"><a href="javascript:alert(1)">x</a></p><script>alert(1)</script><iframe src="x"></iframe>',
    );
    assert.equal(result.document.children.length, 1);
    assert.ok(result.diagnostics.some((d) => d.code === 'UNSAFE_TAG'));
    assert.ok(result.diagnostics.some((d) => d.code === 'EVENT_ATTRIBUTE'));
    assert.ok(result.diagnostics.some((d) => d.code === 'UNSAFE_URL'));
    assert.ok(result.diagnostics.some((d) => d.code === 'UNSAFE_STYLE'));
    assert.match(serializeHtml(result.document), /color: red/);
    assert.doesNotMatch(serializeHtml(result.document), /position|background-image|javascript/);
  });

  test('unwraps unknown tags, handles malformed input, and preserves safe presentation', () => {
    const result = parseHtml(
      '<custom><p class="legacy article" style="text-align: center; z-index: 2">safe<strong> text</custom>',
    );
    assert.equal(result.document.children[0].type, 'paragraph');
    assert.equal(
      serializeHtml(result.document),
      '<p class="legacy article" style="text-align: center">safe<strong> text</strong></p>',
    );
  });

  test('accepts empty input without throwing', () => {
    const result = parseHtml('');
    assert.deepEqual(result.document, { type: 'document', children: [] });
    assert.equal(serializeHtml(result.document), '');
  });

  test('preserves inline class and allowlisted typography styles', () => {
    const result = parseHtml(
      '<p><span class="lead" style="font-size: 18px; font-family: sans-serif">text</span></p>',
    );
    assert.equal(
      serializeHtml(result.document),
      '<p><span class="lead" style="font-family: sans-serif; font-size: 18px">text</span></p>',
    );
  });

  test('keeps the server adapter DOM-free and contract-compatible', () => {
    const result = parseServerHtml('<h2>SSR</h2>');
    assert.deepEqual(result.document.children[0], {
      type: 'heading',
      level: 2,
      children: [{ type: 'text', text: 'SSR' }],
    });
  });

  test('sanitizes direct model serialization and browser exports', () => {
    const model = createDocument([
      createHeading(9, [
        createText('x', ['bold', 'unknown'], {
          className: 'ok',
          style: 'color: red; position: fixed',
        }),
      ]),
      createList(false, [
        createListItem([createParagraph([createText('item')])], { className: 'row' }),
      ]),
    ]);
    assert.match(
      serializeHtml(model),
      /<h6><span class="ok" style="color: red"><strong>x<\/strong><\/span><\/h6>/,
    );
    assert.doesNotMatch(
      serializeHtml({
        type: 'document',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'link',
                href: 'javascript:alert(1)',
                children: [{ type: 'text', text: 'x' }],
              },
            ],
          },
        ],
      }),
      /javascript:/,
    );
    assert.equal(browser.parseHtml('<p>x</p>').document.children[0].type, 'paragraph');
  });

  test('exposes core traversal and predicates', () => {
    const document = createDocument([createParagraph([createText('x')])]);
    assert.equal(isBlockNode(document.children[0]), true);
    assert.equal(isInlineNode(document.children[0].children[0]), true);
    assert.deepEqual(
      [...walkDocument(document)].map((node) => node.type),
      ['document', 'paragraph', 'text'],
    );
  });
});
