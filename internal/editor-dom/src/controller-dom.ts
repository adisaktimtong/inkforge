import type {
  ControllerCommand,
  ControllerSnapshot,
  ControllerToken,
  DispatchContext,
  EngineBookmark,
  EngineController,
  HostFence,
  Mark,
  ModelPosition,
  ModelSelection,
} from '@inkforge/editor-core';

export interface EngineDomDiagnostic {
  readonly code: string;
}
export interface EngineSurfaceStatus {
  readonly phase: 'ready' | 'composing' | 'invalidDraft' | 'readOnly' | 'disposed';
  readonly pending: boolean;
  readonly diagnostic: string | null;
}
export interface EngineSurfaceHandle {
  getStatus(): EngineSurfaceStatus;
  /** Explicit host discard; never forces an active native composition to finish. */
  discardDraft(): boolean;
}
export interface EngineDomOptions {
  readonly disabled: boolean;
  readonly interactionContextKey: string;
  readonly maxNativeTextUtf16: number;
  readonly captureHostFence?: (() => HostFence) | undefined;
  readonly onDiagnostic?: ((diagnostic: EngineDomDiagnostic) => void) | undefined;
  readonly onStatus?: ((status: EngineSurfaceStatus) => void) | undefined;
}
interface Pending {
  id: string;
  token: ControllerToken;
  context: string;
  fence?: HostFence;
  range: ModelSelection;
  blockId: string;
  before: string;
  text: string;
  active: boolean;
  ended: boolean;
  invalid: boolean;
}
interface NativeEdit {
  token: ControllerToken;
  context: string;
  fence?: HostFence;
  range: ModelSelection;
  blockId: string;
  before: string;
}
interface RecordNode {
  dom: HTMLElement;
  text?: Text;
  marks?: string;
}
const owners = new WeakMap<EngineController, HTMLElement>();
const retained = new WeakMap<EngineController, { pending: Pending; stop: () => void }>();
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const marks = ['bold', 'italic', 'underline', 'strike', 'code'] as const;
const markTags: Record<Mark, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};
const textBlock = (s: ControllerSnapshot, id: string) =>
  ['paragraph', 'heading'].includes(s.nodeIndex[id]?.node.type ?? '');
