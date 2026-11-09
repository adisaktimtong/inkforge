import type { DocumentNode } from '@inkforge/editor-core';
import { parseHtml, serializeHtml } from './index.js';

export interface ContentProfile {
  readonly id: string;
  readonly version: number;
  readonly classPrefix: string;
  readonly tokenClasses: readonly string[];
  readonly routeKeys: readonly string[];
  readonly maxInputBytes: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
}
export type HtmlAstNode =
  | { type: 'text'; value: string }
  | {
      type: 'element';
      tag: string;
      attributes: readonly { name: string; value: string }[];
      children: readonly HtmlAstNode[];
      namespace?: string;
    };
export interface ContentDiagnostic {
  code: string;
  message: string;
  path: string;
  severity: 'error' | 'warning';
}
export type ContentResult =
  | {
      status: 'accepted';
      canonicalHtml: string;
      document: DocumentNode;
      profileFingerprint: string;
      diagnostics: ContentDiagnostic[];
    }
  | { status: 'rejected'; diagnostics: ContentDiagnostic[] };

const canonicalTags = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'u',
  's',
  'code',
  'br',
  'a',
  'span',
]);
const aliases: Record<string, string> = { b: 'strong', i: 'em', strike: 's' };
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A new immutable profile is required for a changed token/route registry. Prefix alone never grants acceptance. */
export function createContentProfile(
  configuration: Partial<Omit<ContentProfile, 'id' | 'version'>> = {},
): ContentProfile {
  const profile: ContentProfile = {
    id: 'cms-body-v1',
    version: 1,
    classPrefix: configuration.classPrefix ?? 'rte-',
    tokenClasses: [...(configuration.tokenClasses ?? [])].sort(),
    routeKeys: [...(configuration.routeKeys ?? [])].sort(),
    maxInputBytes: configuration.maxInputBytes ?? 2_097_152,
    maxNodes: configuration.maxNodes ?? 10000,
    maxDepth: configuration.maxDepth ?? 64,
  };
  if (
    !/^[A-Za-z][A-Za-z0-9_-]*-$/.test(profile.classPrefix) ||
    [profile.maxInputBytes, profile.maxNodes, profile.maxDepth].some(
      (v) => !Number.isSafeInteger(v) || v < 1,
    )
  )
    throw new Error('Invalid content profile');
  if (
    new Set(profile.tokenClasses).size !== profile.tokenClasses.length ||
    profile.tokenClasses.some(
      (c) => !c.startsWith(profile.classPrefix) || !/^[-A-Za-z0-9_]+$/.test(c),
    )
  )
    throw new Error('Invalid or duplicate token class');
  if (
    new Set(profile.routeKeys).size !== profile.routeKeys.length ||
    profile.routeKeys.some((k) => !/^[a-z][a-z0-9.-]*$/.test(k) || forbidden.has(k))
  )
    throw new Error('Invalid or duplicate route key');
  Object.freeze(profile.tokenClasses);
  Object.freeze(profile.routeKeys);
  return Object.freeze(profile);
}

/** Full canonical configuration, not a lossy hash; adapters compare this exact fingerprint. */
export function contentProfileFingerprint(profile: ContentProfile): string {
  return JSON.stringify({
    id: profile.id,
    version: profile.version,
    classPrefix: profile.classPrefix,
    tokenClasses: [...profile.tokenClasses].sort(),
    routeKeys: [...profile.routeKeys].sort(),
    maxInputBytes: profile.maxInputBytes,
    maxNodes: profile.maxNodes,
    maxDepth: profile.maxDepth,
  });
}

