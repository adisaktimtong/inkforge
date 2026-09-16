/** Browser adapter. The parser remains deterministic and does not require DOM globals. */
export { parse, parseHtml, serialize, serializeDocument, serializeHtml, toHtml } from './index.js';
export type {
  HtmlDiagnostic,
  HtmlParseOptions,
  HtmlParseResult,
  HtmlSerializeOptions,
} from './index.js';