function blockOf(s: ControllerSnapshot, position: ModelPosition): string | null {
  let id: string | null = position.nodeId;
  while (id) {
    if (textBlock(s, id)) return id;
    id = s.nodeIndex[id]?.parentId ?? null;
  }
  const root = s.nodeIndex[s.rootId];
  return root?.childIds.find((child) => textBlock(s, child)) ?? null;
}
function bounds(s: ControllerSnapshot) {
  const result = new Map<string, { start: number; edges: number[] }>();
  let offset = 0;
  function visit(id: string) {
    const v = s.nodeIndex[id]!,
      edges = [offset],
      start = offset;
    if (v.node.type === 'text') offset += v.node.text.length;
    else if (v.node.type === 'hard-break') offset++;
    else
      for (const child of v.childIds) {
        visit(child);
        edges.push(offset);
      }
    result.set(id, { start, edges });
    if (textBlock(s, id)) offset++;
  }
  if (s.nodeIndex[s.rootId]) visit(s.rootId);
  return result;
}
function modelOffset(s: ControllerSnapshot, p: ModelPosition): number {
  const b = bounds(s).get(p.nodeId);
  if (!b) return -1;
  return s.nodeIndex[p.nodeId]!.node.type === 'text'
    ? b.start + p.offset
    : (b.edges[p.offset] ?? -1);
}
function sameSelection(s: ControllerSnapshot, a: ModelSelection | null, b: ModelSelection | null) {
  return a === null || b === null
    ? a === b
    : modelOffset(s, a.anchor) === modelOffset(s, b.anchor) &&
        modelOffset(s, a.head) === modelOffset(s, b.head);
}
function modelText(s: ControllerSnapshot, id: string): string {
  const v = s.nodeIndex[id]!;
  return v.node.type === 'text'
    ? v.node.text
    : v.node.type === 'hard-break'
      ? '\n'
      : v.childIds.map((child) => modelText(s, child)).join('');
}
function pointAt(
  s: ControllerSnapshot,
  id: string,
  offset: number,
  affinity: ModelPosition['affinity'],
): ModelPosition {
  let rest = offset;
  function find(current: string): ModelPosition | null {
    const v = s.nodeIndex[current]!;
    if (v.node.type === 'text') {
      if (rest <= v.node.text.length) return { nodeId: current, offset: rest, affinity };
      rest -= v.node.text.length;
    } else if (v.node.type === 'hard-break') {
      const parent = s.nodeIndex[v.parentId!]!,
        index = parent.childIds.indexOf(current);
      if (rest <= 1) return { nodeId: parent.id, offset: index + rest, affinity };
      rest--;
    } else
      for (const child of v.childIds) {
        const found = find(child);
        if (found) return found;
      }
    return null;
  }
  return find(id) ?? { nodeId: id, offset: s.nodeIndex[id]!.childIds.length, affinity };
}
function domText(node: Node): string {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeName === 'BR')
    return (node as Element).hasAttribute('data-inkforge-placeholder') ? '' : '\n';
  return Array.from(node.childNodes).map(domText).join('');
}
export interface EngineDomBinding extends EngineSurfaceHandle {
  update(options: EngineDomOptions): void;
  detach(): void;
  captureBookmark(): EngineBookmark | null;
  applyBookmark(bookmark: EngineBookmark, command: ControllerCommand): boolean;
  selectionMarks(): readonly Mark[];
}
/** The single editable-subtree writer. Imported relatively and bundled by editor-react. */
export function mountEngineDom(
  root: HTMLDivElement,
  controller: EngineController,
  initialOptions: EngineDomOptions,
): EngineDomBinding {
  const previousOwner = owners.get(controller);
  if (previousOwner && previousOwner !== root) throw new Error('CONTROLLER_ALREADY_HAS_A_SURFACE');
  owners.set(controller, root);
  const doc = root.ownerDocument,
    view = doc.defaultView!;
  let options = initialOptions,
    active = true,
    serial = 0,
    rendering = false,
    ownDispatch = false,
    nativeEdit: NativeEdit | null = null;
  let pending: Pending | null = null,
    quarantined = false,
    policyBlocked = false,
    lastDiagnostic: string | null = null;
  let lastSnapshot = controller.getSnapshot();
  let status: EngineSurfaceStatus = Object.freeze({
    phase: 'ready',
    pending: false,
    diagnostic: null,
  });
  const records = new Map<string, RecordNode>();
  const observer = new view.MutationObserver((mutations) => {
    if (
      mutations.every(
        (m) =>
          m.target === root &&
          m.type === 'attributes' &&
          ['class', 'style'].includes(m.attributeName ?? ''),
      )
    )
      return;
    if (!active) return;
    if (controller.getSnapshot().disposed) {
      if (root.childNodes.length) withWrites(() => root.replaceChildren());
      return;
    }
    if (rendering || pending?.active || nativeEdit) return;
    quarantine('UNRECOGNIZED_DOM_MUTATION');
  });
  const observe = () => {
    if (active)
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'href', 'src', 'onerror'],
      });
  };
  function diagnostic(code: string) {
    lastDiagnostic = code;
    options.onDiagnostic?.(Object.freeze({ code }));
  }
  function publishStatus() {
    const s = controller.getSnapshot(),
      next: EngineSurfaceStatus = Object.freeze({
        phase: s.disposed
          ? 'disposed'
          : quarantined
            ? 'invalidDraft'
            : s.composing
              ? 'composing'
              : policyBlocked || options.disabled || s.readOnly
                ? 'readOnly'
                : 'ready',
        pending: quarantined || s.composing,
        diagnostic: lastDiagnostic,
      });
    if (!eq(status, next)) {
      status = next;
      options.onStatus?.(status);
    }
    root.dataset.inkforgePhase = next.phase;
    // An already active native composition is never made readonly by presentation/host rerenders.
    const editable =
      !s.disposed &&
      !quarantined &&
      !policyBlocked &&
      !options.disabled &&
      !s.readOnly &&
      !s.composing;
    if (!pending?.active) {
      const value = editable ? 'true' : 'false';
      if (root.contentEditable !== value) root.contentEditable = value;
      if (editable) {
        root.removeAttribute('aria-readonly');
        root.removeAttribute('aria-disabled');
      } else {
        root.setAttribute('aria-readonly', 'true');
        if (options.disabled || s.disposed) root.setAttribute('aria-disabled', 'true');
      }
    }
  }
  function withWrites(work: () => void) {
    observer.disconnect();
    rendering = true;
    try {
      work();
    } finally {
      rendering = false;
      observe();
    }
  }
  function patchChildren(parent: HTMLElement, desired: readonly HTMLElement[]) {
    desired.forEach((node, index) => {
      if (parent.childNodes[index] !== node)
        parent.insertBefore(node, parent.childNodes[index] ?? null);
    });
    const keep = new Set<Node>(desired);
    for (const child of Array.from(parent.childNodes)) if (!keep.has(child)) child.remove();
  }
  function ownedTextTree(el: HTMLElement, text: Text, modelMarks: readonly Mark[]): boolean {
    let current: Node = el;
    for (const mark of modelMarks) {
      if (
        current.childNodes.length !== 1 ||
        current.firstChild?.nodeType !== 1 ||
        (current.firstChild as Element).localName !== markTags[mark]
      )
        return false;
      current = current.firstChild;
    }
    return current.childNodes.length === 1 && current.firstChild === text;
  }
  function render(s: ControllerSnapshot, restore = false) {
    if (pending?.active || quarantined) {
      publishStatus();
      return;
    }
    withWrites(() => {
      const live = new Set<string>();
      policyBlocked = false;
      function node(id: string): HTMLElement {
        const v = s.nodeIndex[id]!,
          model = v.node;
        live.add(id);
        const tag =
          model.type === 'paragraph'
            ? 'p'
            : model.type === 'heading'
              ? 'h' + model.level
              : model.type === 'list'
                ? model.ordered
                  ? 'ol'
                  : 'ul'
                : model.type === 'list-item'
                  ? 'li'
                  : model.type === 'hard-break'
                    ? 'br'
                    : model.type === 'link'
                      ? 'a'
                      : 'span';
        let record = records.get(id);
        if (!record || record.dom.localName !== tag) {
          const replacement = doc.createElement(tag);
          if (record) record.dom.replaceWith(replacement);
          record = { dom: replacement };
          records.set(id, record);
        }
        const el = record.dom;
        el.dataset.inkforgeNode = id;
        el.dataset.inkforgeType = model.type;
        if (
          ('className' in model && model.className) ||
          ('style' in model && model.style) ||
          model.type === 'link'
        )
          policyBlocked = true;
        if (model.type === 'text') {
          const key = JSON.stringify(model.marks ?? []);
          if (!record.text) record.text = doc.createTextNode(model.text);
          if (record.text.data !== model.text) record.text.data = model.text;
          if (record.marks !== key || !ownedTextTree(el, record.text, model.marks ?? [])) {
            let inner: Node = record.text;
            for (const mark of [...(model.marks ?? [])].reverse()) {
              const wrapper = doc.createElement(markTags[mark]);
              wrapper.appendChild(inner);
              inner = wrapper;
            }
            el.replaceChildren(inner);
            record.marks = key;
          }
        } else if (model.type !== 'hard-break') {
          const childNodes = v.childIds.map(node);
          patchChildren(el, childNodes);
          if (!childNodes.length && textBlock(s, id)) {
            const br = doc.createElement('br');
            br.dataset.inkforgePlaceholder = '';
            el.appendChild(br);
          }
        }
        return el;
      }
      if (s.disposed || !s.nodeIndex[s.rootId]) root.replaceChildren();
      else {
        const list = s.nodeIndex[s.rootId]!.childIds.map(node);
        patchChildren(root, list);
        root.dataset.inkforgeRoot = s.rootId;
        if (!list.length) {
          const p = doc.createElement('p'),
            br = doc.createElement('br');
          br.dataset.inkforgePlaceholder = '';
          p.dataset.inkforgePlaceholder = '';
          p.appendChild(br);
          root.appendChild(p);
        }
      }
      for (const id of records.keys()) if (!live.has(id)) records.delete(id);
      if (restore && doc.activeElement === root && !s.disposed) restoreNative(s.selection);
    });
    if (policyBlocked && lastDiagnostic !== 'CONTENT_POLICY_REQUIRED')
      diagnostic('CONTENT_POLICY_REQUIRED');
    publishStatus();
  }
  function nativePoint(
    node: Node | null,
    offset: number,
    affinity: ModelPosition['affinity'],
  ): ModelPosition | null {
    if (!node || (!root.contains(node) && node !== root)) return null;
    const s = controller.getSnapshot();
    let element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    const owner = element?.closest<HTMLElement>('[data-inkforge-node]');
    if (!owner || !root.contains(owner))
      return {
        nodeId: s.rootId,
        offset: Math.min(offset, s.nodeIndex[s.rootId]?.childIds.length ?? 0),
        affinity,
      };
    const id = owner.dataset.inkforgeNode!,
      v = s.nodeIndex[id];
    if (!v) return null;
    if (v.node.type === 'text') {
      const prefix = doc.createRange();
      prefix.selectNodeContents(owner);
      try {
        prefix.setEnd(node, offset);
      } catch {
        return null;
      }
      const value = prefix.toString().length;
      if (value > v.node.text.length) return null;
      return { nodeId: id, offset: value, affinity };
    }
    if (v.node.type === 'hard-break') {
      const parent = s.nodeIndex[v.parentId!]!;
      return { nodeId: parent.id, offset: parent.childIds.indexOf(id), affinity };
    }
    if (node === owner)
      return { nodeId: id, offset: Math.min(offset, v.childIds.length), affinity };
    const block = blockOf(s, { nodeId: id, offset: 0, affinity });
    if (!block) return null;
    const blockDom = records.get(block)?.dom;
    if (!blockDom) return null;
    const prefix = doc.createRange();
    prefix.selectNodeContents(blockDom);
    try {
      prefix.setEnd(node, offset);
    } catch {
      return null;
    }
    return pointAt(s, block, prefix.toString().length, affinity);
  }
  function readNative(): ModelSelection | null {
    const selection = doc.getSelection();
    if (
      !selection?.rangeCount ||
      !root.contains(selection.anchorNode) ||
      !root.contains(selection.focusNode)
    )
      return null;
    let anchor = nativePoint(selection.anchorNode, selection.anchorOffset, 'forward'),
      head = nativePoint(selection.focusNode, selection.focusOffset, 'forward');
    if (!anchor || !head) return null;
    if (modelOffset(controller.getSnapshot(), anchor) < modelOffset(controller.getSnapshot(), head))
      anchor = { ...anchor, affinity: 'backward' };
    else if (
      modelOffset(controller.getSnapshot(), anchor) > modelOffset(controller.getSnapshot(), head)
    )
      head = { ...head, affinity: 'backward' };
    return { anchor, head };
  }
  function syncSelection() {
    if (
      !active ||
      controller.getSnapshot().disposed ||
      rendering ||
      pending ||
      controller.getSnapshot().composing ||
      doc.activeElement !== root
    )
      return;
    const selection = readNative(),
      s = controller.getSnapshot();
    if (selection && !sameSelection(s, selection, s.selection)) {
      ownDispatch = true;
      try {
        const r = controller.setSelection(selection, { expected: s.token });
        if (r.status === 'rejected') diagnostic(r.diagnostics[0]?.code ?? 'SELECTION_REJECTED');
      } finally {
        ownDispatch = false;
      }
    }
  }
  function nativeLocation(p: ModelPosition): [Node, number] | null {
    const s = controller.getSnapshot();
    if (p.nodeId === s.rootId)
      return [root, Math.min(p.offset, s.nodeIndex[s.rootId]?.childIds.length ?? 0)];
    const record = records.get(p.nodeId);
    if (!record) return null;
    return record.text
      ? [record.text, Math.min(p.offset, record.text.length)]
      : [record.dom, Math.min(p.offset, s.nodeIndex[p.nodeId]?.childIds.length ?? 0)];
  }
  function restoreNative(selection: ModelSelection | null) {
    if (!selection || pending?.active || quarantined) return;
    const anchor = nativeLocation(selection.anchor),
      head = nativeLocation(selection.head);
    if (!anchor || !head) return;
    doc.getSelection()?.setBaseAndExtent(anchor[0], anchor[1], head[0], head[1]);
  }
  function context(): DispatchContext | null {
    try {
      const fence = options.captureHostFence?.();
      return { expected: controller.getSnapshot().token, ...(fence ? { fence } : {}) };
    } catch {
      diagnostic('HOST_FENCE_UNAVAILABLE');
      return null;
    }
  }
  function blocked() {
    const s = controller.getSnapshot();
    return (
      !active ||
      options.disabled ||
      policyBlocked ||
      quarantined ||
      s.disposed ||
      s.readOnly ||
      s.composing
    );
  }
  function execute(command: ControllerCommand, captured?: DispatchContext): boolean {
    if (blocked()) return false;
    if (!captured) syncSelection();
    const c = captured ?? context();
    if (!c) return false;
    ownDispatch = true;
    try {
      const r = controller.dispatch(command, c);
      if (r.status === 'rejected') {
        diagnostic(r.diagnostics[0]?.code ?? 'EDIT_REJECTED');
        render(controller.getSnapshot(), true);
        return false;
      }
      return true;
    } finally {
      ownDispatch = false;
    }
  }
  function pendingFromCurrent(
    id: string,
    range: ModelSelection,
    token: ControllerToken,
    fence?: HostFence,
  ): Pending {
    const s = controller.getSnapshot(),
      blockId = blockOf(s, range.anchor) ?? s.rootId;
    return {
      id,
      token,
      context: options.interactionContextKey,
      ...(fence ? { fence } : {}),
      range,
      blockId,
      before: modelText(s, blockId),
      text: modelText(s, blockId),
      active: false,
      ended: false,
      invalid: false,
    };
  }
  function captureDraft() {
    if (!pending) return;
    const node = records.get(pending.blockId)?.dom ?? root,
      value = domText(node);
    if (value.length > options.maxNativeTextUtf16) {
      pending.invalid = true;
      diagnostic('NATIVE_DRAFT_LIMIT');
      return;
    }
    pending.text = value;
  }
  function quarantine(code: string) {
    if (!active || controller.getSnapshot().disposed) return;
    diagnostic(code);
    quarantined = true;
    if (!pending) {
      const c = context(),
        s = controller.getSnapshot();
      if (c && s.selection && !s.composing) {
        const id = 'native-quarantine-' + ++serial;
        const r = controller.dispatch({ kind: 'beginComposition', compositionId: id }, c);
        if (r.status !== 'rejected')
          pending = pendingFromCurrent(id, s.selection, r.snapshot.token, c.fence);
      }
    }
    if (pending) {
      pending.invalid = true;
      captureDraft();
    }
    if (!pending?.active)
      withWrites(() => root.replaceChildren(doc.createTextNode(pending?.text ?? domText(root))));
    publishStatus();
  }
  function selectionRange(): ModelSelection | null {
    syncSelection();
    return controller.getSnapshot().selection;
  }
  function beginNative(event: CompositionEvent) {
    if (blocked()) {
      diagnostic('COMPOSITION_UNAVAILABLE');
      return;
    }
    syncSelection();
    const c = context(),
      s = controller.getSnapshot();
    if (!c || !s.selection) return;
    const id = 'native-ime-' + ++serial;
    pending = pendingFromCurrent(id, s.selection, s.token, c.fence);
    pending.active = true;
    const r = controller.dispatch({ kind: 'beginComposition', compositionId: id }, c);
    if (r.status === 'rejected') {
      diagnostic(r.diagnostics[0]?.code ?? 'COMPOSITION_REJECTED');
      pending.invalid = true;
      quarantined = true;
    } else pending.token = r.snapshot.token;
    const other = blockOf(s, s.selection.head);
    if (other !== pending.blockId) {
      pending.invalid = true;
      diagnostic('COMPOSITION_RANGE_UNSUPPORTED');
    }
    publishStatus();
  }
  function finishNative() {
    const draft = pending;
    if (!draft || draft.active || !draft.ended) return;
    captureDraft();
    const s = controller.getSnapshot();
    if (
      draft.invalid ||
      quarantined ||
      options.disabled ||
      s.readOnly ||
      draft.context !== options.interactionContextKey
    ) {
      quarantine('COMPOSITION_REVIEW_REQUIRED');
      return;
    }
    const b = bounds(s).get(draft.blockId);
    if (!b) {
      quarantine('COMPOSITION_MODEL_CHANGED');
      return;
    }
    const from =
      Math.min(modelOffset(s, draft.range.anchor), modelOffset(s, draft.range.head)) - b.start;
    const to =
      Math.max(modelOffset(s, draft.range.anchor), modelOffset(s, draft.range.head)) - b.start;
    const prefix = draft.before.slice(0, from),
      suffix = draft.before.slice(to);
    if (
      !draft.text.startsWith(prefix) ||
      !draft.text.endsWith(suffix) ||
      draft.text.length < prefix.length + suffix.length
    ) {
      quarantine('COMPOSITION_REGION_CHANGED');
      return;
    }
    const inserted = draft.text.slice(prefix.length, draft.text.length - suffix.length);
    ownDispatch = true;
    const r = controller.dispatch(
      { kind: 'commitComposition', compositionId: draft.id, text: inserted },
      { expected: draft.token, ...(draft.fence ? { fence: draft.fence } : {}) },
    );
    ownDispatch = false;
    if (r.status === 'rejected') {
      quarantine(r.diagnostics[0]?.code ?? 'COMPOSITION_REJECTED');
      return;
    }
    pending = null;
    quarantined = false;
    nativeEdit = null;
    lastDiagnostic = null;
    render(r.snapshot, true);
  }
  function endNative() {
    if (!pending) return;
    pending.active = false;
    pending.ended = true;
    captureDraft();
    finishNative();
  }
  function beforeInput(event: InputEvent) {
    if (event.defaultPrevented) return;
    if (pending?.active || event.isComposing) return;
    if (pending || blocked()) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    const range = selectionRange(),
      s = controller.getSnapshot();
    if (!range) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (!event.cancelable) {
      const c = context(),
        blockId = blockOf(s, range.anchor);
      if (
        c &&
        blockId &&
        blockOf(s, range.head) === blockId &&
        [
          'insertText',
          'insertReplacementText',
          'deleteContentBackward',
          'deleteContentForward',
        ].includes(event.inputType)
      )
        nativeEdit = {
          token: c.expected,
          context: options.interactionContextKey,
          ...(c.fence ? { fence: c.fence } : {}),
          range,
          blockId,
          before: modelText(s, blockId),
        };
      else diagnostic('NATIVE_INPUT_REQUIRES_REVIEW');
      return;
    }
    event.preventDefault();
    let command: ControllerCommand | null = null;
    if (event.inputType === 'insertText' || event.inputType === 'insertReplacementText')
      command = {
        kind: 'insertText',
        range,
        text: event.data ?? '',
        typing: event.inputType === 'insertText',
      };
    else if (event.inputType === 'insertParagraph') command = { kind: 'splitBlock', range };
    else if (event.inputType === 'insertLineBreak') command = { kind: 'insertHardBreak', range };
    else if (
      [
        'deleteContentBackward',
        'deleteWordBackward',
        'deleteContentForward',
        'deleteWordForward',
      ].includes(event.inputType)
    )
      command = {
        kind: event.inputType.endsWith('Backward') ? 'deleteBackward' : 'deleteForward',
        range,
        unit: event.inputType.includes('Word') ? 'word' : 'grapheme',
      };
    else if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo')
      command = { kind: event.inputType === 'historyUndo' ? 'undo' : 'redo' };
    else if (event.inputType === 'deleteByCut' || event.inputType === 'deleteByDrag') {
      diagnostic('CUT_DROP_UNAVAILABLE');
      return;
    } else if (event.inputType === 'insertFromComposition') return;
    else if (event.inputType.startsWith('format')) {
      const mark = (
        { formatBold: 'bold', formatItalic: 'italic', formatUnderline: 'underline' } as Record<
          string,
          Mark
        >
      )[event.inputType];
      if (mark)
        command = { kind: selectionMarks().includes(mark) ? 'clearMark' : 'setMark', range, mark };
    }
    if (command) execute(command);
    else diagnostic('UNSUPPORTED_INPUT');
  }
  function reconcileNative(edit: NativeEdit) {
    const s = controller.getSnapshot(),
      el = records.get(edit.blockId)?.dom;
    if (!el || edit.context !== options.interactionContextKey) {
      quarantine('NATIVE_CONTEXT_CHANGED');
      return;
    }
    const next = domText(el);
    if (next.length > options.maxNativeTextUtf16) {
      quarantine('NATIVE_DRAFT_LIMIT');
      return;
    }
    let a = 0,
      b = 0;
    while (a < edit.before.length && a < next.length && edit.before[a] === next[a]) a++;
    if (a > 0 && /[\uD800-\uDBFF]/.test(edit.before[a - 1]!)) a--;
    while (
      b < edit.before.length - a &&
      b < next.length - a &&
      edit.before[edit.before.length - 1 - b] === next[next.length - 1 - b]
    )
      b++;
    if (b > 0 && /[\uDC00-\uDFFF]/.test(edit.before[edit.before.length - b]!)) b--;
    const range = {
      anchor: pointAt(s, edit.blockId, a, 'backward'),
      head: pointAt(s, edit.blockId, edit.before.length - b, 'forward'),
    };
    ownDispatch = true;
    const r = controller.dispatch(
      { kind: 'insertText', range, text: next.slice(a, next.length - b) },
      { expected: edit.token, ...(edit.fence ? { fence: edit.fence } : {}) },
    );
    ownDispatch = false;
    if (r.status === 'rejected')
      quarantine(r.diagnostics[0]?.code ?? 'NATIVE_RECONCILIATION_REJECTED');
    else render(r.snapshot, true);
  }
  function input(event: InputEvent) {
    if (pending?.active) {
      captureDraft();
      return;
    }
    if (pending?.ended) {
      finishNative();
      return;
    }
    if (nativeEdit) {
      const edit = nativeEdit;
      nativeEdit = null;
      reconcileNative(edit);
      return;
    }
    // Owned beforeinput already prevented native mutation. A trailing composition input
    // may observe the same rendered state; it must not dispatch the final text twice.
    if (
      event.inputType === 'insertCompositionText' ||
      event.inputType === 'insertFromComposition'
    ) {
      render(controller.getSnapshot(), true);
      return;
    }
    if (observer.takeRecords().length) quarantine('INPUT_WITHOUT_CAPTURE');
  }
  function selectionMarks(): readonly Mark[] {
    const s = controller.getSnapshot();
    if (s.storedMarks !== null) return s.storedMarks;
    const r = s.selection;
    if (!r) return [];
    const lo = Math.min(modelOffset(s, r.anchor), modelOffset(s, r.head)),
      hi = Math.max(modelOffset(s, r.anchor), modelOffset(s, r.head)),
      all = bounds(s);
    const selected = Object.values(s.nodeIndex).filter(
      (v) =>
        v.node.type === 'text' &&
        (lo === hi
          ? v.id === r.anchor.nodeId
          : all.get(v.id)!.start < hi && all.get(v.id)!.start + v.node.text.length > lo),
    );
    return marks.filter(
      (m) =>
        selected.length > 0 &&
        selected.every((v) => v.node.type === 'text' && v.node.marks?.includes(m)),
    );
  }
  function keyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.isComposing || event.keyCode === 229 || pending?.active) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!['z', 'y', 'b', 'i', 'u'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (blocked()) return;
    const range = selectionRange();
    if (key === 'z' || key === 'y')
      execute({ kind: key === 'y' || event.shiftKey ? 'redo' : 'undo' });
    else if (range) {
      const mark = ({ b: 'bold', i: 'italic', u: 'underline' } as const)[key as 'b'];
      execute({ kind: selectionMarks().includes(mark) ? 'clearMark' : 'setMark', mark, range });
    }
  }
  function paste(event: ClipboardEvent) {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (blocked()) return;
    if (!event.clipboardData || event.clipboardData.types.includes('text/html')) {
      diagnostic('RICH_PASTE_REQUIRES_SLICE');
      return;
    }
    const text = event.clipboardData.getData('text/plain'),
      range = selectionRange();
    if (text.length > options.maxNativeTextUtf16) {
      diagnostic('NATIVE_DRAFT_LIMIT');
      return;
    }
    if (range) execute({ kind: 'insertPlainText', range, text });
  }
  function copy(event: ClipboardEvent) {
    event.preventDefault();
    if (!event.clipboardData) {
      diagnostic('CLIPBOARD_UNAVAILABLE');
      return;
    }
    if (!readNative()) return;
    event.clipboardData.setData('text/plain', doc.getSelection()?.toString() ?? '');
  }
  function cut(event: ClipboardEvent) {
    event.preventDefault();
    diagnostic('CUT_REQUIRES_CONFIRMED_WRITER');
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    diagnostic('DROP_UNAVAILABLE');
  }
  function click(event: MouseEvent) {
    if ((event.target as Element).closest('a')) event.preventDefault();
  }
  function selectionChange() {
    if (doc.activeElement === root) syncSelection();
  }
  const listeners: [EventTarget, string, EventListener][] = [];
  const on = (target: EventTarget, name: string, fn: EventListener) => {
    target.addEventListener(name, fn);
    listeners.push([target, name, fn]);
  };
  on(root, 'beforeinput', beforeInput as EventListener);
  on(root, 'input', input as EventListener);
  on(root, 'compositionstart', beginNative as EventListener);
  on(root, 'compositionend', endNative);
  on(root, 'keydown', keyDown as EventListener);
  on(root, 'paste', paste as EventListener);
  on(root, 'copy', copy as EventListener);
  on(root, 'cut', cut as EventListener);
  on(root, 'drop', drop as EventListener);
  on(root, 'click', click as EventListener);
  on(doc, 'selectionchange', selectionChange);
  const stop = controller.subscribe(() => {
    if (!active) return;
    const s = controller.getSnapshot();
    if (s.disposed) {
      pending = null;
      nativeEdit = null;
      quarantined = false;
      retained.get(controller)?.stop();
      retained.delete(controller);
      records.clear();
      lastSnapshot = s;
      // Terminal clearing precedes ordinary native-mutation quarantine.
      render(s, false);
      return;
    }
    if (!ownDispatch && observer.takeRecords().length && !pending?.active && !nativeEdit) {
      quarantine('EXTERNAL_UPDATE_WITH_NATIVE_DRAFT');
      return;
    }
    if (!s.composing && pending && !pending.active) {
      pending = null;
      quarantined = false;
    }
    if (!pending?.active && !quarantined) render(s, ownDispatch || doc.activeElement === root);
    else publishStatus();
    lastSnapshot = s;
  });
  render(lastSnapshot, false);
  const saved = retained.get(controller);
  if (saved) {
    saved.stop();
    retained.delete(controller);
    pending = saved.pending;
    if (
      controller.getSnapshot().composing &&
      pending.token.sessionId === controller.getSnapshot().sessionId
    ) {
      pending.active = false;
      pending.ended = true;
      pending.invalid = true;
      quarantined = true;
      withWrites(() => root.replaceChildren(doc.createTextNode(pending!.text)));
      diagnostic('COMPOSITION_SURFACE_SUSPENDED');
      publishStatus();
    } else pending = null;
  }
  return {
    getStatus: () => {
      if (active && observer.takeRecords().length && !pending?.active && !nativeEdit)
        quarantine('INPUT_WITHOUT_CAPTURE');
      return status;
    },
    update(next) {
      options = next;
      if (pending && pending.context !== next.interactionContextKey && !pending.invalid) {
        pending.invalid = true;
        diagnostic('COMPOSITION_CONTEXT_CHANGED');
      }
      publishStatus();
    },
    detach() {
      if (!active) return;
      if (pending) {
        captureDraft();
        const value = pending;
        let cleanup = () => {};
        cleanup = controller.subscribe(() => {
          if (controller.getSnapshot().disposed) {
            value.text = '';
            value.before = '';
            retained.delete(controller);
            cleanup();
          }
        });
        retained.set(controller, { pending: value, stop: cleanup });
      }
      active = false;
      stop();
      observer.disconnect();
      for (const [target, name, fn] of listeners) target.removeEventListener(name, fn);
      if (owners.get(controller) === root) owners.delete(controller);
    },
    discardDraft() {
      if (!active || controller.getSnapshot().disposed || pending?.active) return false;
      if (pending && controller.getSnapshot().composing) {
        const r = controller.dispatch(
          { kind: 'cancelComposition', compositionId: pending.id },
          { expected: pending.token, ...(pending.fence ? { fence: pending.fence } : {}) },
        );
        if (r.status === 'rejected') {
          diagnostic(r.diagnostics[0]?.code ?? 'DISCARD_REJECTED');
          return false;
        }
      }
      pending = null;
      quarantined = false;
      nativeEdit = null;
      lastDiagnostic = null;
      retained.get(controller)?.stop();
      retained.delete(controller);
      render(controller.getSnapshot(), false);
      return true;
    },
    captureBookmark() {
      if (blocked()) return null;
      syncSelection();
      const c = context();
      if (!c) return null;
      const r = controller.captureBookmark(c);
      if (r.status === 'rejected') {
        diagnostic(r.diagnostics[0]?.code ?? 'BOOKMARK_REJECTED');
        return null;
      }
      return r.bookmark;
    },
    applyBookmark(bookmark, command) {
      if (blocked()) return false;
      const c = { expected: bookmark.token, bookmark },
        r = controller.restoreBookmark(bookmark, c);
      if (r.status === 'rejected') {
        diagnostic(r.diagnostics[0]?.code ?? 'BOOKMARK_REJECTED');
        return false;
      }
      root.focus({ preventScroll: true });
      restoreNative(bookmark.selection);
      return execute(command, c);
    },
    selectionMarks,
  };
}

