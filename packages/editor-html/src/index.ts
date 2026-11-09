import type {
  BlockNode,
  DocumentNode,
  InlineNode,
  Mark,
  DeepReadonly,
} from '@inkforge/editor-core';
import {
  createDocument,
  createHardBreak,
  createHeading,
  createLink,
  createList,
  createListItem,
  createParagraph,
  createText,
} from '@inkforge/editor-core';

export interface HtmlDiagnostic {
  code: string;
  message: string;
  tag?: string;
  attribute?: string;
}
export interface HtmlParseOptions {
  maxInputLength?: number;
  /** Only for validated host reference profiles. Never enables arbitrary custom schemes. */
  referenceLinks?: boolean;
}
export interface HtmlParseResult {
  document: DocumentNode;
  diagnostics: HtmlDiagnostic[];
}
export interface HtmlSerializeOptions {
  className?: string;
  pretty?: boolean;
  referenceLinks?: boolean;
}

const escape = (value: string, attribute = false) =>
  value.replace(
    attribute ? /[&<>"']/g : /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const safeUrl = (url: string, referenceLinks = false) =>
  (referenceLinks &&
    /^(?:cms-ref:(?:content|category|asset):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|cms-route:[a-z][a-z0-9.-]*)$/.test(
      url,
    )) ||
  (/^(?:https?:|mailto:|tel:|\/|#|\?|\.)/i.test(url.trim()) &&
    !/^[a-z][a-z0-9+.-]*:/i.test(url.trim().replace(/^(?:https?:|mailto:|tel:)/i, '')));
const allowedStyles = new Set([
  'color',
  'background-color',
  'text-align',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-decoration',
]);
const safeStyle = (value: string, diagnostics: HtmlDiagnostic[]) =>
  decodeCssEscapes(decode(value))
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i < 1) {
        diagnostics.push({
          code: 'UNSAFE_STYLE',
          message: `Removed unsafe CSS declaration: ${decl.slice(0, 40)}`,
          attribute: 'style',
        });
        return null;
      }
      const property = decl.slice(0, i).trim().toLowerCase();
      const val = decl.slice(i + 1).trim();
      if (
        !allowedStyles.has(property) ||
        /(?:url\s*\(|expression\s*\(|javascript:|@import|[<>])/i.test(val)
      ) {
        diagnostics.push({
          code: 'UNSAFE_STYLE',
          message: `Removed unsafe CSS declaration: ${property}`,
          attribute: 'style',
        });
        return null;
      }
      return [property, val] as const;
    })
    .filter((x): x is readonly [string, string] => !!x)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((x) => `${x[0]}: ${x[1]}`)
    .join('; ');

// Preserve declaration fallbacks: only the browser can decide whether a safe value
// is supported. Inherited declarations lose priority against a child's own styles.
function mergeInlineStyle(
  parent: string | undefined,
  child: string | undefined,
  diagnostics: HtmlDiagnostic[],
) {
  if (!child) return safeStyle(parent ?? '', diagnostics);
  const declarations = (source: string | undefined) =>
    (source ?? '')
      .split(';')
      .map((value) => value.trim())
      .filter(Boolean);
  const inherited = declarations(parent)
    .sort((a, b) => Number(/!important\s*$/i.test(a)) - Number(/!important\s*$/i.test(b)))
    .map((value) => value.replace(/\s*!important\s*$/i, ''));
  const own = declarations(child);
  const resolved = own.flatMap((declaration) => {
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (!/^inherit(?:\s*!important)?$/i.test(value)) return [declaration];
    const source = inherited.filter((item) => item.slice(0, item.indexOf(':')).trim() === property);
    return source.length
      ? source.map((item) => item + (/!important\s*$/i.test(value) ? ' !important' : ''))
      : [declaration];
  });
  return safeStyle([...inherited, ...resolved].join('; '), diagnostics);
}

// CSS escapes can disguise both property names and executable values (for
// example, `u\\72l(...)` or `expre\\73sion(...)`). Decode them before applying
// the strict allowlist. Invalid/incomplete escapes are retained as literals.
function decodeCssEscapes(value: string): string {
  return value.replace(
    /\\([0-9a-fA-F]{1,6})(?:[ \t\r\n\f]|\r\n)?|\\([^\r\n\f])/g,
    (_m, hex, escaped) => {
      if (hex) {
        const codePoint = Number.parseInt(hex, 16);
        return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : '\ufffd';
      }
      return escaped ?? _m;
    },
  );
}

type Token =
  | { close?: boolean; name: string; attrs: Record<string, string>; raw?: string }
  | { text: string };
const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  const re = /<!--[\s\S]*?-->|<\s*(\/?)\s*([A-Za-z][\w:-]*)([^>]*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4]) tokens.push({ text: m[4] });
    else if (m[1] !== undefined && m[2]) {
      const attrs: Record<string, string> = {};
      const ar = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let a;
      while ((a = ar.exec(m[3] ?? ''))) {
        const key = a[1];
        if (key) attrs[key.toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
      }
      tokens.push({ name: m[2].toLowerCase(), close: !!m[1], attrs });
    }
  }
  return tokens;
};
const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  hellip: '\u2026',
  mdash: '\u2014',
  ndash: '\u2013',
  laquo: '\u00ab',
  raquo: '\u00bb',
  bull: '\u2022',
  middot: '\u00b7',
  cent: '\u00a2',
  pound: '\u00a3',
  yen: '\u00a5',
  euro: '\u20ac',
  sect: '\u00a7',
  para: '\u00b6',
  plusmn: '\u00b1',
  times: '\u00d7',
  divide: '\u00f7',
  deg: '\u00b0',
};
const decode = (text: string) =>
  text.replace(/&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);?/gi, (entity) => {
    const body = entity.slice(1).replace(/;$/, '');
    if (body[0]?.toLowerCase() === '#') {
      const hex = body[1]?.toLowerCase() === 'x';
      const digits = body.slice(hex ? 2 : 1);
      if (!digits || !/^[0-9a-f]+$/i.test(digits) || (!hex && !/^\d+$/.test(digits))) return entity;
      const codePoint = Number.parseInt(digits, hex ? 16 : 10);
      return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[body.toLowerCase()] ?? entity;
  });

