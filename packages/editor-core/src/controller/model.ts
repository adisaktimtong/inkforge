import type { DeepReadonly, DocumentNode, Mark } from '../index.js';
import type {
  ControllerLimits,
  ModelPosition,
  ModelSelection,
  NodeView,
  PositionMapStep,
} from './types.js';
export type RNode = {
  type: string;
  text?: string;
  marks?: Mark[];
  className?: string;
  style?: string;
  href?: string;
  target?: '_self' | '_blank';
  level?: number;
  ordered?: boolean;
  children?: RNode[];
  items?: RNode[];
};
export interface Tree {
  root: RNode;
  ids: Map<RNode, string>;
  nodes: Map<string, RNode>;
}
export interface StoredNode {
  node: RNode;
  identities: readonly string[];
}
export type Primitive =
  | { kind: 'insertText'; id: string; offset: number; text: string }
  | { kind: 'deleteText'; id: string; offset: number; length: number }
  | { kind: 'splitText'; id: string; offset: number; rightId: string }
  | { kind: 'joinText'; leftId: string; rightId: string }
  | { kind: 'insert'; parentId: string; index: number; value: StoredNode }
  | { kind: 'remove'; parentId: string; index: number; fallback?: ModelPosition }
  | {
      kind: 'patch';
      id: string;
      values: { [K in Exclude<keyof RNode, 'children' | 'items'>]?: RNode[K] | undefined };
    }
  | { kind: 'moveChildren'; from: string; to: string; start: number; count: number; index: number };
export class Rejection extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export function fail(code: string): never {
  throw new Rejection(code);
}
export const marks = ['bold', 'italic', 'underline', 'strike', 'code'] as const;
function denseArray(value: unknown, maximum: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > maximum || Object.getOwnPropertySymbols(value).length)
    return false;
  const keys = Object.keys(value),
    descriptors = Object.getOwnPropertyDescriptors(value);
  return (
    keys.length === value.length &&
    keys.every((key, i) => key === String(i)) &&
    Object.values(descriptors).every((d) => !d.get && !d.set) &&
    Object.keys(descriptors).every((key) => key === 'length' || keys.includes(key))
  );
}

export function checkedMarks(input: unknown): Mark[] {
  if (
    !denseArray(input, marks.length) ||
    input.some((m) => !marks.includes(m as Mark)) ||
    new Set(input).size !== input.length
  )
    fail('INVALID_MARKS');
  return marks.filter((m) => input.includes(m));
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => JSON.stringify(k) + ':' + canonical(v))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
export const byteSize = (value: unknown): number =>
  new TextEncoder().encode(canonical(value)).length;
