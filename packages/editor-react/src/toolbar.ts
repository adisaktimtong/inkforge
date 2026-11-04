import { formatBlocks, formatList, blockStyle } from './formatting.js';
import { createElement, useEffect, useRef, useState, type RefObject } from 'react';

// Private bridge for the DOM-owned adapter, not a core command/transaction API.
const actions = [
  ['Bold', 'B', 'bold'],
  ['Italic', 'I', 'italic'],
  ['Underline', 'U', 'underline'],
  ['Paragraph', '¶', 'formatBlock', 'p'],
  ['Heading 1', 'H1', 'formatBlock', 'h1'],
  ['Heading 2', 'H2', 'formatBlock', 'h2'],
  ['Heading 3', 'H3', 'formatBlock', 'h3'],
  ['Bulleted list', '• List', 'insertUnorderedList'],
  ['Numbered list', '1. List', 'insertOrderedList'],
] as const;

export function useToolbar(
  editor: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  locked: boolean,
  commit: () => void,
  unavailable: () => boolean,
  onLeave: () => void,
) {
  const container = useRef<HTMLDivElement>(null);
  const running = useRef(false);
  const invalidated = useRef<{
    range: Range;
    start: Node;
    startOffset: number;
    end: Node;
    endOffset: number;
  } | null>(null);
  const toolbarSelection = useRef(false);
  const bookmark = useRef<Range | null>(null);
  const typing = useRef<{ range: Range; marks: boolean[] } | null>(null);
  const [pressed, setPressed] = useState<boolean[]>([]);
  const [tabStop, setTabStop] = useState(0);
  const latest = useRef({ locked, commit, unavailable, onLeave });
  latest.current = { locked, commit, unavailable, onLeave };

  const owns = (range: Range) =>
    !!editor.current?.contains(range.startContainer) &&
    !!editor.current?.contains(range.endContainer);
  const clear = () => {
    bookmark.current = null;
    typing.current = null;
    toolbarSelection.current = false;
    setPressed((previous) => (previous.length ? [] : previous));
  };
  const refresh = () => {
    if (!enabled) return;
    const doc = editor.current?.ownerDocument;
    const selection = doc?.getSelection();
    if (!doc || !selection?.rangeCount) {
      // WebKit hides the native range while toolbar buttons own keyboard focus.
      // Retain only the bookmark handed over by that editor-to-toolbar transition.
      if (toolbarSelection.current && container.current?.contains(doc?.activeElement ?? null))
        return;
      clear();
      return;
    }
    const range = selection.getRangeAt(0);
    if (
      !owns(range) ||
      (!editor.current?.contains(doc.activeElement) &&
        !container.current?.contains(doc.activeElement))
    ) {
      clear();
      return;
    }
    // Reject the exact range left by external HTML remapping. A fresh owned
    // Selection range (including a host-created range after ref.focus()) is safe.
    const stale = invalidated.current;
    if (
      stale?.range === range &&
      stale.start === range.startContainer &&
      stale.startOffset === range.startOffset &&
      stale.end === range.endContainer &&
      stale.endOffset === range.endOffset
    )
      return;
    invalidated.current = null;
    bookmark.current = range.cloneRange();
    const block = blockStyle(editor.current!, range);
    const next = actions.map((action) =>
      action[2] === 'formatBlock' ? block === action[3] : doc.queryCommandState(action[2]),
    );
    setPressed((previous) =>
      previous.length === next.length && previous.every((value, index) => value === next[index])
        ? previous
        : next,
    );
  };
  const handlers = useRef({ refresh });
  handlers.current = { refresh };
  useEffect(() => {
    if (!enabled) return;
    const doc = editor.current?.ownerDocument;
    const update = () => handlers.current.refresh();
    doc?.addEventListener('selectionchange', update);
    return () => doc?.removeEventListener('selectionchange', update);
  }, [editor, enabled]);

  const run = (index: number) => {
    refresh();
    const root = editor.current;
    const range = bookmark.current;
    if (latest.current.locked || latest.current.unavailable() || !root || !range || !owns(range))
      return;
    const doc = root.ownerDocument;
    const selection = doc.getSelection();
    if (!selection) return;
    const focused = doc.activeElement;
    root.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(range);
    const action = actions[index]!;
    running.current = true;
    const handled =
      action[2] === 'formatBlock'
        ? formatBlocks(root, range, action[3])
        : action[2] === 'insertUnorderedList' || action[2] === 'insertOrderedList'
          ? formatList(root, range, action[2] === 'insertOrderedList')
          : false;
    if (!handled)
      doc.execCommand(action[2], false, action[2] === 'formatBlock' ? action[3] : undefined);
    else {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    running.current = false;
    latest.current.commit();
    refresh();
    typing.current = range.collapsed
      ? {
          range: selection.getRangeAt(0).cloneRange(),
          marks: actions.slice(0, 3).map((action) => doc.queryCommandState(action[2])),
        }
      : null;
    if (focused && container.current?.contains(focused))
      (focused as HTMLElement).focus({ preventScroll: true });
  };

  return {
    container,
    running,
    refresh,
    activate() {
      invalidated.current = null;
      refresh();
    },
    restore() {
      const range = bookmark.current;
      if (latest.current.locked || latest.current.unavailable() || !range || !owns(range)) return;
      const doc = editor.current!.ownerDocument;
      const selection = doc.getSelection();
      if (!selection) return;
      const current = selection.rangeCount ? selection.getRangeAt(0) : null;
      if (
        !current ||
        current.compareBoundaryPoints(0, range) ||
        current.compareBoundaryPoints(2, range)
      ) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      const pending = typing.current;
      if (range.collapsed && pending && !range.compareBoundaryPoints(0, pending.range)) {
        actions.slice(0, 3).forEach((action, index) => {
          if (doc.queryCommandState(action[2]) !== pending.marks[index]) doc.execCommand(action[2]);
        });
      }
    },
    invalidate() {
      const selection = editor.current?.ownerDocument.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      invalidated.current = range
        ? {
            range,
            start: range.startContainer,
            startOffset: range.startOffset,
            end: range.endContainer,
            endOffset: range.endOffset,
          }
        : null;
      clear();
    },
    view: createElement(
      'div',
      {
        key: 'toolbar',
        ref: container,
        role: 'toolbar',
        'aria-label': 'Text formatting',
        'aria-orientation': 'horizontal',
        className: 'inkforge-toolbar',
        onFocus(event) {
          if (editor.current?.contains(event.relatedTarget as Node | null) && bookmark.current)
            toolbarSelection.current = true;
        },
        onBlur(event) {
          const next = event.relatedTarget as Node | null;
          if (!container.current?.contains(next) && !editor.current?.contains(next)) {
            toolbarSelection.current = false;
            latest.current.onLeave();
          }
        },
        onPointerDown(event) {
          // Keep native selection and pending typing marks for mouse and touch.
          if (event.button === 0) {
            refresh();
            event.preventDefault();
          }
        },
        onKeyDown(event) {
          const buttons = Array.from(container.current?.querySelectorAll('button') ?? []);
          const current = buttons.indexOf(event.target as HTMLButtonElement);
          if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) %
                  buttons.length;
          setTabStop(next);
          buttons[next]?.focus();
        },
      },
      actions.map((action, index) =>
        createElement(
          'button',
          {
            key: action[0],
            type: 'button',
            'aria-label': action[0],
            title: action[0],
            'aria-pressed': pressed[index] ?? false,
            disabled: locked,
            tabIndex: index === tabStop ? 0 : -1,
            className: index === 3 || index === 7 ? 'inkforge-toolbar-group' : undefined,
            onClick: () => run(index),
          },
          createElement('span', { 'aria-hidden': true }, action[1]),
        ),
      ),
    ),
  };
}
