/** Browser adapter. The parser remains deterministic and does not require DOM globals. */
export { parse, parseHtml, serialize, serializeDocument, serializeHtml, toHtml } from './index.js';
export type {
  HtmlDiagnostic,
  HtmlParseOptions,
  HtmlParseResult,
  HtmlSerializeOptions,
} from './index.js';

import createDOMPurify from 'dompurify';
import {
  acceptContentAst,
  profileInputDiagnostic,
  type ContentDiagnostic,
  type ContentProfile,
  type ContentResult,
  type HtmlAstNode,
} from './profile.js';

export function parseContentHtml(
  input: string,
  profile: ContentProfile,
  ownerDocument: Document = document,
): ContentResult {
  const diagnostics = profileInputDiagnostic(input, profile);
  if (diagnostics.length) return { status: 'rejected', diagnostics };
  // Template contents are inert; untrusted input is never attached to a live DOM.
  const template = ownerDocument.createElement('template');
  template.innerHTML = input;
  let count = 0;
  const convert = (node: Node, depth: number): HtmlAstNode[] => {
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
    if (node.nodeType === 3) return [{ type: 'text', value: node.nodeValue ?? '' }];
    if (node.nodeType !== 1) return [];
    const element = node as Element;
    return [
      {
        type: 'element',
        tag: element.localName,
        namespace: element.namespaceURI ?? '',
        attributes: Array.from(element.attributes, (a) => ({ name: a.name, value: a.value })),
        children: Array.from(element.childNodes)
          .slice(0, profile.maxNodes + 1)
          .flatMap((child) => convert(child, depth + 1)),
      },
    ];
  };
  return acceptContentAst(
    Array.from(template.content.childNodes)
      .slice(0, profile.maxNodes + 1)
      .flatMap((node) => convert(node, 0)),
    profile,
    diagnostics,
  );
}

export function sanitizeContentHtml(
  input: string,
  profile: ContentProfile,
  ownerDocument: Document = document,
): ContentResult {
  const first = parseContentHtml(input, profile, ownerDocument);
  if (first.status === 'rejected') return first;
  const view = ownerDocument.defaultView;
  if (!view)
    return {
      status: 'rejected',
      diagnostics: [
        {
          code: 'BROWSER_WINDOW_REQUIRED',
          message: 'A browser document is required',
          path: '',
          severity: 'error',
        },
      ],
    };
  const purifier = createDOMPurify(view);
  const clean = purifier.sanitize(first.canonicalHtml, {
    ALLOWED_TAGS: [
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
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|tel:|cms-ref:|cms-route:)/,
  });
  return parseContentHtml(clean, profile, ownerDocument);
}