export function isProfileHref(href: string, profile: ContentProfile): boolean {
  if (!href || href !== href.trim() || /[\u0000-\u0020\u007f\\]/.test(href)) return false;
  if (
    /^cms-ref:(?:content|category|asset):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      href,
    )
  )
    return true;
  if (href.startsWith('cms-route:')) return profile.routeKeys.includes(href.slice(10));
  if (href.startsWith('mailto:'))
    return /^[^\s?%:<>@]+@[^\s?%:<>@]+\.[^\s?%:<>@]+$/.test(href.slice(7));
  if (href.startsWith('tel:')) return /^\+?[0-9]{1,15}$/.test(href.slice(4));
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const url = new URL(href);
    return (
      ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function evaluateContentPolicy(
  nodes: readonly HtmlAstNode[],
  profile: ContentProfile,
): ContentDiagnostic[] {
  const diagnostics: ContentDiagnostic[] = [];
  let count = 0;
  const error = (code: string, path: string, message: string) =>
    diagnostics.push({ code, path, message, severity: 'error' });
  function visit(node: HtmlAstNode, path: string, depth: number, parent?: string): void {
    if (++count > profile.maxNodes || depth > profile.maxDepth) {
      if (!diagnostics.some((d) => d.code === 'CONTENT_LIMIT'))
        error('CONTENT_LIMIT', path, 'Content exceeds the profile node/depth limit');
      return;
    }
    if (node.type === 'text') {
      if (['ul', 'ol'].includes(parent ?? '') && node.value.trim())
        error('INVALID_NESTING', path, 'Text inside a list needs a list item');
      return;
    }
    const tag = aliases[node.tag] ?? node.tag;
    if (node.namespace && node.namespace !== 'http://www.w3.org/1999/xhtml')
      error('UNSUPPORTED_NAMESPACE', path, 'Foreign content is not allowed');
    if (!canonicalTags.has(tag)) error('UNSUPPORTED_TAG', path, `Unsupported element: ${node.tag}`);
    const block = ['p', 'h2', 'h3', 'h4', 'ul', 'ol'];
    if (block.includes(tag) && parent && !['li'].includes(parent))
      error('INVALID_NESTING', path, 'Block is not allowed in this parent');
    if (tag === 'li' && !['ul', 'ol'].includes(parent ?? ''))
      error('INVALID_NESTING', path, 'List items need a list parent');
    if (['ul', 'ol'].includes(parent ?? '') && tag !== 'li')
      error('INVALID_NESTING', path, 'Lists can contain only list items');
    const attrs = new Map<string, string>();
    for (const attribute of node.attributes) {
      if (attrs.has(attribute.name))
        error('DUPLICATE_ATTRIBUTE', path, `Duplicate attribute: ${attribute.name}`);
      attrs.set(attribute.name, attribute.value);
      if (!['class', ...(tag === 'a' ? ['href', 'target', 'rel'] : [])].includes(attribute.name))
        error('UNSUPPORTED_ATTRIBUTE', path, `Unsupported attribute: ${attribute.name}`);
      if (attribute.name === 'class') {
        const classes = attribute.value.trim().split(/\s+/).filter(Boolean);
        if (!classes.length || classes.some((c) => !profile.tokenClasses.includes(c)))
          error('UNREGISTERED_CLASS', path, 'Every class must be registered explicitly');
      }
    }
    if (tag === 'a') {
      if (!isProfileHref(attrs.get('href') ?? '', profile))
        error('UNSAFE_URL', path, 'Link is not allowed by the content profile');
      if (attrs.has('target') && !['_self', '_blank'].includes(attrs.get('target')!))
        error('UNSAFE_TARGET', path, 'Unsupported link target');
      if (
        attrs.has('rel') &&
        attrs
          .get('rel')!
          .split(/\s+/)
          .some((r) => !['noopener', 'noreferrer'].includes(r))
      )
        error('UNSUPPORTED_REL', path, 'Unsupported link relation');
      if (parent === 'a') error('INVALID_NESTING', path, 'Nested anchors are not allowed');
    }
    node.children.forEach((child, index) =>
      visit(child, `${path}/children/${index}`, depth + 1, tag),
    );
  }
  nodes.forEach((node, index) => visit(node, `/${index}`, 0));
  return diagnostics;
}

export function serializeContentAst(nodes: readonly HtmlAstNode[]): string {
  const render = (node: HtmlAstNode): string => {
    if (node.type === 'text')
      return node.value.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const tag = aliases[node.tag] ?? node.tag;
    const attributes = new Map(node.attributes.map((a) => [a.name, a.value]));
    let output = '';
    if (tag === 'a') {
      output += ` href="${escape(attributes.get('href') ?? '')}"`;
      if (attributes.get('target') === '_blank')
        output += ' target="_blank" rel="noopener noreferrer"';
    }
    if (attributes.has('class'))
      output += ` class="${escape([...new Set(attributes.get('class')!.split(/\s+/).filter(Boolean))].sort().join(' '))}"`;
    return `<${tag}${output}>${tag === 'br' ? '' : node.children.map(render).join('') + `</${tag}>`}`;
  };
  return nodes.map(render).join('');
}

/** Common browser/server decision boundary after each adapter constructs a normalized AST. */
export function acceptContentAst(
  nodes: readonly HtmlAstNode[],
  profile: ContentProfile,
  parserDiagnostics: readonly ContentDiagnostic[] = [],
): ContentResult {
  const diagnostics = [...parserDiagnostics, ...evaluateContentPolicy(nodes, profile)];
  if (diagnostics.some((d) => d.severity === 'error')) return { status: 'rejected', diagnostics };
  const html = serializeContentAst(nodes);
  const parsed = parseHtml(html, { referenceLinks: true, maxInputLength: profile.maxInputBytes });
  if (parsed.diagnostics.length)
    return {
      status: 'rejected',
      diagnostics: parsed.diagnostics.map((d) => ({
        code: d.code,
        message: d.message,
        path: '',
        severity: 'error',
      })),
    };
  return {
    status: 'accepted',
    canonicalHtml: serializeHtml(parsed.document, { referenceLinks: true }),
    document: parsed.document,
    profileFingerprint: contentProfileFingerprint(profile),
    diagnostics,
  };
}

export function profileInputDiagnostic(
  input: unknown,
  profile: ContentProfile,
): ContentDiagnostic[] {
  if (
    typeof input !== 'string' ||
    new TextEncoder().encode(input).byteLength > profile.maxInputBytes
  )
    return [
      {
        code: 'CONTENT_LIMIT',
        message: 'Input is not a bounded HTML string',
        path: '',
        severity: 'error',
      },
    ];
  return validateContentSyntax(input, profile);
}

/** Reject information that native HTML parsers otherwise repair or discard differently.
 * This envelope check is not an HTML parser; the native/parse5 AST is still authoritative.
 * CMS source must use explicit balanced tags. Never silently truncate an author's source.
 */
export function validateContentSyntax(input: string, profile: ContentProfile): ContentDiagnostic[] {
  const reject = (message: string): ContentDiagnostic[] => [
    { code: 'INVALID_HTML', message, path: '', severity: 'error' },
  ];
  const stack: string[] = [];
  if (input.includes('\u0000')) return reject('Null characters are not valid content');
  for (const reference of input.matchAll(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi)) {
    const value = Number.parseInt(reference[1] ?? reference[2]!, reference[1] ? 16 : 10);
    if (value === 0 || value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff))
      return reject('Invalid numeric character reference');
  }
  let index = 0,
    count = 0;
  while (index < input.length) {
    const start = input.indexOf('<', index);
    if (start < 0) break;
    if (input.startsWith('<!--', start)) {
      const end = input.indexOf('-->', start + 4);
      if (end < 0) return reject('Unclosed HTML comment');
      index = end + 3;
      continue;
    }
    let end = start + 1,
      quote = '';
    for (; end < input.length; end++) {
      const char = input[end]!;
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === input.length || quote) return reject('Truncated HTML tag');
    const tag = input.slice(start + 1, end);
    const match = /^(\/)?([A-Za-z][A-Za-z0-9-]*)([\s\S]*)$/.exec(tag);
    if (!match) return reject('Unsupported or malformed HTML token');
    const closing = !!match[1],
      name = match[2]!.toLowerCase(),
      tail = match[3]!;
    if (!canonicalTags.has(aliases[name] ?? name))
      return [
        {
          code: 'UNSUPPORTED_TAG',
          message: `Unsupported element: ${name}`,
          path: '',
          severity: 'error',
        },
      ];
    if (++count > profile.maxNodes * 2 || stack.length > profile.maxDepth)
      return reject('HTML syntax exceeds profile limits');
    if (closing) {
      if (tail.trim() || name === 'br' || stack.pop() !== name)
        return reject('Unbalanced HTML closing tag');
    } else {
      const parent = stack.at(-1);
      if (['p', 'h2', 'h3', 'h4', 'ul', 'ol'].includes(name) && parent && parent !== 'li')
        return reject('Block content needs a block parent');
      if (name === 'li' && !['ul', 'ol'].includes(parent ?? ''))
        return reject('List items need a list parent');
      if (['ul', 'ol'].includes(parent ?? '') && name !== 'li')
        return reject('Lists can contain only list items');
      if (name === 'a' && stack.includes('a')) return reject('Nested anchors are not allowed');
      const attributes = tail.replace(/\/\s*$/, '');
      let offset = 0;
      const names = new Set<string>();
      while (offset < attributes.length) {
        const remaining = attributes.slice(offset);
        const attr =
          /^\s+([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/.exec(
            remaining,
          );
        if (!attr) {
          if (!remaining.trim()) break;
          return reject('Malformed HTML attribute');
        }
        const attribute = attr[1]!.toLowerCase();
        if (names.has(attribute)) return reject('Duplicate HTML attribute');
        names.add(attribute);
        offset += attr[0].length;
      }
      if (name !== 'br') {
        if (/\/\s*$/.test(tail)) return reject('Only br may be self closing');
        stack.push(name);
      }
    }
    index = end + 1;
  }
  return stack.length ? reject('Unclosed HTML element') : [];
}

/** Validates a wire profile before any caller-supplied registry is evaluated. */
export function isContentProfile(value: unknown): value is ContentProfile {
  if (!record(value)) return false;
  try {
    return (
      contentProfileFingerprint(createContentProfile(value as Partial<ContentProfile>)) ===
      contentProfileFingerprint(value as unknown as ContentProfile)
    );
  } catch {
    return false;
  }
}
