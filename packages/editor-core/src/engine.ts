import type { DocumentNode, DeepReadonly } from './index.js';

export interface EditorSelection {
  /** UTF-16 semantic offsets; text block boundaries and hard breaks occupy one position. */
  readonly anchor: number;
  readonly focus: number;
}
/** Matches the DOM adapter's semantic offsets without importing a browser API. */
export function documentSelectionSize(document: DeepReadonly<DocumentNode>): number {
  const inline = (nodes: DeepReadonly<import('./index.js').InlineNode[]>): number =>
    nodes.reduce(
      (sum, node) =>
        sum +
        (node.type === 'text'
          ? node.text.length
          : node.type === 'hard-break'
            ? 1
            : inline(node.children)),
      0,
    );
  const blocks = (nodes: DeepReadonly<import('./index.js').BlockNode[]>): number =>
    nodes.reduce(
      (sum, node) =>
        sum +
        (node.type === 'list'
          ? node.items.reduce((n, item) => n + blocks(item.children), 0)
          : inline(node.children) + 1),
      0,
    );
  return blocks(document.children);
}
export interface EngineSnapshot {
  readonly sessionId: string;
  readonly revision: number;
  readonly document: DeepReadonly<DocumentNode>;
  readonly selection: EditorSelection | null;
  readonly dirty: boolean;
  readonly composing: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
export interface EngineDiagnostic {
  code: string;
  path?: string;
}
export type EngineResult =
  | { status: 'committed' | 'noChange'; snapshot: EngineSnapshot }
  | { status: 'rejected'; diagnostics: EngineDiagnostic[] };
export interface SelectionBookmark {
  readonly sessionId: string;
  readonly revision: number;
  readonly selection: EditorSelection | null;
}
export interface SaveCheckpoint {
  readonly id: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly document: DeepReadonly<DocumentNode>;
}
export type EditorCommand =
  | {
      kind: 'replaceDocument';
      document: DocumentNode | DeepReadonly<DocumentNode>;
      selection?: EditorSelection | null;
      historyGroup?: string;
    }
  | { kind: 'setSelection'; selection: EditorSelection | null }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'beginComposition' }
  | { kind: 'endComposition' };
export interface EditorEngineOptions {
  document: DocumentNode | DeepReadonly<DocumentNode>;
  origin?: 'persisted' | 'unsaved';
  maxDocumentBytes?: number;
  maxHistoryEntries?: number;
  maxHistoryBytes?: number;
  maxPendingCheckpoints?: number;
  /** Pure, synchronous host validation. HTML/network/DOM adapters stay outside the kernel. */
  validate?: (document: DocumentNode) => readonly EngineDiagnostic[];
}
export interface EditorEngine {
  getSnapshot(): EngineSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(
    command: EditorCommand,
    context: { expectedSessionId: string; expectedRevision?: number },
  ): EngineResult;
  load(
    document: DocumentNode | DeepReadonly<DocumentNode>,
    context: { expectedSessionId: string; origin: 'persisted' | 'unsaved' },
  ): EngineResult;
  captureSelection(): SelectionBookmark;
  restoreSelection(bookmark: SelectionBookmark): EngineResult;
  createSaveCheckpoint():
    | { status: 'created'; checkpoint: SaveCheckpoint }
    | Extract<EngineResult, { status: 'rejected' }>;
  acknowledgeSaved(checkpoint: SaveCheckpoint): EngineResult;
  releaseSaveCheckpoint(checkpoint: SaveCheckpoint): EngineResult;
  closeHistoryGroup(): void;
  dispose(): void;
}

let nextEngine = 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
const bytes = (value: unknown) => new TextEncoder().encode(canonical(value)).byteLength;