export const children = (n: RNode): RNode[] => n.items ?? n.children ?? [];
const containers = ['document', 'paragraph', 'heading', 'list', 'list-item', 'link'];
export const textBlock = (n: RNode) => n.type === 'paragraph' || n.type === 'heading';
export const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);
export function validateModel(input: unknown, limits: ControllerLimits): RNode {
  const seen = new Set<unknown>();
  let count = 0,
    textLength = 0,
    stringUnits = 0;
  const accountString = (value: string) => {
    stringUnits += value.length;
    if (stringUnits > limits.maxDocumentBytes) fail('DOCUMENT_BYTES');
  };
  function visit(raw: unknown, allowed: readonly string[], depth: number): RNode {
    if (
      !raw ||
      typeof raw !== 'object' ||
      Array.isArray(raw) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(raw))
    )
      fail('INVALID_MODEL');
    if (seen.has(raw) || depth > limits.maxDepth || ++count > limits.maxNodes)
      fail('MODEL_LIMIT_OR_ALIAS');
    seen.add(raw);
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Object.values(descriptors).some((d) => d.get || d.set)) fail('MODEL_ACCESSOR');
    if (
      Object.getOwnPropertySymbols(raw).length ||
      Object.values(descriptors).some((d) => !d.enumerable)
    )
      fail('UNKNOWN_MODEL_FIELD');
    const n = raw as RNode;
    if (!allowed.includes(n.type)) fail('INVALID_NODE_TYPE');
    const fields: Record<string, readonly string[]> = {
      document: ['children'],
      paragraph: ['children'],
      heading: ['level', 'children'],
      list: ['ordered', 'items'],
      'list-item': ['children'],
      text: ['text', 'marks'],
      link: ['href', 'target', 'children'],
      'hard-break': [],
    };
    if (
      Object.keys(n).some(
        (k) =>
          ![
            'type',
            ...(n.type === 'document' ? [] : ['className', 'style']),
            ...fields[n.type]!,
          ].includes(k),
      )
    )
      fail('UNKNOWN_MODEL_FIELD');
    const out: RNode = { type: n.type };
    for (const key of ['className', 'style'] as const)
      if (n[key] !== undefined) {
        if (typeof n[key] !== 'string') fail('INVALID_PRESENTATION');
        accountString(n[key]);
        out[key] = n[key];
      }
    if (n.type === 'text') {
      if (typeof n.text !== 'string' || !n.text.isWellFormed()) fail('INVALID_TEXT');
      textLength += n.text.length;
      if (textLength > limits.maxTextUtf16) fail('TEXT_LIMIT');
      accountString(n.text);
      out.text = n.text;
      if (n.marks !== undefined) {
        const m = checkedMarks(n.marks);
        if (m.length) out.marks = m;
      }
    }
    if (n.type === 'heading') {
      if (!Number.isInteger(n.level) || n.level! < 1 || n.level! > 6) fail('INVALID_HEADING');
      out.level = n.level!;
    }
    if (n.type === 'list') {
      if (typeof n.ordered !== 'boolean') fail('INVALID_LIST');
      out.ordered = n.ordered;
    }
    if (n.type === 'link') {
      if (
        typeof n.href !== 'string' ||
        !n.href.isWellFormed() ||
        (n.target !== undefined && !['_self', '_blank'].includes(n.target))
      )
        fail('INVALID_LINK');
      accountString(n.href);
      out.href = n.href;
      if (n.target !== undefined) out.target = n.target;
    }
    if (containers.includes(n.type)) {
      const rawChildren = n.type === 'list' ? n.items : n.children;
      if (!denseArray(rawChildren, limits.maxNodes)) fail('INVALID_CHILDREN');
      const allowedChildren =
        n.type === 'list'
          ? ['list-item']
          : ['paragraph', 'heading', 'link'].includes(n.type)
            ? n.type === 'link'
              ? ['text', 'hard-break']
              : ['text', 'link', 'hard-break']
            : ['paragraph', 'heading', 'list'];
      const copied = rawChildren.map((c) => visit(c, allowedChildren, depth + 1));
      if (n.type === 'list') out.items = copied;
      else out.children = copied;
    }
    return out;
  }
  const root = visit(input, ['document'], 0);
  if (byteSize(root) > limits.maxDocumentBytes) fail('DOCUMENT_BYTES');
  return root;
}
export function makeTree(
  root: RNode,
  allocate: () => string,
  identities?: readonly string[],
): Tree {
  const tree: Tree = { root, ids: new Map(), nodes: new Map() };
  let i = 0;
  const visit = (node: RNode) => {
    const id = identities ? identities[i++]! : allocate();
    if (!id || tree.nodes.has(id)) fail('INVALID_IDENTITY');
    tree.ids.set(node, id);
    tree.nodes.set(id, node);
    children(node).forEach(visit);
  };
  visit(root);
  if (identities && i !== identities.length) fail('INVALID_IDENTITY');
  return tree;
}
export function cloneNode(n: RNode): RNode {
  return {
    ...n,
    ...(n.marks ? { marks: [...n.marks] } : {}),
    ...(n.children ? { children: n.children.map(cloneNode) } : {}),
    ...(n.items ? { items: n.items.map(cloneNode) } : {}),
  };
}
export function store(tree: Tree, node: RNode): StoredNode {
  const identities: string[] = [];
  const visit = (n: RNode) => {
    identities.push(tree.ids.get(n)!);
    children(n).forEach(visit);
  };
  visit(node);
  return { node: cloneNode(node), identities };
}
export function cloneTree(tree: Tree): Tree {
  const saved = store(tree, tree.root);
  return makeTree(saved.node, () => fail('IDENTITY'), saved.identities);
}
export function parentOf(
  tree: Tree,
  id: string,
): { node: RNode; id: string; index: number } | null {
  const target = tree.nodes.get(id);
  if (!target) fail('UNKNOWN_NODE');
  for (const [parentId, node] of tree.nodes) {
    const index = children(node).indexOf(target);
    if (index >= 0) return { node, id: parentId, index };
  }
  return null;
}
export function checkPosition(tree: Tree, raw: unknown): ModelPosition {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_POSITION');
  const p = raw as ModelPosition,
    node = tree.nodes.get(p.nodeId);
  if (
    !node ||
    !['forward', 'backward'].includes(p.affinity) ||
    !Number.isSafeInteger(p.offset) ||
    p.offset < 0 ||
    node.type === 'hard-break'
  )
    fail('INVALID_POSITION');
  const length = node.type === 'text' ? node.text!.length : children(node).length;
  if (p.offset > length || (node.type === 'text' && !legalTextOffset(node.text!, p.offset)))
    fail('INVALID_POSITION');
  return { nodeId: p.nodeId, offset: p.offset, affinity: p.affinity };
}
export function legalTextOffset(text: string, offset: number): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= 0 &&
    offset <= text.length &&
    !(
      offset > 0 &&
      offset < text.length &&
      /[\uD800-\uDBFF]/.test(text[offset - 1]!) &&
      /[\uDC00-\uDFFF]/.test(text[offset]!)
    )
  );
}
export function checkSelection(
  tree: Tree,
  selection: ModelSelection | null,
): ModelSelection | null {
  if (selection === null) return null;
  if (!selection || typeof selection !== 'object') fail('INVALID_SELECTION');
  return {
    anchor: checkPosition(tree, selection.anchor),
    head: checkPosition(tree, selection.head),
  };
}
export function coordinates(
  tree: Tree,
): Map<string, { start: number; end: number; boundaries: number[] }> {
  const result = new Map<string, { start: number; end: number; boundaries: number[] }>();
  let cursor = 0;
  function visit(n: RNode) {
    const start = cursor,
      boundaries = [cursor];
    if (n.type === 'text') cursor += n.text!.length;
    else if (n.type === 'hard-break') cursor++;
    else
      for (const child of children(n)) {
        visit(child);
        boundaries.push(cursor);
      }
    result.set(tree.ids.get(n)!, { start, end: cursor, boundaries });
    if (textBlock(n)) cursor++;
  }
  visit(tree.root);
  return result;
}
export function positionOffset(tree: Tree, p: ModelPosition): number {
  checkPosition(tree, p);
  const bound = coordinates(tree).get(p.nodeId)!;
  return tree.nodes.get(p.nodeId)!.type === 'text'
    ? bound.start + p.offset
    : bound.boundaries[p.offset]!;
}
export function ordered(
  tree: Tree,
  range: ModelSelection,
): { start: ModelPosition; end: ModelPosition; from: number; to: number } {
  checkSelection(tree, range);
  const a = positionOffset(tree, range.anchor),
    b = positionOffset(tree, range.head);
  return a <= b
    ? { start: range.anchor, end: range.head, from: a, to: b }
    : { start: range.head, end: range.anchor, from: b, to: a };
}
export function blockFor(tree: Tree, p: ModelPosition): { node: RNode; id: string } {
  let id = p.nodeId,
    node = tree.nodes.get(id)!;
  while (node) {
    if (textBlock(node)) return { node, id };
    const parent = parentOf(tree, id);
    if (!parent) break;
    id = parent.id;
    node = parent.node;
  }
  fail('UNSUPPORTED_CONTAINER_POSITION');
}
export function mapStep(position: ModelPosition, step: PositionMapStep): ModelPosition {
  const p = { ...position };
  if (
    step.kind === 'insertText' &&
    p.nodeId === step.nodeId &&
    (p.offset > step.offset || (p.offset === step.offset && p.affinity === 'forward'))
  )
    p.offset += step.length;
  if (step.kind === 'deleteText' && p.nodeId === step.nodeId)
    p.offset =
      p.offset <= step.from
        ? p.offset
        : p.offset >= step.to
          ? p.offset - (step.to - step.from)
          : step.from;
  if (
    step.kind === 'splitText' &&
    p.nodeId === step.leftId &&
    (p.offset > step.offset || (p.offset === step.offset && p.affinity === 'forward'))
  ) {
    p.nodeId = step.rightId;
    p.offset -= step.offset;
  }
  if (step.kind === 'splitText' && p.nodeId === step.parentId && p.offset > step.index) p.offset++;
  if (step.kind === 'joinText' && p.nodeId === step.parentId) {
    if (p.offset === step.index + 1)
      return { nodeId: step.leftId, offset: step.leftLength, affinity: p.affinity };
    if (p.offset > step.index + 1) p.offset--;
  }
  if (step.kind === 'joinText' && p.nodeId === step.rightId) {
    p.nodeId = step.leftId;
    p.offset += step.leftLength;
  }
  if (
    step.kind === 'insertChild' &&
    p.nodeId === step.parentId &&
    (p.offset > step.index || (p.offset === step.index && p.affinity === 'forward'))
  )
    p.offset++;
  if (step.kind === 'removeChild') {
    if (step.removedIds.includes(p.nodeId)) return { ...step.fallback, affinity: p.affinity };
    if (p.nodeId === step.parentId && p.offset === step.index && step.fallback.nodeId !== p.nodeId)
      return { ...step.fallback, affinity: p.affinity };
    if (p.nodeId === step.parentId && p.offset > step.index) p.offset--;
  }
  if (step.kind === 'moveChildren') {
    if (
      p.nodeId === step.from &&
      ((p.offset > step.start && p.offset < step.start + step.count) ||
        (p.offset === step.start && p.affinity === 'forward') ||
        (p.offset === step.start + step.count && p.affinity === 'backward'))
    )
      return { ...p, nodeId: step.to, offset: step.index + p.offset - step.start };
    if (p.nodeId === step.from && p.offset >= step.start + step.count) p.offset -= step.count;
    if (
      p.nodeId === step.to &&
      (p.offset > step.index || (p.offset === step.index && p.affinity === 'forward'))
    )
      p.offset += step.count;
  }
  return p;
}
export function mapPosition(
  position: ModelPosition,
  steps: readonly PositionMapStep[],
): ModelPosition {
  return steps.reduce(mapStep, { ...position });
}
export function snapshotIndex(tree: Tree): Readonly<Record<string, NodeView>> {
  const out: Record<string, NodeView> = Object.create(null) as Record<string, NodeView>;
  function visit(n: RNode, parentId: string | null) {
    const id = tree.ids.get(n)!;
    out[id] = {
      id,
      parentId,
      childIds: children(n).map((c) => tree.ids.get(c)!),
      node: n as NodeView['node'],
    };
    children(n).forEach((c) => visit(c, id));
  }
  visit(tree.root, null);
  return freeze(out);
}
export const asDocument = (tree: Tree): DeepReadonly<DocumentNode> =>
  tree.root as unknown as DeepReadonly<DocumentNode>;
