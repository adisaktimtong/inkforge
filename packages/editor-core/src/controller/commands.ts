import type { Mark } from '../index.js';
import type {
  ControllerCommand,
  ModelPosition,
  ModelSelection,
  SegmentationPort,
} from './types.js';
import {
  Draft,
  blockFor,
  checkedMarks,
  children,
  coordinates,
  fail,
  legalTextOffset,
  ordered,
  parentOf,
  positionOffset,
  same,
  textBlock,
  type RNode,
} from './model.js';
const caret = (position: ModelPosition): ModelSelection => ({
  anchor: { ...position },
  head: { ...position },
});
function inlinePosition(d: Draft, p: ModelPosition): ModelPosition {
  const n = d.node(p.nodeId);
  if (['text', 'paragraph', 'heading', 'link'].includes(n.type)) return p;
  const list = children(n);
  if (!list.length && ['document', 'list-item'].includes(n.type)) {
    const value = d.value({ type: 'paragraph', children: [] });
    d.apply({ kind: 'insert', parentId: p.nodeId, index: 0, value });
    return { nodeId: value.identities[0]!, offset: 0, affinity: p.affinity };
  }
  const before = p.offset > 0,
    pickBefore = (p.affinity === 'backward' && before) || p.offset === list.length;
  let selected = list[pickBefore ? p.offset - 1 : p.offset];
  if (!selected) fail('UNSUPPORTED_CONTAINER_POSITION');
  while (!textBlock(selected)) {
    const nested = children(selected);
    selected = pickBefore ? nested.at(-1) : nested[0];
    if (!selected) fail('UNSUPPORTED_CONTAINER_POSITION');
  }
  return {
    nodeId: d.id(selected),
    offset: pickBefore ? children(selected).length : 0,
    affinity: p.affinity,
  };
}
function boundary(d: Draft, position: ModelPosition): { parentId: string; index: number } {
  const p = inlinePosition(d, position),
    node = d.node(p.nodeId);
  if (node.type !== 'text') return { parentId: p.nodeId, index: p.offset };
  const parent = parentOf(d.tree, p.nodeId)!;
  if (p.offset === 0) return { parentId: parent.id, index: parent.index };
  if (p.offset === node.text!.length) return { parentId: parent.id, index: parent.index + 1 };
  d.apply({ kind: 'splitText', id: p.nodeId, offset: p.offset, rightId: d.allocate() });
  return { parentId: parent.id, index: parent.index + 1 };
}
function marksAt(d: Draft, p: ModelPosition): readonly Mark[] {
  let n = d.node(p.nodeId);
  if (n.type === 'text') return n.marks ?? [];
  const list = children(n);
  n = list[Math.max(0, Math.min(list.length - 1, p.offset - Number(p.offset > 0)))]!;
  while (n && n.type !== 'text') n = children(n).at(-1)!;
  return n?.marks ?? [];
}
function deleteRange(d: Draft, range: ModelSelection): ModelPosition {
  const original = ordered(d.tree, range);
  if (original.from === original.to) return inlinePosition(d, original.start);
  const start = inlinePosition(d, original.start),
    end = inlinePosition(d, original.end);
  const startBlock = blockFor(d.tree, start),
    endBlock = blockFor(d.tree, end);
  if (startBlock.id !== endBlock.id) {
    const a = parentOf(d.tree, startBlock.id),
      b = parentOf(d.tree, endBlock.id);
    if (
      !a ||
      !b ||
      a.id !== b.id ||
      a.index >= b.index ||
      children(a.node)
        .slice(a.index, b.index + 1)
        .some((n) => !textBlock(n)) ||
      !same(
        { className: startBlock.node.className, style: startBlock.node.style },
        { className: endBlock.node.className, style: endBlock.node.style },
      )
    )
      fail('UNSUPPORTED_CROSS_BLOCK_RANGE');
    deleteRange(d, {
      anchor: start,
      head: {
        nodeId: startBlock.id,
        offset: children(startBlock.node).length,
        affinity: 'backward',
      },
    });
    deleteRange(d, { anchor: { nodeId: endBlock.id, offset: 0, affinity: 'forward' }, head: end });
    for (let index = b.index - 1; index > a.index; index--)
      d.apply({
        kind: 'remove',
        parentId: a.id,
        index,
        fallback: {
          nodeId: startBlock.id,
          offset: children(startBlock.node).length,
          affinity: 'forward',
        },
      });
    joinBlocks(d, startBlock.id, endBlock.id);
    return d.selection!.anchor;
  }
  const from = positionOffset(d.tree, start),
    to = positionOffset(d.tree, end),
    coords = coordinates(d.tree);
  d.selection = caret(start);
  const targets = [...d.tree.nodes].filter(([, n]) => ['text', 'hard-break'].includes(n.type));
  for (const [id, n] of targets) {
    const c = coords.get(id)!;
    if (n.type === 'text') {
      const a = Math.max(0, from - c.start),
        b = Math.min(n.text!.length, to - c.start);
      if (a < b) d.apply({ kind: 'deleteText', id, offset: a, length: b - a });
    } else if (c.start >= from && c.end <= to) {
      const parent = parentOf(d.tree, id)!;
      d.apply({ kind: 'remove', parentId: parent.id, index: parent.index });
    }
  }
  return d.selection!.anchor;
}
function insertText(
  d: Draft,
  range: ModelSelection,
  text: string,
  desired: readonly Mark[] | null,
): void {
  if (typeof text !== 'string' || !text.isWellFormed()) fail('INVALID_TEXT');
  const p = deleteRange(d, range),
    node = d.node(p.nodeId),
    chosen = desired ?? marksAt(d, p);
  if (!text.length) {
    d.selection = caret(p);
    return;
  }
  if (node.type === 'text' && same(node.marks ?? [], chosen)) {
    d.apply({ kind: 'insertText', id: p.nodeId, offset: p.offset, text });
    d.selection = caret({ nodeId: p.nodeId, offset: p.offset + text.length, affinity: 'forward' });
  } else {
    const target = boundary(d, p),
      value = d.value({ type: 'text', text, ...(chosen.length ? { marks: [...chosen] } : {}) });
    d.apply({ kind: 'insert', parentId: target.parentId, index: target.index, value });
    d.selection = caret({ nodeId: value.identities[0]!, offset: text.length, affinity: 'forward' });
  }
}
function changeMark(
  d: Draft,
  range: ModelSelection,
  mark: Mark,
  set: boolean,
  current: readonly Mark[] | null,
): readonly Mark[] | null {
  checkedMarks([mark]);
  const r = ordered(d.tree, range);
  if (r.from === r.to) {
    const existing = current ?? marksAt(d, r.start);
    return checkedMarks(
      set ? [...new Set([...existing, mark])] : existing.filter((m) => m !== mark),
    );
  }
  const coords = coordinates(d.tree),
    targets = [...d.tree.nodes]
      .filter(([, n]) => n.type === 'text')
      .map(([id, n]) => ({
        id,
        node: n,
        start: Math.max(0, r.from - coords.get(id)!.start),
        end: Math.min(n.text!.length, r.to - coords.get(id)!.start),
      }))
      .filter((t) => t.start < t.end);
  for (const t of targets) {
    let id = t.id;
    if (t.end < t.node.text!.length)
      d.apply({ kind: 'splitText', id, offset: t.end, rightId: d.allocate() });
    if (t.start > 0) {
      const rightId = d.allocate();
      d.apply({ kind: 'splitText', id, offset: t.start, rightId });
      id = rightId;
    }
    const old = d.node(id).marks ?? [],
      next = checkedMarks(set ? [...new Set([...old, mark])] : old.filter((m) => m !== mark));
    if (!same(old, next))
      d.apply({ kind: 'patch', id, values: { marks: next.length ? next : undefined } });
  }
  return current;
}
function joinBlocks(d: Draft, leftId: string, rightId: string) {
  const left = d.node(leftId),
    right = d.node(rightId),
    lp = parentOf(d.tree, leftId),
    rp = parentOf(d.tree, rightId);
  if (
    !lp ||
    !rp ||
    lp.id !== rp.id ||
    rp.index !== lp.index + 1 ||
    !textBlock(left) ||
    !textBlock(right) ||
    !same(
      { className: left.className, style: left.style },
      { className: right.className, style: right.style },
    )
  )
    fail('INCOMPATIBLE_BLOCK_JOIN');
  const index = children(left).length,
    fallback = { nodeId: leftId, offset: index, affinity: 'forward' as const };
  d.apply({
    kind: 'moveChildren',
    from: rightId,
    to: leftId,
    start: 0,
    count: children(right).length,
    index,
  });
  d.apply({ kind: 'remove', parentId: rp.id, index: rp.index, fallback });
  d.selection = caret(fallback);
}
function splitBlock(d: Draft, at: ModelPosition) {
  const p = inlinePosition(d, at),
    block = blockFor(d.tree, p),
    parent = parentOf(d.tree, block.id);
  if (!parent) fail('INVALID_BLOCK_SPLIT');
  let target = boundary(d, p);
  if (target.parentId !== block.id) {
    const link = d.node(target.parentId),
      owner = parentOf(d.tree, target.parentId);
    if (link.type !== 'link' || owner?.id !== block.id) fail('UNSUPPORTED_LINK_SPLIT');
    if (target.index === 0) target = { parentId: block.id, index: owner.index };
    else if (target.index === children(link).length)
      target = { parentId: block.id, index: owner.index + 1 };
    else {
      const rightLink = d.value({ ...link, children: [] });
      d.apply({ kind: 'insert', parentId: block.id, index: owner.index + 1, value: rightLink });
      d.apply({
        kind: 'moveChildren',
        from: target.parentId,
        to: rightLink.identities[0]!,
        start: target.index,
        count: children(link).length - target.index,
        index: 0,
      });
      target = { parentId: block.id, index: owner.index + 1 };
    }
  }
  const atEnd = target.index === children(block.node).length;
  const right: RNode = { ...block.node, children: [] };
  if (right.type === 'heading' && atEnd) {
    right.type = 'paragraph';
    delete right.level;
  }
  const value = d.value(right),
    rightId = value.identities[0]!;
  d.apply({ kind: 'insert', parentId: parent.id, index: parent.index + 1, value });
  d.apply({
    kind: 'moveChildren',
    from: block.id,
    to: rightId,
    start: target.index,
    count: children(block.node).length - target.index,
    index: 0,
  });
  d.selection = caret({ nodeId: rightId, offset: 0, affinity: 'forward' });
}
function pointAt(
  d: Draft,
  blockId: string,
  offset: number,
  affinity: ModelPosition['affinity'],
): ModelPosition {
  let remaining = offset;
  function find(n: RNode): ModelPosition | null {
    if (n.type === 'text') {
      if (remaining <= n.text!.length) return { nodeId: d.id(n), offset: remaining, affinity };
      remaining -= n.text!.length;
    } else if (n.type === 'hard-break') {
      const parent = parentOf(d.tree, d.id(n))!;
      if (remaining <= 1) return { nodeId: parent.id, offset: parent.index + remaining, affinity };
      remaining--;
    } else
      for (const child of children(n)) {
        const p = find(child);
        if (p) return p;
      }
    return null;
  }
  return (
    find(d.node(blockId)) ?? { nodeId: blockId, offset: children(d.node(blockId)).length, affinity }
  );
}
function deleteUnit(
  d: Draft,
  command: Extract<ControllerCommand, { kind: 'deleteBackward' | 'deleteForward' }>,
  segmentation?: SegmentationPort,
) {
  const range = ordered(d.tree, command.range);
  if (range.from !== range.to) {
    d.selection = caret(deleteRange(d, command.range));
    return;
  }
  const p = inlinePosition(d, range.start),
    block = blockFor(d.tree, p),
    coords = coordinates(d.tree);
  const text = (function content(n: RNode): string {
    return n.type === 'text'
      ? n.text!
      : n.type === 'hard-break'
        ? '\n'
        : children(n).map(content).join('');
  })(block.node);
  const offset = positionOffset(d.tree, p) - coords.get(block.id)!.start,
    backward = command.kind === 'deleteBackward';
  if (offset === (backward ? 0 : text.length)) {
    const parent = parentOf(d.tree, block.id)!;
    const sibling = children(parent.node)[parent.index + (backward ? -1 : 1)];
    if (!sibling) return;
    joinBlocks(d, backward ? d.id(sibling) : block.id, backward ? block.id : d.id(sibling));
    return;
  }
  if (!['grapheme', 'word'].includes(command.unit)) fail('UNSUPPORTED_DELETE_UNIT');
  if (!segmentation) fail('SEGMENTATION_UNAVAILABLE');
  let boundaries: readonly number[];
  try {
    const result: unknown = segmentation.boundaries(text, command.unit);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(result).catch(() => {});
    if (!Array.isArray(result)) fail('INVALID_SEGMENTATION');
    boundaries = result;
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_SEGMENTATION') throw error;
    fail('SEGMENTATION_FAILED');
  }
  if (
    !Array.isArray(boundaries) ||
    boundaries.length > text.length + 1 ||
    boundaries[0] !== 0 ||
    boundaries.at(-1) !== text.length ||
    boundaries.some((n, i) => !legalTextOffset(text, n) || (i > 0 && n <= boundaries[i - 1]!))
  )
    fail('INVALID_SEGMENTATION');
  const i = boundaries.indexOf(offset);
  if (i < 0) fail('SEGMENTATION_CARET_BOUNDARY');
  const a = boundaries[backward ? i - 1 : i]!,
    b = boundaries[backward ? i : i + 1]!;
  d.selection = caret(
    deleteRange(d, {
      anchor: pointAt(d, block.id, a, 'backward'),
      head: pointAt(d, block.id, b, 'forward'),
    }),
  );
}
export function compile(
  command: ControllerCommand,
  d: Draft,
  storedMarks: readonly Mark[] | null,
  segmentation?: SegmentationPort,
): { storedMarks: readonly Mark[] | null; group: string | null } {
  const inputSelection = d.selection;
  let nextMarks = storedMarks,
    group: string | null = null;
  if (command.kind === 'insertText') {
    const r = ordered(d.tree, command.range),
      chosen = command.marks === undefined ? storedMarks : checkedMarks(command.marks);
    insertText(d, command.range, command.text, chosen);
    if (command.typing === true && r.from === r.to && same(command.range, inputSelection))
      group = 'typing:' + JSON.stringify(chosen ?? marksAt(d, d.selection!.anchor));
  } else if (command.kind === 'insertPlainText') {
    if (typeof command.text !== 'string' || !command.text.isWellFormed()) fail('INVALID_TEXT');
    const parts = command.text.replace(/\r\n?/g, '\n').split('\n');
    insertText(d, command.range, parts[0]!, storedMarks);
    for (const part of parts.slice(1)) {
      const target = boundary(d, d.selection!.anchor),
        value = d.value({ type: 'hard-break' });
      d.apply({ kind: 'insert', parentId: target.parentId, index: target.index, value });
      d.selection = caret({
        nodeId: target.parentId,
        offset: target.index + 1,
        affinity: 'forward',
      });
      insertText(d, d.selection, part, storedMarks);
    }
  } else if (command.kind === 'deleteRange') d.selection = caret(deleteRange(d, command.range));
  else if (command.kind === 'deleteBackward' || command.kind === 'deleteForward') {
    const r = ordered(d.tree, command.range),
      inherited = marksAt(d, r.start);
    deleteUnit(d, command, segmentation);
    if (r.from === r.to && same(command.range, inputSelection))
      group = command.kind + ':' + command.unit + ':' + JSON.stringify(inherited);
  } else if (command.kind === 'setMark' || command.kind === 'clearMark')
    nextMarks = changeMark(d, command.range, command.mark, command.kind === 'setMark', storedMarks);
  else if (command.kind === 'setStoredMarks')
    nextMarks = command.marks === null ? null : checkedMarks(command.marks);
  else if (command.kind === 'setBlockType') {
    if (
      !Array.isArray(command.blocks) ||
      !command.blocks.length ||
      new Set(command.blocks).size !== command.blocks.length ||
      !['paragraph', 'heading'].includes(command.type) ||
      (command.type === 'heading' &&
        (!Number.isInteger(command.level) || command.level! < 1 || command.level! > 6)) ||
      (command.type === 'paragraph' && command.level !== undefined)
    )
      fail('INVALID_BLOCK_COMMAND');
    for (const id of command.blocks) {
      const node = d.node(id);
      if (!textBlock(node)) fail('INVALID_TEXTBLOCK');
      if (node.type !== command.type || node.level !== command.level)
        d.apply({
          kind: 'patch',
          id,
          values: {
            type: command.type,
            level: command.type === 'heading' ? command.level : undefined,
          },
        });
    }
  } else if (command.kind === 'insertHardBreak') {
    const p = deleteRange(d, command.range),
      target = boundary(d, p),
      value = d.value({ type: 'hard-break' });
    d.apply({ kind: 'insert', parentId: target.parentId, index: target.index, value });
    d.selection = caret({ nodeId: target.parentId, offset: target.index + 1, affinity: 'forward' });
  } else if (command.kind === 'splitBlock')
    splitBlock(d, command.range === undefined ? command.at : deleteRange(d, command.range));
  else if (command.kind === 'joinBlocks') joinBlocks(d, command.leftBlockId, command.rightBlockId);
  else fail('UNSUPPORTED_COMMAND');
  return { storedMarks: nextMarks, group };
}
