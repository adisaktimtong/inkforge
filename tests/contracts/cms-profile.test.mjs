import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContentProfile } from '../../packages/editor-html/dist/index.mjs';
import {
  parseContentHtml,
  sanitizeContentHtml,
  renderContentHtml,
} from '../../packages/editor-html/dist/server.mjs';
const fixtures = JSON.parse(
  readFileSync(new URL('../../fixtures/cms-body-v1.json', import.meta.url), 'utf8'),
);
const profile = createContentProfile({
  tokenClasses: fixtures.allowedTokenClasses,
  routeKeys: ['home', 'search'],
});
for (const fixture of fixtures.fixtures)
  test(`CMS profile ${fixture.id}: ${fixture.title}`, () => {
    const result = parseContentHtml(fixture.inputHtml, profile);
    assert.equal(
      result.status,
      fixture.hostDecision === 'accept' ? 'accepted' : 'rejected',
      JSON.stringify(result),
    );
    if (result.status === 'accepted') {
      assert.equal(result.canonicalHtml, fixture.canonicalHtml);
      assert.equal(
        sanitizeContentHtml(result.canonicalHtml, profile).canonicalHtml,
        result.canonicalHtml,
      );
    }
  });
test('public output resolves logical identity and never persists temporary delivery URLs', () => {
  const input =
    '<p><a href="cms-ref:asset:c3e6b3d2-6fbd-4c63-a7da-05be2b79d256" target="_blank" rel="noopener noreferrer">เอกสาร</a></p>';
  const result = renderContentHtml(
    input,
    profile,
    () => '/__cms/assets/c3e6b3d2-6fbd-4c63-a7da-05be2b79d256/download',
  );
  assert.equal(result.status, 'accepted');
  assert.ok(!result.html.includes('cms-ref:'));
  assert.ok(result.html.includes('rel="noopener noreferrer"'));
  assert.ok(input.includes('cms-ref:'));
  assert.equal(renderContentHtml(input, profile, () => null).html, '<p>เอกสาร</p>');
  assert.equal(renderContentHtml(input, profile, () => 'javascript:alert(1)').status, 'rejected');
});
test('profiles are immutable and prefix matching cannot accept unknown token classes', () => {
  assert.throws(() => {
    profile.tokenClasses.push('rte-anything');
  }, TypeError);
  assert.equal(parseContentHtml('<p class="rte-anything">A</p>', profile).status, 'rejected');
  assert.equal(
    parseContentHtml('<p><a href="cms-route:unknown">A</a></p>', profile).status,
    'rejected',
  );
  assert.equal(
    parseContentHtml('<p><a href="https://user:password@outside.example/">A</a></p>', profile)
      .status,
    'rejected',
  );
});

test('strict source rejects parser repair, discarded wrappers, duplicate attributes and truncation', () => {
  const profile = createContentProfile();
  for (const input of [
    '<p>A',
    '<p>A<p>B</p>',
    '<p class="x" class="y">A</p>',
    '<html><p>A</p></html>',
    '<p><strong>A</p></strong>',
    '<p/>',
    '<!doctype html><p>A</p>',
  ])
    assert.equal(parseContentHtml(input, profile).status, 'rejected', input);
  for (const resolved of [
    'https://user:pass@example.com/',
    'https://',
    'mailto:bad',
    'tel:bad',
    '//example.com',
    'cms-route:home',
  ]) {
    const result = renderContentHtml(
      '<p><a href="cms-route:home">Home</a></p>',
      createContentProfile({ routeKeys: ['home'] }),
      () => resolved,
    );
    assert.equal(result.status, 'rejected', resolved);
  }
});

test('list text cannot disappear through canonicalization and the configured byte limit is honored', () => {
  assert.equal(
    parseContentHtml('<ul>Lost text<li>Keep</li></ul>', createContentProfile()).status,
    'rejected',
  );
  const input = '<p>' + 'A'.repeat(1_000_001) + '</p>';
  const result = parseContentHtml(input, createContentProfile());
  assert.equal(result.status, 'accepted');
  assert.equal(result.canonicalHtml, input);
  assert.equal(
    parseContentHtml(input, createContentProfile({ maxInputBytes: 1000 })).status,
    'rejected',
  );
});

test('shared syntax rejects structures repaired by native parsers without rejecting literal entities', () => {
  for (const html of [
    '<p><p>A</p></p>',
    '<p><ul><li>A</li></ul></p>',
    '<p><a href="https://example.com"><strong><a href="https://example.com">A</a></strong></a></p>',
    '<p>&#0;</p>',
    '<p>\u0000</p>',
  ])
    assert.equal(parseContentHtml(html, createContentProfile()).status, 'rejected', html);
  const result = parseContentHtml('<p>A &unknown; B</p>', createContentProfile());
  assert.equal(result.status, 'accepted');
  assert.equal(result.canonicalHtml, '<p>A &amp;unknown; B</p>');
});
