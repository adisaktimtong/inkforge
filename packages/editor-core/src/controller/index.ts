import type { Mark } from '../index.js';
import type {
  ControllerCheckpoint,
  ControllerDiagnostic,
  ControllerLimits,
  ControllerResult,
  ControllerSnapshot,
  ControllerToken,
  CreateEngineOptions,
  DispatchContext,
  EngineBookmark,
  EngineController,
  HostFence,
  ModelSelection,
} from './types.js';
import {
  asDocument,
  byteSize,
  canonical,
  checkSelection,
  cloneTree,
  Draft,
  fail,
  freeze,
  makeTree,
  Rejection,
  same,
  snapshotIndex,
  validateModel,
  type Primitive,
} from './model.js';
import { compile } from './commands.js';
export type * from './types.js';
export { mapPosition } from './model.js';
export const defaultControllerLimits: ControllerLimits = freeze({
  maxDocumentBytes: 1048576,
  maxNodes: 10000,
  maxDepth: 32,
  maxTextUtf16: 500000,
  maxOperations: 256,
  maxNormalizationPasses: 8,
  maxHistoryEntries: 100,
  maxHistoryBytes: 4194304,
  maxCheckpoints: 32,
  maxCheckpointBytes: 4194304,
  maxBookmarks: 128,
});
const capabilities = freeze([
  'nodeIdentity',
  'exactBookmarks',
  'operationMaps',
  'semanticHistory',
  'checkpoints',
  'synchronousReadBarrier',
  'insertText',
  'insertPlainText',
  'deleteRange',
  'deleteBackward',
  'deleteForward',
  'setMark',
  'clearMark',
  'setStoredMarks',
  'setBlockType',
  'insertHardBreak',
  'splitBlock',
  'joinBlocks',
  'compositionProtocol',
]);
interface HistoryEntry {
  forward: readonly Primitive[];
  inverse: readonly Primitive[];
  before: ModelSelection | null;
  after: ModelSelection | null;
  beforeMarks: readonly Mark[] | null;
  afterMarks: readonly Mark[] | null;
  group: string | null;
  at: number;
}
interface CapturedFence {
  reference: string;
  check: (reference: string) => unknown;
}
interface Witness {
  sequence: number;
  fingerprint: string;
  bytes: number;
  fences: readonly CapturedFence[];
}
const rejected = (code: string): Extract<ControllerResult, { status: 'rejected' }> =>
  freeze({ status: 'rejected', diagnostics: [{ code }] });
