import type { DeepReadonly, DocumentNode } from '@inkforge/editor-core';
import {
  contentProfileFingerprint,
  createContentProfile,
  evaluateContentPolicy,
  isContentProfile,
  serializeContentAst,
  type ContentProfile,
  type ContentResult,
  type HtmlAstNode,
} from './profile.js';

export interface ProfileIdentity {
  readonly id: string;
  readonly version: string;
  readonly fingerprint: string;
}
export type EngineContentResult =
  | Readonly<{ status: 'accepted'; canonicalHtml: string; profile: ProfileIdentity }>
  | Readonly<{ status: 'rejected'; diagnostics: readonly string[] }>;
export interface EngineContentCodec {
  readonly profile: ProfileIdentity;
  encode(document: DeepReadonly<DocumentNode>): EngineContentResult;
  decode(
    html: string,
  ):
    | Readonly<{ status: 'accepted'; document: DeepReadonly<DocumentNode>; canonicalHtml: string }>
    | Readonly<{ status: 'rejected'; diagnostics: readonly string[] }>;
}
const markTags = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
} as const;
const rejected = (...diagnostics: string[]) => ({ status: 'rejected' as const, diagnostics });

/** The parser is an explicit browser/server port. No DOM/server parser is imported here. */
export function createEngineContentCodec(
  configuration: ContentProfile,
  parse: (html: string, profile: ContentProfile) => ContentResult,
): EngineContentCodec {
  if (!isContentProfile(configuration) || typeof parse !== 'function')
    throw Error('INVALID_ENGINE_CODEC');
  const profile = createContentProfile(configuration);
  const identity = Object.freeze({
    id: profile.id,
    version: String(profile.version),
    fingerprint: contentProfileFingerprint(profile),
  });
  function encode(document: DeepReadonly<DocumentNode>): EngineContentResult {
    try {
      let count = 0;
      const seen = new WeakSet<object>();
      function visit(node: any, depth: number): HtmlAstNode {
        if (
          !node ||
          typeof node !== 'object' ||
          seen.has(node) ||
          ++count > profile.maxNodes ||
          depth > profile.maxDepth
        )
          throw Error('MODEL_LIMIT_OR_ALIAS');
        seen.add(node);
        const keys: Record<string, string[]> = {
          text: ['type', 'text', 'marks', 'className', 'style'],
          'hard-break': ['type', 'className', 'style'],
          link: ['type', 'href', 'target', 'children', 'className', 'style'],
          paragraph: ['type', 'children', 'className', 'style'],
          heading: ['type', 'level', 'children', 'className', 'style'],
          list: ['type', 'ordered', 'items', 'className', 'style'],
          'list-item': ['type', 'children', 'className', 'style'],
        };
        if (!keys[node.type] || Object.keys(node).some((k) => !keys[node.type]!.includes(k)))
          throw Error('UNSUPPORTED_MODEL');
        if (node.style !== undefined) throw Error('UNSUPPORTED_MODEL_STYLE');
        const attributes: { name: string; value: string }[] = [];
        if (node.className !== undefined) {
          if (typeof node.className !== 'string') throw Error('INVALID_MODEL_CLASS');
          attributes.push({ name: 'class', value: node.className });
        }
        if (node.type === 'text') {
          if (typeof node.text !== 'string' || /[\uD800-\uDFFF]/u.test(node.text))
            throw Error('INVALID_MODEL_TEXT');
          let out: HtmlAstNode = { type: 'text', value: node.text };
          const marks: string[] = node.marks ?? [];
          if (
            !Array.isArray(marks) ||
            new Set(marks).size !== marks.length ||
            marks.some((m) => !Object.hasOwn(markTags, m))
          )
            throw Error('INVALID_MODEL_MARKS');
          for (const mark of [...marks].reverse())
            out = {
              type: 'element',
              tag: markTags[mark as keyof typeof markTags],
              attributes: [],
              children: [out],
            };
          return attributes.length
            ? { type: 'element', tag: 'span', attributes, children: [out] }
            : out;
        }
        const children =
          node.type === 'list' ? node.items : node.type === 'hard-break' ? [] : node.children;
        if (!Array.isArray(children)) throw Error('INVALID_MODEL_CHILDREN');
        const permitted =
          node.type === 'list'
            ? ['list-item']
            : node.type === 'list-item'
              ? ['paragraph', 'heading', 'list']
              : ['text', 'hard-break', 'link'];
        if (children.some((n: any) => !n || !permitted.includes(n.type)))
          throw Error('INVALID_MODEL_NESTING');
        let tag: string;
        switch (node.type) {
          case 'paragraph':
            tag = 'p';
            break;
          case 'heading':
            if (![2, 3, 4].includes(node.level)) throw Error('UNSUPPORTED_MODEL_HEADING');
            tag = 'h' + node.level;
            break;
          case 'list':
            if (typeof node.ordered !== 'boolean') throw Error('INVALID_MODEL_LIST');
            tag = node.ordered ? 'ol' : 'ul';
            break;
          case 'list-item':
            tag = 'li';
            break;
          case 'hard-break':
            tag = 'br';
            break;
          case 'link':
            tag = 'a';
            if (
              typeof node.href !== 'string' ||
              (node.target !== undefined && !['_self', '_blank'].includes(node.target))
            )
              throw Error('INVALID_MODEL_LINK');
            attributes.push({ name: 'href', value: node.href });
            if (node.target === '_blank') attributes.push({ name: 'target', value: '_blank' });
            break;
          default:
            throw Error('UNSUPPORTED_MODEL');
        }
        let astChildren = children.map((child: unknown) => visit(child, depth + 1));
        // Match the existing profile's canonical single-paragraph list-item form.
        if (
          tag === 'li' &&
          astChildren.length === 1 &&
          astChildren[0]?.type === 'element' &&
          astChildren[0].tag === 'p' &&
          astChildren[0].attributes.length === 0
        )
          astChildren = [...astChildren[0].children];
        return { type: 'element', tag, attributes, children: astChildren };
      }
      if (
        !document ||
        document.type !== 'document' ||
        !Array.isArray(document.children) ||
        Object.keys(document).some((k) => !['type', 'children'].includes(k))
      )
        return rejected('INVALID_MODEL_DOCUMENT');
      if (document.children.some((n) => !n || !['paragraph', 'heading', 'list'].includes(n.type)))
        return rejected('INVALID_MODEL_NESTING');
      const ast = document.children.map((node) => visit(node, 0));
      const diagnostics = evaluateContentPolicy(ast, profile);
      if (diagnostics.length) return rejected(...diagnostics.map((d) => d.code));
      const canonicalHtml = serializeContentAst(ast);
      if (new TextEncoder().encode(canonicalHtml).byteLength > profile.maxInputBytes)
        return rejected('CONTENT_LIMIT');
      const roundtrip = parse(canonicalHtml, profile);
      if (roundtrip.status === 'rejected')
        return rejected(...roundtrip.diagnostics.map((d) => d.code));
      if (
        roundtrip.profileFingerprint !== identity.fingerprint ||
        roundtrip.canonicalHtml !== canonicalHtml
      )
        return rejected('MODEL_ROUNDTRIP_LOSS');
      return Object.freeze({ status: 'accepted', canonicalHtml, profile: identity });
    } catch (error) {
      return rejected(error instanceof Error ? error.message : 'INVALID_MODEL');
    }
  }
  return Object.freeze({
    profile: identity,
    encode,
    decode(html: string) {
      try {
        const result = parse(html, profile);
        if (result.status === 'rejected') return rejected(...result.diagnostics.map((d) => d.code));
        if (result.profileFingerprint !== identity.fingerprint || result.canonicalHtml !== html)
          return rejected('NON_CANONICAL_HOST_VALUE');
        const witness = encode(result.document);
        if (witness.status === 'rejected') return witness;
        if (witness.canonicalHtml !== html) return rejected('MODEL_ROUNDTRIP_LOSS');
        return Object.freeze({
          status: 'accepted' as const,
          document: result.document,
          canonicalHtml: html,
        });
      } catch {
        return rejected('HOST_DECODE_FAILED');
      }
    },
  });
}