export class Draft {
  readonly forward: Primitive[] = [];
  readonly inverse: Primitive[] = [];
  readonly steps: PositionMapStep[] = [];
  selection: ModelSelection | null;
  constructor(
    readonly tree: Tree,
    readonly allocate: () => string,
    readonly limits: ControllerLimits,
    selection: ModelSelection | null,
  ) {
    this.selection = selection
      ? { anchor: { ...selection.anchor }, head: { ...selection.head } }
      : null;
  }
  id(n: RNode) {
    return this.tree.ids.get(n)!;
  }
  node(id: string) {
    return this.tree.nodes.get(id) ?? fail('UNKNOWN_NODE');
  }
  value(n: RNode): StoredNode {
    const tree = makeTree(n, this.allocate);
    return store(tree, n);
  }
  step(step: PositionMapStep) {
    this.steps.push(step);
    if (this.selection)
      this.selection = {
        anchor: mapStep(this.selection.anchor, step),
        head: mapStep(this.selection.head, step),
      };
  }
  apply(op: Primitive) {
    if (this.forward.length >= this.limits.maxOperations) fail('OPERATION_LIMIT');
    let inverse: Primitive;
    const own = (node: RNode, add: boolean) => {
      if (add) {
        const id = this.tree.ids.get(node)!;
        if (this.tree.nodes.has(id)) fail('DUPLICATE_ID');
        this.tree.nodes.set(id, node);
      } else this.tree.nodes.delete(this.id(node));
      children(node).forEach((c) => own(c, add));
    };
    if (op.kind === 'insertText' || op.kind === 'deleteText') {
      const n = this.node(op.id);
      if (n.type !== 'text' || !legalTextOffset(n.text!, op.offset)) fail('INVALID_TEXT_OPERATION');
      if (op.kind === 'insertText') {
        if (!op.text.isWellFormed()) fail('INVALID_TEXT');
        n.text = n.text!.slice(0, op.offset) + op.text + n.text!.slice(op.offset);
        inverse = { kind: 'deleteText', id: op.id, offset: op.offset, length: op.text.length };
        this.step({ kind: 'insertText', nodeId: op.id, offset: op.offset, length: op.text.length });
      } else {
        if (!legalTextOffset(n.text!, op.offset + op.length) || op.length < 0)
          fail('INVALID_TEXT_OPERATION');
        const text = n.text!.slice(op.offset, op.offset + op.length);
        n.text = n.text!.slice(0, op.offset) + n.text!.slice(op.offset + op.length);
        inverse = { kind: 'insertText', id: op.id, offset: op.offset, text };
        this.step({
          kind: 'deleteText',
          nodeId: op.id,
          from: op.offset,
          to: op.offset + op.length,
        });
      }
    } else if (op.kind === 'splitText') {
      const n = this.node(op.id),
        parent = parentOf(this.tree, op.id);
      if (
        n.type !== 'text' ||
        !parent ||
        this.tree.nodes.has(op.rightId) ||
        !legalTextOffset(n.text!, op.offset)
      )
        fail('INVALID_SPLIT');
      const right = {
        ...n,
        ...(n.marks ? { marks: [...n.marks] } : {}),
        text: n.text!.slice(op.offset),
      };
      n.text = n.text!.slice(0, op.offset);
      this.tree.ids.set(right, op.rightId);
      this.tree.nodes.set(op.rightId, right);
      children(parent.node).splice(parent.index + 1, 0, right);
      inverse = { kind: 'joinText', leftId: op.id, rightId: op.rightId };
      this.step({
        kind: 'splitText',
        leftId: op.id,
        rightId: op.rightId,
        offset: op.offset,
        parentId: parent.id,
        index: parent.index,
      });
    } else if (op.kind === 'joinText') {
      const l = this.node(op.leftId),
        r = this.node(op.rightId),
        lp = parentOf(this.tree, op.leftId),
        rp = parentOf(this.tree, op.rightId);
      if (
        !lp ||
        !rp ||
        lp.id !== rp.id ||
        rp.index !== lp.index + 1 ||
        l.type !== 'text' ||
        r.type !== 'text' ||
        !same({ ...l, text: '' }, { ...r, text: '' })
      )
        fail('INVALID_JOIN');
      const offset = l.text!.length;
      l.text += r.text!;
      children(lp.node).splice(rp.index, 1);
      this.tree.nodes.delete(op.rightId);
      inverse = { kind: 'splitText', id: op.leftId, offset, rightId: op.rightId };
      this.step({
        kind: 'joinText',
        leftId: op.leftId,
        rightId: op.rightId,
        leftLength: offset,
        parentId: lp.id,
        index: lp.index,
      });
    } else if (op.kind === 'insert') {
      const parent = this.node(op.parentId),
        list = parent.items ?? parent.children;
      if (!list || !Number.isSafeInteger(op.index) || op.index < 0 || op.index > list.length)
        fail('INVALID_INSERT');
      const inserted = makeTree(cloneNode(op.value.node), this.allocate, op.value.identities);
      for (const id of inserted.nodes.keys()) if (this.tree.nodes.has(id)) fail('DUPLICATE_ID');
      for (const [node, id] of inserted.ids) this.tree.ids.set(node, id);
      own(inserted.root, true);
      list.splice(op.index, 0, inserted.root);
      inverse = { kind: 'remove', parentId: op.parentId, index: op.index };
      this.step({ kind: 'insertChild', parentId: op.parentId, index: op.index });
    } else if (op.kind === 'remove') {
      const parent = this.node(op.parentId),
        list = children(parent),
        node = list[op.index];
      if (!node || !Number.isSafeInteger(op.index)) fail('INVALID_REMOVE');
      const value = store(this.tree, node);
      list.splice(op.index, 1);
      own(node, false);
      inverse = { kind: 'insert', parentId: op.parentId, index: op.index, value };
      this.step({
        kind: 'removeChild',
        parentId: op.parentId,
        index: op.index,
        removedIds: value.identities,
        fallback: op.fallback ?? { nodeId: op.parentId, offset: op.index, affinity: 'forward' },
      });
    } else if (op.kind === 'patch') {
      const n = this.node(op.id),
        previous: Primitive & { kind: 'patch' } = { kind: 'patch', id: op.id, values: {} };
      for (const key of Object.keys(op.values) as (keyof typeof op.values)[]) {
        Object.assign(previous.values, { [key]: n[key] });
        const value = op.values[key];
        if (value === undefined) delete n[key];
        else Object.assign(n, { [key]: Array.isArray(value) ? [...value] : value });
      }
      inverse = previous;
    } else {
      const from = this.node(op.from),
        to = this.node(op.to),
        src = children(from),
        dest = children(to);
      if (
        op.from === op.to ||
        !containers.includes(from.type) ||
        !containers.includes(to.type) ||
        ![op.start, op.count, op.index].every(Number.isSafeInteger) ||
        op.start < 0 ||
        op.count < 0 ||
        op.start + op.count > src.length ||
        op.index < 0 ||
        op.index > dest.length
      )
        fail('INVALID_MOVE');
      const moved = src.splice(op.start, op.count);
      dest.splice(op.index, 0, ...moved);
      inverse = {
        kind: 'moveChildren',
        from: op.to,
        to: op.from,
        start: op.index,
        count: op.count,
        index: op.start,
      };
      this.step({
        kind: 'moveChildren',
        from: op.from,
        to: op.to,
        start: op.start,
        count: op.count,
        index: op.index,
      });
    }
    this.forward.push(op);
    this.inverse.unshift(inverse);
  }
  normalize() {
    for (let pass = 0; pass < this.limits.maxNormalizationPasses; pass++) {
      let changed = false;
      for (const node of [...this.tree.nodes.values()]) {
        if (!this.tree.nodes.has(this.id(node))) continue;
        const list = children(node);
        for (let i = 0; i < list.length - 1; i++) {
          const a = list[i]!,
            b = list[i + 1]!;
          if (
            a.type === 'text' &&
            b.type === 'text' &&
            same({ ...a, text: '' }, { ...b, text: '' })
          ) {
            this.apply({ kind: 'joinText', leftId: this.id(a), rightId: this.id(b) });
            changed = true;
            i--;
          }
        }
      }
      if (!changed) return;
    }
    fail('NORMALIZATION_LIMIT');
  }
}