function capturedFence(raw?: HostFence): CapturedFence | null {
  if (raw === undefined) return null;
  if (
    !raw ||
    typeof raw.reference !== 'string' ||
    !raw.reference.length ||
    raw.reference.length > 1024 ||
    typeof raw.isCurrent !== 'function'
  )
    fail('INVALID_HOST_FENCE');
  const reference = raw.reference,
    check = raw.isCurrent;
  return { reference, check: (value) => check.call(raw, value) };
}
function checkFence(f: CapturedFence) {
  let value: unknown;
  try {
    value = f.check(f.reference);
  } catch {
    fail('STALE_HOST_FENCE');
  }
  if (value !== true) {
    if (value && typeof (value as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(value).catch(() => {});
    fail('STALE_HOST_FENCE');
  }
}
function validDiagnostics(raw: unknown) {
  if (
    !Array.isArray(raw) ||
    raw.length > 128 ||
    raw.some(
      (d) =>
        !d ||
        typeof d !== 'object' ||
        typeof d.code !== 'string' ||
        !d.code.length ||
        d.code.length > 128,
    )
  ) {
    if (raw && typeof (raw as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(raw).catch(() => {});
    fail('INVALID_VALIDATOR_RESULT');
  }
  if (raw.length) fail((raw[0] as ControllerDiagnostic).code);
}
/** Pure headless opt-in controller; legacy createEditorEngine remains separate. */
export function createEngine(options: CreateEngineOptions): EngineController {
  if (
    !options ||
    typeof options !== 'object' ||
    Object.keys(options).some(
      (k) =>
        ![
          'document',
          'origin',
          'instanceId',
          'clock',
          'limits',
          'typingGapMs',
          'segmentation',
          'validate',
        ].includes(k),
    )
  )
    fail('INVALID_ENGINE_OPTIONS');
  const { instanceId, origin, clock, validate } = options;
  if (
    typeof instanceId !== 'string' ||
    !instanceId.length ||
    instanceId.length > 128 ||
    !['persisted', 'unsaved'].includes(origin) ||
    typeof clock !== 'function' ||
    (validate !== undefined && typeof validate !== 'function')
  )
    fail('INVALID_ENGINE_OPTIONS');
  const rawLimits = options.limits;
  if (
    rawLimits !== undefined &&
    (!rawLimits ||
      typeof rawLimits !== 'object' ||
      Array.isArray(rawLimits) ||
      Object.keys(rawLimits).some((k) => !Object.hasOwn(defaultControllerLimits, k)))
  )
    fail('INVALID_LIMITS');
  const limits = freeze({ ...defaultControllerLimits, ...rawLimits });
  if (
    Object.values(limits).some((v) => !Number.isSafeInteger(v) || v < 1 || v > 134217728) ||
    limits.maxDepth > 64 ||
    limits.maxOperations > 10000 ||
    limits.maxNormalizationPasses > 32 ||
    limits.maxHistoryEntries > 10000 ||
    limits.maxCheckpoints > 1024 ||
    limits.maxBookmarks > 1024
  )
    fail('INVALID_LIMITS');
  const typingGap = options.typingGapMs ?? 1000;
  if (!Number.isFinite(typingGap) || typingGap < 0 || typingGap > 60000) fail('INVALID_TYPING_GAP');
  let segmentation = options.segmentation;
  if (segmentation) {
    if (
      typeof segmentation.locale !== 'string' ||
      !segmentation.locale.length ||
      typeof segmentation.fingerprint !== 'string' ||
      !segmentation.fingerprint.length ||
      typeof segmentation.boundaries !== 'function'
    )
      fail('INVALID_SEGMENTATION_PORT');
    const port = segmentation,
      callback = port.boundaries;
    segmentation = freeze({
      locale: port.locale,
      fingerprint: port.fingerprint,
      boundaries: (text: string, unit: 'grapheme' | 'word') => callback.call(port, text, unit),
    });
  }
  let nextNode = 0,
    session = 1,
    revision = 0,
    stateVersion = 0,
    selectionEpoch = 0,
    nextCheckpoint = 0,
    lastAcknowledged = 0;
  const allocate = () => `${instanceId}:node:${++nextNode}`,
    sessionId = () => `${instanceId}:session:${session}`;
  let tree = makeTree(validateModel(options.document, limits), allocate);
  const initial = new Draft(tree, allocate, limits, null);
  initial.normalize();
  freeze(tree.root);
  if (validate) validDiagnostics(validate(asDocument(tree)));
  let selection: ModelSelection | null = {
    anchor: { nodeId: tree.ids.get(tree.root)!, offset: 0, affinity: 'forward' },
    head: { nodeId: tree.ids.get(tree.root)!, offset: 0, affinity: 'forward' },
  };
  let storedMarks: readonly Mark[] | null = null,
    readOnly = false,
    disposed = false,
    locked = false;
  let inReadBarrier = false,
    terminalAfterBarrier = false;
  let baseline: string | null = origin === 'persisted' ? canonical(tree.root) : null;
  let history: readonly HistoryEntry[] = [],
    redo: readonly HistoryEntry[] = [],
    grouping = false,
    lastClock = -Infinity;
  let composition: {
    id: string;
    range: ModelSelection;
    fences: readonly CapturedFence[];
    token: ControllerToken;
  } | null = null;
  const tokens = new WeakSet<object>(),
    issuedBookmarks = new WeakSet<object>(),
    issuedCheckpoints = new WeakSet<object>();
  const bookmarks = new Map<EngineBookmark, readonly CapturedFence[]>(),
    checkpoints = new Map<ControllerCheckpoint, Witness>();
  const listeners = new Set<() => void>();
  let snapshot: ControllerSnapshot;
  function buildSnapshot(): ControllerSnapshot {
    const token = freeze({
      engineInstanceId: instanceId,
      sessionId: sessionId(),
      revision,
      selectionEpoch,
    }) as ControllerToken;
    tokens.add(token);
    return freeze({
      engineInstanceId: instanceId,
      sessionId: sessionId(),
      revision,
      stateVersion,
      selectionEpoch,
      token,
      document: asDocument(tree),
      nodeIndex: snapshotIndex(tree),
      rootId: tree.ids.get(tree.root)!,
      selection,
      storedMarks,
      composing: composition !== null,
      readOnly,
      disposed,
      canUndo: !disposed && history.length > 0,
      canRedo: !disposed && redo.length > 0,
      dirty:
        !disposed &&
        (composition !== null || baseline === null || baseline !== canonical(tree.root)),
      capabilities,
    });
  }
  snapshot = buildSnapshot();
  function notify() {
    stateVersion++;
    snapshot = buildSnapshot();
    for (const listener of [...listeners])
      if (listeners.has(listener)) {
        try {
          const result: unknown = listener();
          if (result && typeof (result as PromiseLike<unknown>).then === 'function')
            void Promise.resolve(result).catch(() => {});
        } catch {
          /* Observer failure cannot roll back or disguise an accepted edit. */
        }
      }
  }
  function tokenGuard(expected: ControllerToken) {
    if (!expected || typeof expected !== 'object' || !tokens.has(expected))
      fail('INVALID_CONTROLLER_TOKEN');
    if (
      expected.sessionId !== sessionId() ||
      expected.revision !== revision ||
      expected.selectionEpoch !== selectionEpoch
    )
      fail('STALE_CONTROLLER_TOKEN');
  }
  function bookmarkGuard(bookmark: EngineBookmark): readonly CapturedFence[] {
    if (!bookmark || typeof bookmark !== 'object' || !issuedBookmarks.has(bookmark))
      fail('INVALID_BOOKMARK');
    const fences = bookmarks.get(bookmark);
    if (!fences) fail('STALE_BOOKMARK');
    tokenGuard(bookmark.token);
    fences.forEach(checkFence);
    return fences;
  }
  function enter<T>(
    context: DispatchContext,
    action: (fences: readonly CapturedFence[]) => T,
  ): T | Extract<ControllerResult, { status: 'rejected' }> {
    if (disposed) return rejected('DISPOSED');
    if (locked) return rejected('REENTRANT_OPERATION');
    locked = true;
    try {
      tokenGuard(context?.expected);
      const fences: CapturedFence[] = context.bookmark ? [...bookmarkGuard(context.bookmark)] : [];
      const original = capturedFence(context.fence);
      if (original) fences.push(original);
      fences.forEach(checkFence);
      return action(fences);
    } catch (error) {
      return rejected(error instanceof Rejection ? error.code : 'INVALID_COMMAND');
    } finally {
      locked = false;
    }
  }
  const noChange = (): ControllerResult => ({ status: 'noChange', snapshot });
  function finalFence(fences: readonly CapturedFence[]) {
    fences.forEach(checkFence);
  }
  function validateDraft(draft: Draft) {
    validateModel(draft.tree.root, limits);
    checkSelection(draft.tree, draft.selection);
    freeze(draft.tree.root);
    if (validate) validDiagnostics(validate(asDocument(draft.tree)));
  }
  function clockValue() {
    const now = clock();
    if (!Number.isFinite(now) || now < lastClock) fail('INVALID_MONOTONIC_CLOCK');
    return now;
  }
  function commitDraft(
    draft: Draft,
    marks: readonly Mark[] | null,
    group: string | null,
    fences: readonly CapturedFence[],
    replay?: 'undo' | 'redo',
  ): ControllerResult {
    const contentChanged = !same(tree.root, draft.tree.root),
      transientChanged = !same(selection, draft.selection) || !same(storedMarks, marks);
    if (!contentChanged && !transientChanged && !composition) {
      finalFence(fences);
      if (group === null) grouping = false;
      return noChange();
    }
    if (!contentChanged) {
      draft.selection = checkSelection(tree, draft.selection);
      draft.tree.root = tree.root;
      draft.tree.ids = tree.ids;
      draft.tree.nodes = tree.nodes;
    }
    validateDraft(draft);
    let nextHistory = history,
      nextRedo = redo;
    const now = contentChanged ? clockValue() : lastClock;
    if (contentChanged && !replay) {
      const entry: HistoryEntry = {
        forward: draft.forward,
        inverse: draft.inverse,
        before: selection,
        after: draft.selection,
        beforeMarks: storedMarks,
        afterMarks: marks,
        group,
        at: now,
      };
      const previous = history.at(-1),
        merge =
          grouping &&
          group !== null &&
          previous &&
          previous.forward.length + entry.forward.length <= limits.maxOperations &&
          previous.inverse.length + entry.inverse.length <= limits.maxOperations &&
          previous.group === group &&
          now - previous.at <= typingGap &&
          same(previous.after, selection) &&
          same(previous.afterMarks, storedMarks);
      const nextEntry = merge
        ? {
            ...entry,
            forward: [...previous.forward, ...entry.forward],
            inverse: [...entry.inverse, ...previous.inverse],
            before: previous.before,
            beforeMarks: previous.beforeMarks,
          }
        : entry;
      if (byteSize(nextEntry) > limits.maxHistoryBytes) fail('HISTORY_BYTES');
      const list = [...(merge ? history.slice(0, -1) : history), freeze(nextEntry)];
      while (list.length > limits.maxHistoryEntries || byteSize(list) > limits.maxHistoryBytes)
        list.shift();
      nextHistory = list;
      nextRedo = [];
    } else if (replay) {
      const entry = (replay === 'undo' ? history : redo).at(-1)!;
      if (replay === 'undo') {
        nextHistory = history.slice(0, -1);
        nextRedo = [...redo, entry];
      } else {
        nextHistory = [...history, entry];
        nextRedo = redo.slice(0, -1);
      }
    }
    finalFence(fences);
    const fromRevision = revision;
    tree = draft.tree;
    selection = draft.selection;
    storedMarks = marks;
    history = nextHistory;
    redo = nextRedo;
    composition = null;
    if (contentChanged) {
      revision++;
      lastClock = now;
      bookmarks.clear();
    }
    grouping = contentChanged && !replay && group !== null;
    notify();
    return {
      status: 'committed',
      snapshot,
      ...(contentChanged
        ? {
            mapping: freeze({
              sessionId: sessionId(),
              fromRevision,
              toRevision: revision,
              steps: draft.steps,
            }),
          }
        : {}),
    };
  }
  const controller: EngineController = {
    getSnapshot: () => snapshot,
    withReadBarrier(context, read) {
      let owns = false;
      try {
        return enter(context, (fences) => {
          if (composition) fail('COMPOSITION_ACTIVE');
          if (typeof read !== 'function') fail('INVALID_READ_BARRIER');
          inReadBarrier = true;
          owns = true;
          const value = read(snapshot);
          if (value && typeof (value as unknown as PromiseLike<unknown>).then === 'function') {
            void Promise.resolve(value).catch(() => {});
            fail('ASYNC_READ_BARRIER');
          }
          if (terminalAfterBarrier) fail('DISPOSED');
          finalFence(fences);
          if (terminalAfterBarrier) fail('DISPOSED');
          return { status: 'captured' as const, value };
        });
      } finally {
        if (owns) {
          inReadBarrier = false;
          if (terminalAfterBarrier) {
            terminalAfterBarrier = false;
            controller.dispose();
          }
        }
      }
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Listener must be a function');
      if (disposed) return () => {};
      listeners.add(listener);
      let active = true;
      return () => {
        if (active) {
          active = false;
          listeners.delete(listener);
        }
      };
    },
    dispatch(command, context) {
      return enter(context, (fences) => {
        if (!command || typeof command !== 'object') fail('INVALID_COMMAND');
        if (command.kind === 'cancelComposition') {
          if (
            !composition ||
            composition.id !== command.compositionId ||
            context.expected !== composition.token
          )
            fail('STALE_COMPOSITION');
          finalFence([...composition.fences, ...fences]);
          composition = null;
          grouping = false;
          notify();
          return { status: 'committed', snapshot };
        }
        if (readOnly) fail('READ_ONLY');
        if (command.kind === 'beginComposition') {
          if (
            composition ||
            !selection ||
            typeof command.compositionId !== 'string' ||
            !command.compositionId.length ||
            command.compositionId.length > 128
          )
            fail('INVALID_COMPOSITION');
          finalFence(fences);
          composition = {
            id: command.compositionId,
            range: selection,
            fences,
            token: context.expected,
          };
          grouping = false;
          bookmarks.clear();
          notify();
          composition.token = snapshot.token;
          return { status: 'committed', snapshot };
        }
        if (composition && command.kind !== 'commitComposition') fail('COMPOSITION_ACTIVE');
        const draft = new Draft(cloneTree(tree), allocate, limits, selection);
        if (command.kind === 'commitComposition') {
          if (
            !composition ||
            composition.id !== command.compositionId ||
            context.expected !== composition.token
          )
            fail('STALE_COMPOSITION');
          const original = composition;
          const compiled = compile(
            { kind: 'insertText', range: original.range, text: command.text },
            draft,
            storedMarks,
            segmentation,
          );
          draft.normalize();
          return commitDraft(draft, compiled.storedMarks, null, [...original.fences, ...fences]);
        }
        if (command.kind === 'undo' || command.kind === 'redo') {
          const entry = (command.kind === 'undo' ? history : redo).at(-1);
          if (!entry) return noChange();
          for (const op of command.kind === 'undo' ? entry.inverse : entry.forward) draft.apply(op);
          draft.selection = command.kind === 'undo' ? entry.before : entry.after;
          return commitDraft(
            draft,
            command.kind === 'undo' ? entry.beforeMarks : entry.afterMarks,
            null,
            fences,
            command.kind,
          );
        }
        const compiled = compile(command, draft, storedMarks, segmentation);
        draft.normalize();
        return commitDraft(draft, compiled.storedMarks, compiled.group, fences);
      });
    },
    setSelection(next, context) {
      return enter(context, (fences) => {
        if (composition) fail('COMPOSITION_ACTIVE');
        const valid = checkSelection(tree, next);
        finalFence(fences);
        if (same(selection, valid)) return noChange();
        selection = valid;
        selectionEpoch++;
        storedMarks = null;
        grouping = false;
        bookmarks.clear();
        notify();
        return { status: 'committed', snapshot };
      });
    },
    captureBookmark(context) {
      return enter(context, (fences) => {
        if (composition) fail('COMPOSITION_ACTIVE');
        if (readOnly) fail('READ_ONLY');
        if (!selection) fail('NO_SELECTION');
        if (context.bookmark) fail('BOOKMARK_RECAPTURE_UNSUPPORTED');
        if (bookmarks.size >= limits.maxBookmarks) fail('BOOKMARK_LIMIT');
        const bookmark = freeze({ token: snapshot.token, selection }) as EngineBookmark;
        finalFence(fences);
        issuedBookmarks.add(bookmark);
        bookmarks.set(bookmark, fences);
        return { status: 'captured' as const, bookmark };
      });
    },
    restoreBookmark(bookmark, context) {
      return enter(context, (fences) => {
        if (composition) fail('COMPOSITION_ACTIVE');
        if (readOnly) fail('READ_ONLY');
        const original = bookmarkGuard(bookmark);
        finalFence([...original, ...fences]);
        if (same(selection, bookmark.selection)) return noChange();
        selection = checkSelection(tree, bookmark.selection);
        notify();
        return { status: 'committed', snapshot };
      });
    },
    releaseBookmark(bookmark) {
      if (!locked) bookmarks.delete(bookmark);
    },
    loadExternal(document, nextOrigin, context) {
      return enter(context, (fences) => {
        if (composition) fail('COMPOSITION_ACTIVE');
        if (!['persisted', 'unsaved'].includes(nextOrigin)) fail('INVALID_ORIGIN');
        const imported = makeTree(validateModel(document, limits), allocate),
          draft = new Draft(imported, allocate, limits, null);
        draft.normalize();
        validateDraft(draft);
        finalFence(fences);
        tree = imported;
        session++;
        revision = 0;
        selectionEpoch = 0;
        selection = {
          anchor: { nodeId: tree.ids.get(tree.root)!, offset: 0, affinity: 'forward' },
          head: { nodeId: tree.ids.get(tree.root)!, offset: 0, affinity: 'forward' },
        };
        storedMarks = null;
        history = [];
        redo = [];
        grouping = false;
        checkpoints.clear();
        bookmarks.clear();
        lastAcknowledged = 0;
        if (nextOrigin === 'persisted') baseline = canonical(tree.root);
        notify();
        return { status: 'committed', snapshot };
      });
    },
    setReadOnly(value, context) {
      return enter(context, (fences) => {
        if (typeof value !== 'boolean') fail('INVALID_READONLY');
        finalFence(fences);
        if (readOnly === value) return noChange();
        readOnly = value;
        grouping = false;
        bookmarks.clear();
        notify();
        return { status: 'committed', snapshot };
      });
    },
    closeHistoryGroup() {
      if (!locked) grouping = false;
    },
    captureCheckpoint(context) {
      return enter(context, (fences) => {
        if (composition) fail('COMPOSITION_ACTIVE');
        if (checkpoints.size >= limits.maxCheckpoints) fail('CHECKPOINT_LIMIT');
        const fingerprint = canonical(tree.root),
          bytes = byteSize(tree.root);
        if (
          [...checkpoints.values()].reduce((n, c) => n + c.bytes, bytes) > limits.maxCheckpointBytes
        )
          fail('CHECKPOINT_BYTES');
        const sequence = nextCheckpoint + 1,
          checkpoint = freeze({
            id: `${instanceId}:checkpoint:${sequence}`,
            token: snapshot.token,
            document: asDocument(tree),
          }) as ControllerCheckpoint;
        finalFence(fences);
        nextCheckpoint = sequence;
        issuedCheckpoints.add(checkpoint);
        checkpoints.set(checkpoint, { sequence, fingerprint, bytes, fences });
        grouping = false;
        return { status: 'captured' as const, checkpoint };
      });
    },
    acknowledgeCheckpoint(checkpoint, context) {
      return enter(context, (fences) => {
        if (!checkpoint || !issuedCheckpoints.has(checkpoint)) fail('INVALID_CHECKPOINT');
        const receipt = checkpoints.get(checkpoint);
        if (
          !receipt ||
          checkpoint.token.sessionId !== sessionId() ||
          receipt.sequence <= lastAcknowledged
        )
          fail('STALE_CHECKPOINT');
        finalFence([...receipt.fences, ...fences]);
        baseline = receipt.fingerprint;
        lastAcknowledged = receipt.sequence;
        checkpoints.delete(checkpoint);
        grouping = false;
        notify();
        return { status: 'committed', snapshot };
      });
    },
    releaseCheckpoint(checkpoint) {
      if (!locked) checkpoints.delete(checkpoint);
    },
    dispose() {
      if (locked) {
        if (inReadBarrier) terminalAfterBarrier = true;
        return rejected('REENTRANT_OPERATION');
      }
      if (disposed) return noChange();
      locked = true;
      try {
        disposed = true;
        tree = makeTree({ type: 'document', children: [] }, allocate);
        baseline = null;
        selection = null;
        storedMarks = null;
        history = [];
        redo = [];
        composition = null;
        bookmarks.clear();
        checkpoints.clear();
        readOnly = true;
        grouping = false;
        notify();
        listeners.clear();
        return { status: 'committed', snapshot };
      } finally {
        locked = false;
      }
    },
  };
  return freeze(controller);
}