export function parseHtml(html: string, options: HtmlParseOptions = {}): HtmlParseResult {
  const diagnostics: HtmlDiagnostic[] = [];
  const input = String(html ?? '');
  const maxInputLength = options.maxInputLength ?? 2_000_000;
  const source = input.slice(0, Math.max(0, maxInputLength));
  if (source.length < input.length) {
    diagnostics.push({
      code: 'INPUT_TRUNCATED',
      message: `Input truncated to ${source.length} characters`,
    });
  }
  const root: { type: 'root'; children: any[] } = { type: 'root', children: [] };
  const stack: any[] = [root];
  const unsafe = new Set(['script', 'iframe', 'object', 'embed', 'form', 'style', 'svg', 'math']);
  let skip = 0;
  const add = (node: any) => stack[stack.length - 1].children.push(node);
  for (const token of tokenize(source)) {
    if ('text' in token) {
      if (!skip) add({ kind: 'text', text: decode(token.text) });
      continue;
    }
    if (token.close) {
      if (unsafe.has(token.name) && skip) skip--;
      else {
        const idx = stack.map((x) => x.tag).lastIndexOf(token.name);
        if (idx >= 0) stack.length = idx;
      }
      continue;
    }
    if (unsafe.has(token.name)) {
      diagnostics.push({
        code: 'UNSAFE_TAG',
        message: `Removed unsafe <${token.name}>`,
        tag: token.name,
      });
      skip++;
      continue;
    }
    if (skip) continue;
    const node = { kind: 'tag', tag: token.name, attrs: token.attrs, children: [] as any[] };
    add(node);
    if (!['br', 'hr', 'img', 'meta', 'input', 'link', 'wbr'].includes(token.name)) stack.push(node);
    for (const attr of Object.keys(token.attrs))
      if (attr.startsWith('on')) {
        diagnostics.push({
          code: 'EVENT_ATTRIBUTE',
          message: `Removed event handler ${attr}`,
          tag: token.name,
          attribute: attr,
        });
        delete token.attrs[attr];
      }
    if (token.attrs.href) token.attrs.href = decode(token.attrs.href);
    if (token.attrs.href && !safeUrl(token.attrs.href, options.referenceLinks)) {
      diagnostics.push({
        code: 'UNSAFE_URL',
        message: 'Removed unsafe URL',
        tag: token.name,
        attribute: 'href',
      });
      delete token.attrs.href;
    }
  }
  const markTags: Record<string, Mark> = {
    strong: 'bold',
    b: 'bold',
    em: 'italic',
    i: 'italic',
    u: 'underline',
    s: 'strike',
    strike: 'strike',
    code: 'code',
  };
  const inline = (nodes: any[], marks: Mark[] = []): InlineNode[] =>
    nodes.flatMap((n) => {
      if (n.kind === 'text') return n.text ? [createText(n.text, marks)] : [];
      if (n.tag === 'br') return [{ ...createHardBreak(), ...presentation(n) }];
      const mark = markTags[n.tag];
      const next = mark ? [...marks, mark] : marks;
      const attrs = presentation(n);
      if (n.tag === 'a' && n.attrs.href)
        return [
          {
            ...createLink(n.attrs.href, inline(n.children, marks), attrs),
            ...(n.attrs.target === '_blank' ? { target: '_blank' as const } : {}),
          },
        ];
      if (n.tag === 'span' && (attrs.className || attrs.style))
        return inline(n.children, next).map((child) => {
          const className = [
            ...new Set([
              ...(attrs.className ?? '').split(/\s+/),
              ...(child.className ?? '').split(/\s+/),
            ]),
          ]
            .filter(Boolean)
            .join(' ');
          const style = mergeInlineStyle(attrs.style, child.style, diagnostics);
          return { ...child, ...(className ? { className } : {}), ...(style ? { style } : {}) };
        });
      return inline(n.children, next);
    });
  const presentation = (n: any): { className?: string; style?: string } => {
    const out: { className?: string; style?: string } = {};
    if (n.attrs.class)
      out.className = n.attrs.class
        .split(/\s+/)
        .filter((x: string) => /^[A-Za-z0-9_-]+$/.test(x))
        .join(' ');
    if (n.attrs.style) {
      const style = safeStyle(n.attrs.style, diagnostics);
      if (style) out.style = style;
    }
    return out;
  };
  const blockTag = /^(?:p|div|section|article|h[1-6]|ul|ol)$/;
  const hasBlocks = (nodes: any[]): boolean =>
    nodes.some((node) => blockTag.test(node.tag ?? '') || hasBlocks(node.children ?? []));
  const blocks = (nodes: any[]): BlockNode[] => {
    const result: BlockNode[] = [];
    let run: any[] = [];
    const flush = () => {
      // Keep spaces between inline siblings; discard only block indentation.
      const children = inline(run);
      const hasContent = (nodes: InlineNode[]): boolean =>
        nodes.some(
          (node) =>
            node.type === 'hard-break' ||
            (node.type === 'text' ? !!node.text.trim() : hasContent(node.children)),
        );
      if (hasContent(children)) result.push(createParagraph(children));
      run = [];
    };
    for (const n of nodes) {
      if (!blockTag.test(n.tag ?? '') && !hasBlocks(n.children ?? [])) {
        run.push(n);
        continue;
      }
      flush();
      if (/^h[1-6]$/.test(n.tag))
        result.push({
          ...createHeading(Number(n.tag[1]) as any, inline(n.children)),
          ...presentation(n),
        });
      else if (n.tag === 'ul' || n.tag === 'ol')
        result.push({
          ...createList(
            n.tag === 'ol',
            n.children
              .filter((x: any) => x.tag === 'li')
              .map((x: any) => createListItem(blocks(x.children), presentation(x))),
          ),
          ...presentation(n),
        });
      else if (hasBlocks(n.children)) result.push(...blocks(n.children));
      else result.push({ ...createParagraph(inline(n.children)), ...presentation(n) });
    }
    flush();
    return result;
  };
  return { document: createDocument(blocks(root.children)), diagnostics };
}

