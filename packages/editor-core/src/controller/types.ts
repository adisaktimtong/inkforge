import type { DeepReadonly, DocumentNode, Mark } from '../index.js';

export type NodeId = string;
export interface ModelPosition {
  readonly nodeId: NodeId;
  readonly offset: number;
  readonly affinity: 'forward' | 'backward';
}
export interface ModelSelection {
  readonly anchor: ModelPosition;
  readonly head: ModelPosition;
}
declare const tokenBrand: unique symbol;
export interface ControllerToken {
  readonly [tokenBrand]: true;
  readonly engineInstanceId: string;
  readonly sessionId: string;
  readonly revision: number;
  readonly selectionEpoch: number;
}
export interface HostFence {
  readonly reference: string;
  /** Synchronous original-ticket check. Metadata and UI state are not authorization. */
  isCurrent(reference: string): boolean;
}
declare const bookmarkBrand: unique symbol;
export interface EngineBookmark {
  readonly [bookmarkBrand]: true;
  readonly token: ControllerToken;
  readonly selection: ModelSelection;
}
declare const checkpointBrand: unique symbol;
export interface ControllerCheckpoint {
  readonly [checkpointBrand]: true;
  readonly id: string;
  readonly token: ControllerToken;
  readonly document: DeepReadonly<DocumentNode>;
}
export interface ControllerDiagnostic {
  readonly code: string;
}
export interface NodeView {
  readonly id: NodeId;
  readonly parentId: NodeId | null;
  readonly childIds: readonly NodeId[];
  readonly node: DeepReadonly<
    | DocumentNode
    | import('../index.js').BlockNode
    | import('../index.js').ListItemNode
    | import('../index.js').InlineNode
  >;
}
export interface ControllerSnapshot {
  readonly engineInstanceId: string;
  readonly sessionId: string;
  readonly revision: number;
  /** Identity of the latest content edit history unit; transient, not an open-group flag. */
  readonly historyGroupId: string | null;
  readonly stateVersion: number;
  readonly selectionEpoch: number;
  readonly token: ControllerToken;
  readonly document: DeepReadonly<DocumentNode>;
  readonly nodeIndex: Readonly<Record<NodeId, NodeView>>;
  readonly rootId: NodeId;
  readonly selection: ModelSelection | null;
  readonly storedMarks: readonly Mark[] | null;
  readonly composing: boolean;
  readonly readOnly: boolean;
  readonly disposed: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly dirty: boolean;
  readonly capabilities: readonly string[];
}
export type PositionMapStep =
  | Readonly<{ kind: 'insertText'; nodeId: NodeId; offset: number; length: number }>
  | Readonly<{ kind: 'deleteText'; nodeId: NodeId; from: number; to: number }>
  | Readonly<{
      kind: 'splitText';
      leftId: NodeId;
      rightId: NodeId;
      offset: number;
      parentId: NodeId;
      index: number;
    }>
  | Readonly<{
      kind: 'joinText';
      leftId: NodeId;
      rightId: NodeId;
      leftLength: number;
      parentId: NodeId;
      index: number;
    }>
  | Readonly<{
      kind: 'moveChildren';
      from: NodeId;
      to: NodeId;
      start: number;
      count: number;
      index: number;
    }>
  | Readonly<{ kind: 'insertChild'; parentId: NodeId; index: number }>
  | Readonly<{
      kind: 'removeChild';
      parentId: NodeId;
      index: number;
      removedIds: readonly NodeId[];
      fallback: ModelPosition;
    }>;
export interface ControllerMapping {
  readonly sessionId: string;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly steps: readonly PositionMapStep[];
}
export type ControllerResult =
  | Readonly<{
      status: 'committed' | 'noChange';
      snapshot: ControllerSnapshot;
      mapping?: ControllerMapping;
    }>
  | Readonly<{ status: 'rejected'; diagnostics: readonly ControllerDiagnostic[] }>;