/** Escaped semantic SSR seed. It is never read back as model authority. */
export function renderEngineSeed(snapshot: ControllerSnapshot): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  function node(id: string): string {
    const v = snapshot.nodeIndex[id]!,
      n = v.node;
    const tag =
      n.type === 'paragraph'
        ? 'p'
        : n.type === 'heading'
          ? 'h' + n.level
          : n.type === 'list'
            ? n.ordered
              ? 'ol'
              : 'ul'
            : n.type === 'list-item'
              ? 'li'
              : n.type === 'hard-break'
                ? 'br'
                : n.type === 'link'
                  ? 'a'
                  : 'span';
    let inside = n.type === 'text' ? escape(n.text) : v.childIds.map(node).join('');
    if (n.type === 'text')
      for (const mark of [...(n.marks ?? [])].reverse())
        inside = `<${markTags[mark]}>${inside}</${markTags[mark]}>`;
    if (!inside && textBlock(snapshot, id)) inside = '<br data-inkforge-placeholder="">';
    return `<${tag} data-inkforge-node="${escape(id)}" data-inkforge-type="${n.type}">${tag === 'br' ? '' : inside + `</${tag}>`}`;
  }
  return (
    snapshot.nodeIndex[snapshot.rootId]?.childIds.map(node).join('') ||
    '<p data-inkforge-placeholder=""><br data-inkforge-placeholder=""></p>'
  );
}
