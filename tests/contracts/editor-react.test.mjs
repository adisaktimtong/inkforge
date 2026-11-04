import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { InkForgeEditor } from '../../packages/editor-react/dist/index.mjs';

const require = createRequire(new URL('../../apps/react-playground/package.json', import.meta.url));
const { createElement, createRef } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const render = (props = {}) => renderToStaticMarkup(createElement(InkForgeEditor, props));

test('imports and renders sanitized HTML without DOM globals', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof globalThis.document, 'undefined');
  const html = render({
    value:
      '<p onclick="evil()">Hello <strong>world</strong><a href="javascript:evil()">link</a></p><script>evil()</script>',
    'aria-label': 'Article',
    id: 'article',
    ref: createRef(),
  });
  assert.match(html, /<p>Hello <strong>world<\/strong>link<\/p>/);
  assert.doesNotMatch(html, /onclick|javascript:|<script/);
  assert.match(html, /role="textbox"/);
  assert.match(html, /aria-multiline="true"/);
  assert.match(html, /aria-label="Article"/);
  assert.match(html, /id="article"/);
});

test('renders controlled, uncontrolled, and empty initial values', () => {
  assert.match(
    render({ value: '<h2>Controlled</h2>', defaultValue: '<p>Ignored</p>' }),
    /<h2>Controlled<\/h2>/,
  );
  assert.match(render({ defaultValue: '<p>Uncontrolled</p>' }), /<p>Uncontrolled<\/p>/);
  assert.match(render(), /contentEditable="true"[^>]*><\/div>/);
  assert.match(render({ value: '' }), /contentEditable="true"[^>]*><\/div>/);
});

test('exposes disabled and read-only native focus semantics', () => {
  assert.match(render({ disabled: true }), /aria-disabled="true"/);
  assert.match(render({ disabled: true }), /tabindex="-1"/);
  assert.match(render({ disabled: true }), /contentEditable="false"/);
  assert.match(render({ readOnly: true }), /aria-readonly="true"/);
  assert.match(render({ readOnly: true }), /tabindex="0"/);
});

test('built entry retains client directive and public typed surface', () => {
  const code = readFileSync(
    new URL('../../packages/editor-react/dist/index.mjs', import.meta.url),
    'utf8',
  );
  assert.match(code, /^['"]use client['"];?/);
  assert.doesNotMatch(code, /@inkforge\/editor-(?:dom|source)/);
  const types = readFileSync(
    new URL('../../packages/editor-react/dist/index.d.mts', import.meta.url),
    'utf8',
  );
  assert.match(types, /InkForgeEditorProps/);
  assert.match(types, /HTMLDivElement/);
  for (const prop of [
    'value',
    'defaultValue',
    'onChange',
    'onDiagnostics',
    'disabled',
    'readOnly',
    'toolbar',
  ])
    assert.match(types, new RegExp(prop + '\\??:'));
});

test('optional toolbar is SSR-safe, accessible and keeps attributes on the editable div', () => {
  assert.doesNotMatch(render(), /role="toolbar"/);
  assert.equal(render({ toolbar: false }), render());
  const html = render({ toolbar: true, id: 'editable', className: 'custom', readOnly: true });
  assert.match(html, /role="toolbar" aria-label="Text formatting"/);
  assert.equal((html.match(/type="button"/g) ?? []).length, 9);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 9);
  assert.match(html, /id="editable"[^>]*role="textbox"[^>]*class="inkforge-editor custom"/);
  assert.doesNotMatch(html, /toolbar="/);
});