/** Bounds and wire-shape validation apply even when the host supplies an additional validator. */
export function validateEditorDocument(document: unknown): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = [];
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const seen = new Set<unknown>();
  let count = 0;
  function visit(node: unknown, path: string, depth: number, allowed: readonly string[]): void {
    if (
      !record(node) ||
      typeof node.type !== 'string' ||
      !allowed.includes(node.type) ||
      seen.has(node) ||
      depth > 64 ||
      ++count > 10000
    ) {
      diagnostics.push({ code: 'INVALID_DOCUMENT', path });
      return;
    }
    seen.add(node);
    const fields: Record<string, string[]> = {
      document: ['children'],
      paragraph: ['children'],
      heading: ['level', 'children'],
      text: ['text', 'marks'],
      link: ['href', 'target', 'children'],
      'hard-break': [],
      list: ['ordered', 'items'],
      'list-item': ['children'],
    };
    if (
      Object.keys(node).some(
        (key) =>
          !['type', 'className', 'style', ...(fields[String(node.type)] ?? [])].includes(key),
      )
    )
      diagnostics.push({ code: 'UNKNOWN_NODE_FIELD', path });
    if (node.className !== undefined && typeof node.className !== 'string')
      diagnostics.push({ code: 'INVALID_PRESENTATION', path });
    if (node.style !== undefined && typeof node.style !== 'string')
      diagnostics.push({ code: 'INVALID_PRESENTATION', path });
    if (node.type === 'text') {
      if (
        typeof node.text !== 'string' ||
        (node.marks !== undefined &&
          (!Array.isArray(node.marks) ||
            node.marks.some(
              (m) => !['bold', 'italic', 'underline', 'strike', 'code'].includes(String(m)),
            )))
      )
        diagnostics.push({ code: 'INVALID_TEXT', path });
    } else if (
      node.type === 'heading' &&
      (!Number.isInteger(node.level) || Number(node.level) < 1 || Number(node.level) > 6)
    )
      diagnostics.push({ code: 'INVALID_HEADING', path });
    if (node.type === 'link' && typeof node.href !== 'string')
      diagnostics.push({ code: 'INVALID_LINK', path });
    if (
      node.type === 'link' &&
      node.target !== undefined &&
      !['_self', '_blank'].includes(String(node.target))
    )
      diagnostics.push({ code: 'INVALID_LINK_TARGET', path });
    const children =
      node.type === 'list'
        ? node.items
        : ['document', 'paragraph', 'heading', 'list-item', 'link'].includes(node.type)
          ? node.children
          : undefined;
    if (node.type === 'list' && typeof node.ordered !== 'boolean')
      diagnostics.push({ code: 'INVALID_LIST', path });
    if (
      children !== undefined ||
      ['document', 'paragraph', 'heading', 'list', 'list-item', 'link'].includes(node.type)
    ) {
      if (!Array.isArray(children)) diagnostics.push({ code: 'INVALID_CHILDREN', path });
      else
        children.forEach((child, index) =>
          visit(
            child,
            `${path}/${node.type === 'list' ? 'items' : 'children'}/${index}`,
            depth + 1,
            node.type === 'list'
              ? ['list-item']
              : ['paragraph', 'heading', 'link'].includes(String(node.type))
                ? node.type === 'link'
                  ? ['text', 'hard-break']
                  : ['text', 'link', 'hard-break']
                : ['paragraph', 'heading', 'list'],
          ),
        );
    }
  }
  visit(document, '', 0, ['document']);
  return diagnostics;
}

