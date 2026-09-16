/** Server-safe adapter: intentionally has no DOM or window dependency. */
export { parse, parseHtml, serialize, serializeDocument, serializeHtml, toHtml } from './index.js';
export type {
  HtmlDiagnostic,
  HtmlParseOptions,
  HtmlParseResult,
  HtmlSerializeOptions,
} from './index.js';
