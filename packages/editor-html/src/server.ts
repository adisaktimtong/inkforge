/** Server-safe adapter: intentionally has no DOM or window dependency. */
export { parse, parseHtml, serialize, serializeDocument, serializeHtml, toHtml } from './index.js';
export type {
  HtmlDiagnostic,
  HtmlParseOptions,
  HtmlParseResult,
  HtmlSerializeOptions,
} from './index.js';

import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import sanitizeHtml from 'sanitize-html';
import {
  acceptContentAst,
  isProfileHref,
  profileInputDiagnostic,
  serializeContentAst,
  type ContentDiagnostic,
  type ContentProfile,
  type ContentResult,
  type HtmlAstNode,
} from './profile.js';

function normalizedAst(
  input: string,
  profile: ContentProfile,
): { nodes: HtmlAstNode[]; diagnostics: ContentDiagnostic[] } {
  const diagnostics: ContentDiagnostic[] = [];
  let count = 0;
  // Syntax decisions are shared with the browser before parsing. Parse5-only
  // recovery diagnostics (for example optional entity semicolons) must not create
  // a different acceptance policy from the native browser parser.
  const fragment = parseFragment(input);
  function convert(node: DefaultTreeAdapterTypes.ChildNode, depth: number): HtmlAstNode[] {
    if (++count > profile.maxNodes || depth > profile.maxDepth) {
      if (!diagnostics.some((d) => d.code === 'CONTENT_LIMIT'))
        diagnostics.push({
          code: 'CONTENT_LIMIT',
          message: 'HTML exceeds traversal limits',
          path: '',
          severity: 'error',
        });
      return [];
    }
    if (node.nodeName === '#text')
      return [{ type: 'text', value: (node as DefaultTreeAdapterTypes.TextNode).value }];
    if (node.nodeName === '#comment') return [];
    const element = node as DefaultTreeAdapterTypes.Element;
    return [
      {
        type: 'element',
        tag: element.tagName,
        namespace: element.namespaceURI,
        attributes: element.attrs.map((a) => ({
          name: a.prefix ? `${a.prefix}:${a.name}` : a.name,
          value: a.value,
        })),
        children: element.childNodes
          .slice(0, profile.maxNodes + 1)
          .flatMap((child) => convert(child, depth + 1)),
      },
    ];
  }
  return {
    nodes: fragment.childNodes.slice(0, profile.maxNodes + 1).flatMap((child) => convert(child, 0)),
    diagnostics,
  };
}

/** Parse5 policy validation rejects the whole input instead of silently removing unsupported content. */
export function parseContentHtml(input: string, profile: ContentProfile): ContentResult {
  const diagnostics = profileInputDiagnostic(input, profile);
  if (diagnostics.length) return { status: 'rejected', diagnostics };
  const parsed = normalizedAst(input, profile);
  return acceptContentAst(parsed.nodes, profile, parsed.diagnostics);
}

/** Compile the same allowlist for a second server sanitizer, then evaluate its result again. */
export function sanitizeContentHtml(input: string, profile: ContentProfile): ContentResult {
  const first = parseContentHtml(input, profile);
  if (first.status === 'rejected') return first;
  const clean = sanitizeHtml(first.canonicalHtml, {
    allowedTags: [
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
    ],
    allowedAttributes: { '*': ['class'], a: ['href', 'target', 'rel', 'class'] },
    allowedClasses: { '*': [...profile.tokenClasses] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cms-ref', 'cms-route'],
    allowProtocolRelative: false,
  });
  return parseContentHtml(clean, profile);
}

/** Host resolves authorization/locale/current asset identity; stored references never reach public hrefs. */
export function renderContentHtml(
  input: string,
  profile: ContentProfile,
  resolveReference: (href: string) => string | null,
): { status: 'accepted'; html: string } | Extract<ContentResult, { status: 'rejected' }> {
  const parsed = sanitizeContentHtml(input, profile);
  if (parsed.status === 'rejected') return parsed;
  const ast = normalizedAst(parsed.canonicalHtml, profile);
  const diagnostics: ContentDiagnostic[] = [];
  const visit = (nodes: readonly HtmlAstNode[]): HtmlAstNode[] =>
    nodes.flatMap((node) => {
      if (node.type === 'text') return [node];
      const children = visit(node.children);
      if (node.tag !== 'a') return [{ ...node, children }];
      const href = node.attributes.find((a) => a.name === 'href')?.value ?? '';
      if (!/^cms-(?:ref|route):/.test(href)) return [{ ...node, children }];
      let resolved: string | null;
      try {
        resolved = resolveReference(href);
      } catch {
        diagnostics.push({
          code: 'REFERENCE_RESOLUTION_FAILED',
          message: 'Host reference resolver failed',
          path: '',
          severity: 'error',
        });
        return [];
      }
      if (resolved === null) return children;
      if (
        !resolved ||
        /[\u0000-\u0020\u007f\\<>"']/.test(resolved) ||
        !(
          /^\/(?!\/)/.test(resolved) ||
          (!resolved.startsWith('cms-') && isProfileHref(resolved, profile))
        )
      ) {
        diagnostics.push({
          code: 'UNSAFE_RESOLVED_URL',
          message: 'Host returned an unsafe URL',
          path: '',
          severity: 'error',
        });
        return [];
      }
      return [
        {
          ...node,
          children,
          attributes: node.attributes.map((a) =>
            a.name === 'href' ? { ...a, value: resolved } : a,
          ),
        },
      ];
    });
  const resolved = visit(ast.nodes);
  return diagnostics.length
    ? { status: 'rejected', diagnostics }
    : { status: 'accepted', html: serializeContentAst(resolved) };
}