/** Pure document/history kernel. No DOM, React, persistence, timers or network dependency. */
export function createEditorEngine(options: EditorEngineOptions): EditorEngine {
  const limits = {
    document: options.maxDocumentBytes ?? 2_097_152,
    entries: options.maxHistoryEntries ?? 100,
    history: options.maxHistoryBytes ?? 8_388_608,
    checkpoints: options.maxPendingCheckpoints ?? 2,
  };
  if (Object.values(limits).some((v) => !Number.isSafeInteger(v) || v < 1))
    throw new Error('Invalid editor limits');
  function validate(value: DocumentNode | DeepReadonly<DocumentNode>): EngineDiagnostic[] {
    const shape = validateEditorDocument(value);
    if (shape.length) return shape;
    if (bytes(value) > limits.document) return [{ code: 'DOCUMENT_LIMIT_EXCEEDED' }];
    try {
      return [...(options.validate?.(clone(value) as DocumentNode) ?? [])];
    } catch {
      return [{ code: 'VALIDATOR_FAILED' }];
    }
  }
  if (validate(options.document).length) throw new Error('Invalid initial editor document');
  const identity = `inkforge-${++nextEngine}`;
  let session = 1,
    revision = 0,
    checkpointNumber = 0,
    savedRevision = -1;
  let document = freeze(clone(options.document) as DocumentNode);
  let baseline = options.origin === 'unsaved' ? null : canonical(document);
  let selection: EditorSelection | null = null,
    composing = false,
    disposed = false,
    notifying = false;
  type Entry = {
    before: DocumentNode;
    after: DocumentNode;
    beforeSelection: EditorSelection | null;
    afterSelection: EditorSelection | null;
    group?: string;
  };
  let undo: Entry[] = [],
    redo: Entry[] = [],
    openGroup: string | undefined;
  const checkpoints = new Map<string, SaveCheckpoint>();
  const listeners = new Set<() => void>();
  const rejected = (code: string): Extract<EngineResult, { status: 'rejected' }> => ({
    status: 'rejected',
    diagnostics: [{ code }],
  });
  const sessionId = () => `${identity}:${session}`;
  const selected = (value: EditorSelection | null): EditorSelection | null =>
    value ? freeze({ ...value }) : null;
  const validSelection = (
    value: EditorSelection | null,
    target: DeepReadonly<DocumentNode> = document,
  ) =>
    value === null ||
    (!!value &&
      [value.anchor, value.focus].every(
        (v) => Number.isSafeInteger(v) && v >= 0 && v <= documentSelectionSize(target),
      ));
  const snapshotValue = (): EngineSnapshot =>
    freeze({
      sessionId: sessionId(),
      revision,
      document,
      selection,
      composing,
      dirty: baseline === null || baseline !== canonical(document),
      canUndo: undo.length > 0,
      canRedo: redo.length > 0,
    });
  let snapshot = snapshotValue();
  function publish(): EngineResult {
    snapshot = snapshotValue();
    notifying = true;
    try {
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          /* One subscriber cannot reverse a committed edit. */
        }
      }
    } finally {
      notifying = false;
    }
    return { status: 'committed', snapshot };
  }
  const guard = (expected?: string) =>
    disposed
      ? 'DISPOSED'
      : notifying
        ? 'REENTRANT_MUTATION'
        : expected !== undefined && expected !== sessionId()
          ? 'STALE_SESSION'
          : undefined;
  const noChange = (): EngineResult => ({ status: 'noChange', snapshot });
  const engine: EditorEngine = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      if (!disposed) listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(command, context) {
      const error = guard(context.expectedSessionId);
      if (error) return rejected(error);
      if (context.expectedRevision !== undefined && context.expectedRevision !== revision)
        return rejected('STALE_REVISION');
      if (command.kind === 'beginComposition' || command.kind === 'endComposition') {
        const next = command.kind === 'beginComposition';
        if (next === composing) return noChange();
        composing = next;
        openGroup = undefined;
        return publish();
      }
      if (composing) return rejected('COMPOSITION_ACTIVE');
      if (command.kind === 'setSelection') {
        if (!validSelection(command.selection)) return rejected('INVALID_SELECTION');
        if (canonical(selection) === canonical(command.selection)) return noChange();
        selection = selected(command.selection);
        openGroup = undefined;
        return publish();
      }
      if (command.kind === 'undo' || command.kind === 'redo') {
        const from = command.kind === 'undo' ? undo : redo,
          to = command.kind === 'undo' ? redo : undo;
        const entry = from.pop();
        if (!entry) return noChange();
        to.push(entry);
        document = command.kind === 'undo' ? entry.before : entry.after;
        selection = command.kind === 'undo' ? entry.beforeSelection : entry.afterSelection;
        openGroup = undefined;
        revision++;
        return publish();
      }
      const diagnostics = validate(command.document);
      if (diagnostics.length) return { status: 'rejected', diagnostics };
      if (command.selection !== undefined && !validSelection(command.selection, command.document))
        return rejected('INVALID_SELECTION');
      if (canonical(command.document) === canonical(document)) {
        if (
          command.selection === undefined ||
          canonical(selection) === canonical(command.selection)
        )
          return noChange();
        selection = selected(command.selection);
        return publish();
      }
      const next = freeze(clone(command.document) as DocumentNode);
      const nextSelection =
        command.selection === undefined
          ? validSelection(selection, next)
            ? selection
            : null
          : selected(command.selection);
      const last = undo.at(-1);
      const grouped = !!command.historyGroup && command.historyGroup === openGroup && !!last;
      const entry: Entry = {
        before: grouped ? last.before : document,
        after: next,
        beforeSelection: grouped ? last.beforeSelection : selection,
        afterSelection: nextSelection,
        ...(command.historyGroup ? { group: command.historyGroup } : {}),
      };
      if (bytes(entry) > limits.history) return rejected('HISTORY_LIMIT_EXCEEDED');
      if (grouped) undo.pop();
      undo.push(entry);
      redo = [];
      while (
        undo.length > limits.entries ||
        undo.reduce((n, e) => n + bytes(e), 0) > limits.history
      )
        undo.shift();
      document = next;
      selection = nextSelection;
      openGroup = command.historyGroup;
      revision++;
      return publish();
    },
    load(value, context) {
      const error = guard(context.expectedSessionId);
      if (error) return rejected(error);
      if (composing) return rejected('COMPOSITION_ACTIVE');
      const diagnostics = validate(value);
      if (diagnostics.length) return { status: 'rejected', diagnostics };
      document = freeze(clone(value) as DocumentNode);
      baseline = context.origin === 'persisted' ? canonical(document) : null;
      session++;
      revision++;
      savedRevision = -1;
      composing = false;
      selection = null;
      undo = [];
      redo = [];
      openGroup = undefined;
      checkpoints.clear();
      return publish();
    },
    captureSelection: () =>
      freeze({ sessionId: sessionId(), revision, selection: selected(selection) }),
    restoreSelection(bookmark) {
      if (bookmark.sessionId !== sessionId() || bookmark.revision !== revision)
        return rejected('STALE_BOOKMARK');
      return engine.dispatch(
        { kind: 'setSelection', selection: bookmark.selection },
        { expectedSessionId: bookmark.sessionId },
      );
    },
    createSaveCheckpoint() {
      const error = guard();
      if (error) return rejected(error);
      if (composing) return rejected('COMPOSITION_ACTIVE');
      if (checkpoints.size >= limits.checkpoints) return rejected('CHECKPOINT_LIMIT_EXCEEDED');
      const checkpoint = freeze({
        id: `${sessionId()}:save:${++checkpointNumber}`,
        sessionId: sessionId(),
        revision,
        document: freeze(clone(document)),
      });
      checkpoints.set(checkpoint.id, checkpoint);
      openGroup = undefined;
      return { status: 'created', checkpoint };
    },
    acknowledgeSaved(checkpoint) {
      const error = guard(checkpoint.sessionId);
      if (error) return rejected(error);
      if (checkpoints.get(checkpoint.id) !== checkpoint) return rejected('UNKNOWN_CHECKPOINT');
      checkpoints.delete(checkpoint.id);
      if (checkpoint.revision < savedRevision) return rejected('STALE_CHECKPOINT');
      baseline = canonical(checkpoint.document);
      savedRevision = checkpoint.revision;
      openGroup = undefined;
      return publish();
    },
    releaseSaveCheckpoint(checkpoint) {
      const error = guard(checkpoint.sessionId);
      if (error) return rejected(error);
      if (checkpoints.get(checkpoint.id) !== checkpoint) return rejected('UNKNOWN_CHECKPOINT');
      checkpoints.delete(checkpoint.id);
      return noChange();
    },
    closeHistoryGroup() {
      if (!disposed && !notifying) openGroup = undefined;
    },
    dispose() {
      disposed = true;
      listeners.clear();
      checkpoints.clear();
      undo = [];
      redo = [];
    },
  };
  return engine;
}