const safeClass = (value?: string) =>
  value
    ?.split(/\s+/)
    .filter((x) => /^[A-Za-z0-9_-]+$/.test(x))
    .join(' ');
const attrs = (className?: string, style?: string, override?: string) => {
  const cls = override ?? className;
  const cleanClass = safeClass(cls);
  const cleanStyle = style ? safeStyle(style, []) : '';
  return `${cleanClass ? ` class="${escape(cleanClass, true)}"` : ''}${cleanStyle ? ` style="${escape(cleanStyle, true)}"` : ''}`;
};
export function serializeHtml(
  document: DeepReadonly<DocumentNode>,
  options: HtmlSerializeOptions = {},
): string {
  const tagForMark: Record<Mark, string> = {
    bold: 'strong',
    italic: 'em',
    underline: 'u',
    strike: 's',
    code: 'code',
  };
  const inlines = (nodes: DeepReadonly<InlineNode[]>): string =>
    nodes
      .map((n) => {
        if (n.type === 'hard-break') return `<br${attrs(n.className, n.style)}>`;
        if (n.type === 'link') {
          const href = safeUrl(n.href, options.referenceLinks)
            ? ` href="${escape(n.href, true)}"`
            : '';
          const target = n.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
          return `<a${href}${target}${attrs(n.className, n.style)}>${inlines(n.children)}</a>`;
        }
        let out = escape(n.text);
        for (const mark of [...(n.marks ?? [])].reverse()) {
          const tag = tagForMark[mark];
          if (tag) out = `<${tag}>${out}</${tag}>`;
        }
        return n.className || n.style ? `<span${attrs(n.className, n.style)}>${out}</span>` : out;
      })
      .join('');
  const render = (nodes: DeepReadonly<BlockNode[]>): string =>
    nodes
      .map((n) =>
        n.type === 'paragraph'
          ? `<p${attrs(options.className, n.style, n.className)}>${inlines(n.children)}</p>`
          : n.type === 'heading'
            ? `<h${Math.min(6, Math.max(1, n.level))}${attrs(options.className, n.style, n.className)}>${inlines(n.children)}</h${Math.min(6, Math.max(1, n.level))}>`
            : `<${n.ordered ? 'ol' : 'ul'}${attrs(options.className, n.style, n.className)}>${n.items.map((i) => `<li${attrs(i.className, i.style)}>${i.children.length === 1 && i.children[0]?.type === 'paragraph' && !i.children[0].className && !i.children[0].style ? inlines(i.children[0].children) : render(i.children)}</li>`).join('')}</${n.ordered ? 'ol' : 'ul'}>`,
      )
      .join(options.pretty ? '\n' : '');
  return render(document.children);
}
export const serialize = serializeHtml;
export const parse = parseHtml;
export const toHtml = serializeHtml;
export const serializeDocument = serializeHtml;

export * from './profile.js';