export interface DispatchContext {
  readonly expected: ControllerToken;
  readonly fence?: HostFence;
  readonly bookmark?: EngineBookmark;
}
export type ControllerCommand =
  | Readonly<{
      kind: 'insertText';
      range: ModelSelection;
      text: string;
      marks?: readonly Mark[];
      typing?: boolean;
    }>
  | Readonly<{ kind: 'insertPlainText'; range: ModelSelection; text: string }>
  | Readonly<{ kind: 'deleteRange'; range: ModelSelection }>
  | Readonly<{
      kind: 'deleteBackward' | 'deleteForward';
      range: ModelSelection;
      unit: 'grapheme' | 'word';
    }>
  | Readonly<{ kind: 'setMark' | 'clearMark'; range: ModelSelection; mark: Mark }>
  | Readonly<{ kind: 'setStoredMarks'; marks: readonly Mark[] | null }>
  | Readonly<{
      kind: 'setBlockType';
      blocks: readonly NodeId[];
      type: 'paragraph' | 'heading';
      level?: 1 | 2 | 3 | 4 | 5 | 6;
    }>
  | Readonly<{ kind: 'insertHardBreak'; range: ModelSelection }>
  | Readonly<{ kind: 'splitBlock'; at: ModelPosition; range?: never }>
  | Readonly<{ kind: 'splitBlock'; range: ModelSelection; at?: never }>
  | Readonly<{ kind: 'joinBlocks'; leftBlockId: NodeId; rightBlockId: NodeId }>
  | Readonly<{ kind: 'undo' | 'redo' }>
  | Readonly<{ kind: 'beginComposition'; compositionId: string }>
  | Readonly<{ kind: 'commitComposition'; compositionId: string; text: string }>
  | Readonly<{ kind: 'cancelComposition'; compositionId: string }>;
export interface SegmentationPort {
  readonly locale: string;
  readonly fingerprint: string;
  boundaries(text: string, unit: 'grapheme' | 'word'): readonly number[];
}
export interface ControllerLimits {
  readonly maxDocumentBytes: number;
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly maxTextUtf16: number;
  readonly maxOperations: number;
  readonly maxNormalizationPasses: number;
  readonly maxHistoryEntries: number;
  readonly maxHistoryBytes: number;
  readonly maxCheckpoints: number;
  readonly maxCheckpointBytes: number;
  readonly maxBookmarks: number;
}
export interface CreateEngineOptions {
  readonly document: DocumentNode | DeepReadonly<DocumentNode>;
  readonly origin: 'persisted' | 'unsaved';
  /** Instance identity supplied by the host; tokens/bookmarks also have private per-controller issuance. */
  readonly instanceId: string;
  readonly clock: () => number;
  readonly limits?: Partial<ControllerLimits>;
  readonly typingGapMs?: number;
  readonly segmentation?: SegmentationPort;
  readonly validate?: (document: DeepReadonly<DocumentNode>) => readonly ControllerDiagnostic[];
}
export interface EngineController {
  getSnapshot(): ControllerSnapshot;
  /** Nonmutating live-token/lock check; composition is allowed for explicit terminal cleanup. */
  checkTermination(context: DispatchContext): ControllerResult;
  subscribe(listener: () => void): () => void;
  /** Synchronous capture scope. It never spans a task/await and rejects reentrant mutation. */
  withReadBarrier<T>(
    context: DispatchContext,
    read: (snapshot: ControllerSnapshot) => T & (T extends PromiseLike<unknown> ? never : unknown),
  ): Readonly<{ status: 'captured'; value: T }> | Extract<ControllerResult, { status: 'rejected' }>;
  dispatch(command: ControllerCommand, context: DispatchContext): ControllerResult;
  setSelection(selection: ModelSelection | null, context: DispatchContext): ControllerResult;
  captureBookmark(
    context: DispatchContext,
  ):
    | Readonly<{ status: 'captured'; bookmark: EngineBookmark }>
    | Extract<ControllerResult, { status: 'rejected' }>;
  restoreBookmark(bookmark: EngineBookmark, context: DispatchContext): ControllerResult;
  releaseBookmark(bookmark: EngineBookmark): void;
  loadExternal(
    document: DocumentNode | DeepReadonly<DocumentNode>,
    origin: 'persisted' | 'unsaved',
    context: DispatchContext,
  ): ControllerResult;
  setReadOnly(value: boolean, context: DispatchContext): ControllerResult;
  closeHistoryGroup(): void;
  captureCheckpoint(
    context: DispatchContext,
  ):
    | Readonly<{ status: 'captured'; checkpoint: ControllerCheckpoint }>
    | Extract<ControllerResult, { status: 'rejected' }>;
  acknowledgeCheckpoint(
    checkpoint: ControllerCheckpoint,
    context: DispatchContext,
  ): ControllerResult;
  releaseCheckpoint(checkpoint: ControllerCheckpoint): void;
  dispose(): ControllerResult;
}
