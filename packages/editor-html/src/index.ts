import type { BlockNode, DocumentNode, InlineNode, Mark } from '@inkforge/editor-core';
import {
  createDocument,
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
}
export interface HtmlParseResult {
  document: DocumentNode;
  diagnostics: HtmlDiagnostic[];
}
export interface HtmlSerializeOptions {
  className?: string;
  pretty?: boolean;
}

const escape = (value: string, attribute = false) =>
  value.replace(
    attribute ? /[&<>"']/g : /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const safeUrl = (url: string) =>
  /^(?:https?:|mailto:|tel:|\/|#|\?|\.)/i.test(url.trim()) &&
  !/^[a-z][a-z0-9+.-]*:/i.test(url.trim().replace(/^(?:https?:|mailto:|tel:)/i, ''));
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
  value
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':');
      if (i < 1) return null;
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
const decode = (text: string) =>
  text.replace(
    /&(?:amp|lt|gt|quot|apos|#39|nbsp);/gi,
    (x) =>
      ({
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&#39;': "'",
        '&nbsp;': '\u00a0',
      })[x.toLowerCase()] ?? x,
  );

export function parseHtml(html: string, options: HtmlParseOptions = {}): HtmlParseResult {
  const diagnostics: HtmlDiagnostic[] = [];
  const source = String(html ?? '').slice(0, options.maxInputLength ?? 2_000_000);
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
        const idx = stack.findIndex((x) => x.tag === token.name);
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
    if (token.attrs.href && !safeUrl(token.attrs.href)) {
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
      const mark = markTags[n.tag];
      const next = mark ? [...marks, mark] : marks;
      const attrs = presentation(n);
      if (n.tag === 'a' && n.attrs.href)
        return [createLink(n.attrs.href, inline(n.children, marks), attrs)];
      if (n.tag === 'span' && (attrs.className || attrs.style))
        return inline(n.children, next).map((child) => ({ ...child, ...attrs }));
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
  const blocks = (nodes: any[]): BlockNode[] =>
    nodes.flatMap((n) => {
      if (n.kind === 'text') return n.text.trim() ? [createParagraph(inline([n]))] : [];
      if (/^h[1-6]$/.test(n.tag))
        return [
          { ...createHeading(Number(n.tag[1]) as any, inline(n.children)), ...presentation(n) },
        ];
      if (n.tag === 'p' || n.tag === 'div' || n.tag === 'section' || n.tag === 'article')
        return [{ ...createParagraph(inline(n.children)), ...presentation(n) }];
      if (n.tag === 'ul' || n.tag === 'ol')
        return [
          {
            ...createList(
              n.tag === 'ol',
              n.children
                .filter((x: any) => x.tag === 'li')
                .map((x: any) => createListItem(blocks(x.children), presentation(x))),
            ),
            ...presentation(n),
          },
        ];
      return blocks(n.children);
    });
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
export function serializeHtml(document: DocumentNode, options: HtmlSerializeOptions = {}): string {
  const tagForMark: Record<Mark, string> = {
    bold: 'strong',
    italic: 'em',
    underline: 'u',
    strike: 's',
    code: 'code',
  };
  const inlines = (nodes: InlineNode[]): string =>
    nodes
      .map((n) => {
        if (n.type === 'link') {
          const href = safeUrl(n.href) ? ` href="${escape(n.href, true)}"` : '';
          return `<a${href}${attrs(n.className, n.style)}>${inlines(n.children)}</a>`;
        }
        let out = escape(n.text);
        for (const mark of [...(n.marks ?? [])].reverse()) {
          const tag = tagForMark[mark];
          if (tag) out = `<${tag}>${out}</${tag}>`;
        }
        return n.className || n.style ? `<span${attrs(n.className, n.style)}>${out}</span>` : out;
      })
      .join('');
  const render = (nodes: BlockNode[]): string =>
    nodes
      .map((n) =>
        n.type === 'paragraph'
          ? `<p${attrs(options.className, n.style, n.className)}>${inlines(n.children)}</p>`
          : n.type === 'heading'
            ? `<h${Math.min(6, Math.max(1, n.level))}${attrs(options.className, n.style, n.className)}>${inlines(n.children)}</h${Math.min(6, Math.max(1, n.level))}>`
            : `<${n.ordered ? 'ol' : 'ul'}${attrs(options.className, n.style, n.className)}>${n.items.map((i) => `<li${attrs(i.className, i.style)}>${i.children.length === 1 && i.children[0]?.type === 'paragraph' ? inlines(i.children[0].children) : render(i.children)}</li>`).join('')}</${n.ordered ? 'ol' : 'ul'}>`,
      )
      .join(options.pretty ? '\n' : '');
  return render(document.children);
}
export const serialize = serializeHtml;
export const parse = parseHtml;
export const toHtml = serializeHtml;
export const serializeDocument = serializeHtml;
