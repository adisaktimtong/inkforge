import { parseHtml, serializeHtml } from '@inkforge/editor-html';
import {
  ancestor,
  editInline,
  alignBlocks,
  markActive,
  alignmentState,
  unlinkAnchor,
  type InlineEdit,
} from './inline.js';
import { formatBlocks, formatList, blockStyle, preserve } from './formatting.js';
import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// Private bridge for the DOM-owned adapter, not a core command/transaction API.
const actions = [
  ['Bold', 'B', 'bold'],
  ['Italic', 'I', 'italic'],
  ['Underline', 'U', 'underline'],
  ['Strikethrough', 'S', 'strikeThrough'],
  ['Inline code', '</>', 'code'],
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
  const [popup, setPopup] = useState<string | null>(null);
  const [panelVertical, setPanelVertical] = useState({ top: 0, height: 420 });
  const [currentAlignment, setAlignment] = useState('');
  const composition = useRef<{
    root: HTMLElement;
    start: number;
    suffix: number;
    edits: InlineEdit[];
  } | null>(null);
  const [panelLeft, setPanelLeft] = useState(0);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const popupRange = useRef<{ range: Range; html: string } | null>(null);
  const pending = useRef<InlineEdit[]>([]);
  const pendingCaret = useRef<Range | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [pressed, setPressed] = useState<boolean[]>([]);
  const [tabStop, setTabStop] = useState(0);
  const latest = useRef({ locked, commit, unavailable, onLeave });
  latest.current = { locked, commit, unavailable, onLeave };

  const owns = (range: Range) =>
    !!editor.current?.contains(range.startContainer) &&
    !!editor.current?.contains(range.endContainer);
  const close = (focus = false) => {
    setPopup(null);
    popupRange.current = null;
    setError('');
    if (focus) trigger.current?.focus();
  };
  const clear = () => {
    close();
    pending.current = [];
    composition.current = null;
    pendingCaret.current = null;
    bookmark.current = null;
    typing.current = null;
    toolbarSelection.current = false;
    setAlignment('');
    setPressed((previous) => (previous.length ? [] : previous));
  };
  const refresh = () => {
    if (!enabled) return;
    if (composition.current) return;
    const doc = editor.current?.ownerDocument;
    const selection = doc?.getSelection();
    const nativeRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const popupOwns =
      nativeRange &&
      !!container.current?.contains(nativeRange.startContainer) &&
      !!container.current?.contains(nativeRange.endContainer);
    // Input selection belongs to the popup; an actual foreign document Range never does.
    if (nativeRange && !owns(nativeRange) && !popupOwns) {
      clear();
      return;
    }
    if (
      popupRange.current &&
      owns(popupRange.current.range) &&
      popupRange.current.html === editor.current?.innerHTML
    )
      return;
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
      !owns(range) &&
      popupOwns &&
      toolbarSelection.current &&
      container.current?.contains(doc.activeElement) &&
      bookmark.current &&
      owns(bookmark.current)
    )
      return;
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
    if (
      pendingCaret.current &&
      (range.compareBoundaryPoints(0, pendingCaret.current) ||
        range.compareBoundaryPoints(2, pendingCaret.current))
    ) {
      pending.current = [];
      pendingCaret.current = null;
    }
    bookmark.current = range.cloneRange();
    const block = blockStyle(editor.current!, range);
    const next = actions.map((action) =>
      action[2] === 'formatBlock'
        ? block === action[3]
        : action[2] === 'code' || action[2] === 'strikeThrough'
          ? (pending.current.find((item) => item.mark === (action[2] === 'code' ? 'code' : 's'))
              ?.enabled ??
            markActive(editor.current!, range, action[2] === 'code' ? 'code' : 's,strike'))
          : doc.queryCommandState(action[2]),
    );
    setAlignment(alignmentState(editor.current!, range));
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

  useEffect(() => {
    if (locked || !enabled) close();
  }, [locked, enabled]);
  useClientLayoutEffect(() => {
    if (!popup) return;
    const doc = editor.current?.ownerDocument;
    const dismiss = (event: Event) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    doc?.addEventListener('pointerdown', dismiss);
    const position = () => {
      const bar = container.current;
      const panel = bar?.querySelector<HTMLElement>('[data-panel]');
      const view = doc?.defaultView;
      if (!bar || !panel || !view) return;
      const rect = bar.getBoundingClientRect();
      const below = Math.max(0, view.innerHeight - rect.bottom - 12);
      const above = Math.max(0, rect.top - 12);
      const desired = Math.min(420, panel.scrollHeight + 2);
      const height = Math.min(420, Math.max(below, above));
      setPanelVertical({
        top: below >= desired || below >= above ? rect.height + 5 : -Math.min(desired, above) - 5,
        height,
      });
    };
    position();
    doc?.defaultView?.addEventListener('resize', position);
    doc?.addEventListener('scroll', position, true);
    container.current
      ?.querySelector<HTMLElement>('[data-panel] input, [data-panel] button')
      ?.focus();
    return () => {
      doc?.removeEventListener('pointerdown', dismiss);
      doc?.defaultView?.removeEventListener('resize', position);
      doc?.removeEventListener('scroll', position, true);
    };
  }, [popup, error]);
  const apply = (operation: (root: HTMLDivElement, range: Range) => void, captured = false) => {
    refresh();
    const root = editor.current;
    const snapshot = popupRange.current;
    const range = captured ? snapshot?.range : bookmark.current;
    if (
      latest.current.locked ||
      latest.current.unavailable() ||
      !root ||
      !range ||
      !owns(range) ||
      (captured && snapshot?.html !== root.innerHTML)
    ) {
      close();
      return;
    }
    const selection = root.ownerDocument.getSelection();
    if (!selection) return;
    const nativeMarks =
      range.collapsed && typing.current && !range.compareBoundaryPoints(0, typing.current.range)
        ? typing.current.marks
        : actions.slice(0, 3).map((action) => root.ownerDocument.queryCommandState(action[2]));
    running.current = true;
    root.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(range);
    operation(root, range);
    selection.removeAllRanges();
    selection.addRange(range);
    if (range.collapsed) {
      actions.slice(0, 3).forEach((action, index) => {
        if (root.ownerDocument.queryCommandState(action[2]) !== nativeMarks[index])
          root.ownerDocument.execCommand(action[2]);
      });
      typing.current = { range: range.cloneRange(), marks: nativeMarks };
    }
    running.current = false;
    close();
    latest.current.commit();
    refresh();
  };
  const inline = (edit: InlineEdit, captured = false) =>
    apply((root, range) => {
      if (range.collapsed) {
        if (edit.mark) {
          const previous = pending.current.find((item) => item.mark === edit.mark);
          edit = {
            ...edit,
            enabled: !(
              previous?.enabled ??
              !!ancestor(range.startContainer, root, edit.mark === 's' ? 's,strike' : 'code')
            ),
          };
        }
        pending.current = pending.current.filter(
          (item) =>
            !(edit.mark
              ? item.mark === edit.mark
              : edit.property
                ? item.property === edit.property
                : edit.clear),
        );
        pending.current.push(edit);
        pendingCaret.current = range.cloneRange();
      } else editInline(root, range, edit);
    }, captured);
  const open = (name: string, button: HTMLElement) => {
    refresh();
    const range = bookmark.current;
    if (!range || !owns(range) || latest.current.unavailable()) return;
    trigger.current = button;
    setPanelLeft(
      Math.min(button.offsetLeft, Math.max(0, (container.current?.clientWidth ?? 292) - 292)),
    );
    if (popup === name) {
      close(true);
      return;
    }
    popupRange.current = { range: range.cloneRange(), html: editor.current!.innerHTML };
    toolbarSelection.current = true;
    setInput(
      name === 'Link'
        ? (ancestor(range.startContainer, editor.current!, 'a')?.getAttribute('href') ?? '')
        : '#2563eb',
    );
    setError('');
    setPopup(name);
  };
  const applyLink = () => {
    const escaped = input
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    const safe = parseHtml('<p><a href="' + escaped + '">link</a></p>');
    const html = serializeHtml(safe.document);
    if (!input.trim() || safe.diagnostics.length || !html.includes('<a href=')) {
      setError('Enter a safe URL (https://, mailto:, or a relative URL).');
      return;
    }
    const template = editor.current!.ownerDocument.createElement('template');
    template.innerHTML = html;
    const href = template.content.querySelector('a')!.getAttribute('href')!;
    apply((root, range) => {
      const anchor = ancestor(range.startContainer, root, 'a');
      if (anchor && range.collapsed) anchor.setAttribute('href', href);
      else {
        const inserted = range.collapsed;
        if (inserted) {
          const text = root.ownerDocument.createTextNode(input.trim());
          range.insertNode(text);
          range.selectNodeContents(text);
        }
        editInline(root, range, { href });
        if (inserted) range.collapse(false);
      }
    }, true);
  };
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
    if (action[2] === 'code' || action[2] === 'strikeThrough') {
      running.current = false;
      inline({ mark: action[2] === 'code' ? 'code' : 's' });
      return;
    }
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
    startComposition() {
      const root = editor.current;
      const selection = root?.ownerDocument.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (!root || !range || !owns(range)) return;
      const offset = (node: Node, index: number) => {
        const prefix = root.ownerDocument.createRange();
        prefix.selectNodeContents(root);
        prefix.setEnd(node, index);
        return prefix.toString().length;
      };
      composition.current = {
        root,
        start: offset(range.startContainer, range.startOffset),
        suffix: (root.textContent?.length ?? 0) - offset(range.endContainer, range.endOffset),
        edits: pending.current.map((edit) => ({ ...edit })),
      };
    },
    finishComposition() {
      const snapshot = composition.current;
      composition.current = null;
      const root = editor.current;
      if (
        !snapshot ||
        !root ||
        snapshot.root !== root ||
        latest.current.unavailable() ||
        !snapshot.edits.length
      )
        return;
      const end = (root.textContent?.length ?? 0) - snapshot.suffix;
      if (end <= snapshot.start) return;
      const range = root.ownerDocument.createRange();
      const point = (offset: number): [Node, number] => {
        const walker = root.ownerDocument.createTreeWalker(root, 4);
        let node: Node | null;
        while ((node = walker.nextNode())) {
          const length = node.textContent?.length ?? 0;
          if (offset <= length) return [node, offset];
          offset -= length;
        }
        return [root, root.childNodes.length];
      };
      range.setStart(...point(snapshot.start));
      range.setEnd(...point(end));
      for (const edit of snapshot.edits) editInline(root, range, edit);
      range.collapse(false);
      const selection = root.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      pendingCaret.current = range.cloneRange();
    },
    beforeInput(event: InputEvent) {
      if (
        event.defaultPrevented ||
        running.current ||
        !pending.current.length ||
        event.inputType !== 'insertText' ||
        !event.data ||
        latest.current.unavailable()
      )
        return false;
      const root = editor.current;
      const selection = root?.ownerDocument.getSelection();
      if (!root || !selection?.rangeCount || !owns(selection.getRangeAt(0))) return false;
      event.preventDefault();
      running.current = true;
      try {
        let range = selection.getRangeAt(0);
        // Native insertion retains the browser's pending bold/italic/underline state.
        if (
          root.ownerDocument.execCommand('insertText', false, event.data) &&
          selection.focusNode?.nodeType === 3
        ) {
          range = selection.getRangeAt(0).cloneRange();
          range.setStart(
            selection.focusNode,
            Math.max(0, selection.focusOffset - event.data.length),
          );
        } else {
          range.deleteContents();
          const text = root.ownerDocument.createTextNode(event.data);
          range.insertNode(text);
          range.selectNodeContents(text);
        }
        for (const edit of pending.current) editInline(root, range, edit);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        pendingCaret.current = range.cloneRange();
      } finally {
        running.current = false;
      }
      latest.current.commit();
      refresh();
      return true;
    },
    refresh,
    activate(pointer = false) {
      if (pointer || popupRange.current) close();
      if (pointer) {
        pending.current = [];
        pendingCaret.current = null;
      }
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
          // OS color pickers can temporarily remove document focus without a new target.
          if (!next && popupRange.current) return;
          if (!container.current?.contains(next) && !editor.current?.contains(next)) {
            toolbarSelection.current = false;
            close();
            latest.current.onLeave();
          }
        },
        onPointerDown(event) {
          // Keep native selection and pending typing marks for mouse and touch.
          if (event.button === 0 && (event.target as Element).closest('button')) {
            if (!(event.target as Element).closest('[data-panel]')) refresh();
            event.preventDefault();
          }
        },
        onKeyDown(event) {
          const buttons = Array.from(
            container.current?.querySelectorAll<HTMLButtonElement>('button[data-tool]') ?? [],
          );
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
      ...(() => {
        const button = (
          label: string,
          index: number,
          click: (target: HTMLElement) => void,
          active = false,
          text?: string,
        ) =>
          createElement(
            'button',
            {
              key: label,
              type: 'button',
              'data-tool': true,
              'data-group-start':
                [
                  'Text style',
                  'Bulleted list',
                  'Align left',
                  'Text color',
                  'Clear formatting',
                ].includes(label) || undefined,
              'aria-label': label,
              'aria-pressed': active,
              'aria-haspopup': ['Text style', 'Text color', 'Highlight', 'Link'].includes(label)
                ? 'dialog'
                : undefined,
              'aria-expanded': ['Text style', 'Text color', 'Highlight', 'Link'].includes(label)
                ? popup === label
                : undefined,
              disabled: locked,
              tabIndex: index === tabStop ? 0 : -1,
              onClick: (event) => click(event.currentTarget),
              onPointerEnter: (event) => positionTooltip(event.currentTarget),
              onFocus: (event) => positionTooltip(event.currentTarget),
            },
            text
              ? createElement('span', null, text)
              : createElement(
                  'svg',
                  {
                    width: 20,
                    height: 20,
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 1.7,
                    'aria-hidden': true,
                  },
                  createElement('path', { d: icon(label) }),
                ),
            createElement('span', { className: 'inkforge-tooltip', role: 'tooltip' }, label),
          );
        const controls: ReactNode[] = [];
        actions.forEach((action, index) => {
          if (index >= 5 && index <= 8) return;
          if (index === 9)
            controls.push(
              button(
                'Text style',
                controls.length,
                (target) => open('Text style', target),
                false,
                actions.slice(5, 9).find((_a, i) => pressed[i + 5])?.[0] ?? 'Paragraph',
              ),
            );
          controls.push(button(action[0], controls.length, () => run(index), pressed[index]));
        });
        for (const alignment of ['Left', 'Center', 'Right', 'Justify'])
          controls.push(
            button(
              'Align ' + alignment.toLowerCase(),
              controls.length,
              () => apply((root, range) => alignBlocks(root, range, alignment.toLowerCase())),
              alignment.toLowerCase() === currentAlignment,
            ),
          );
        for (const name of ['Text color', 'Highlight', 'Link'])
          controls.push(button(name, controls.length, (target) => open(name, target)));
        controls.push(button('Clear formatting', controls.length, () => inline({ clear: true })));
        if (popup)
          controls.push(
            createElement(
              'div',
              {
                key: 'panel',
                'data-panel': true,
                role: 'dialog',
                'aria-label': popup,
                className: 'inkforge-toolbar-panel',
                style: { left: panelLeft, top: panelVertical.top, maxHeight: panelVertical.height },
                onKeyDown(event) {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    close(true);
                  }
                },
              },
              createElement('div', { className: 'inkforge-panel-heading' }, popup),
              popup === 'Text style'
                ? actions.slice(5, 9).map((action, index) =>
                    createElement(
                      'button',
                      {
                        key: action[0],
                        type: 'button',
                        onClick: () =>
                          apply((root, range) => {
                            formatBlocks(root, range, action[3]!);
                          }, true),
                      },
                      action[0],
                    ),
                  )
                : popup === 'Link'
                  ? createElement(
                      'div',
                      null,
                      createElement(
                        'label',
                        null,
                        'URL',
                        createElement('input', {
                          value: input,
                          placeholder: 'https://example.com',
                          onKeyDown: (event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              applyLink();
                            }
                          },
                          onChange: (event) => setInput(event.currentTarget.value),
                          'aria-invalid': !!error,
                        }),
                      ),
                      error && createElement('p', { role: 'alert' }, error),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'inkforge-primary',
                          onClick: applyLink,
                        },
                        'Apply link',
                      ),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: () =>
                            apply((root, range) => {
                              const anchor = ancestor(range.startContainer, root, 'a');
                              if (anchor && range.collapsed)
                                preserve(range, () => unlinkAnchor(anchor));
                              else editInline(root, range, { href: null });
                            }, true),
                        },
                        'Remove link',
                      ),
                    )
                  : createElement(
                      'div',
                      null,
                      createElement(
                        'div',
                        { className: 'inkforge-swatches' },
                        ...[
                          '#111827',
                          '#64748b',
                          '#dc2626',
                          '#ea580c',
                          '#eab308',
                          '#16a34a',
                          '#2563eb',
                          '#9333ea',
                          '#ffffff',
                        ].map((color) =>
                          createElement('button', {
                            key: color,
                            type: 'button',
                            'aria-label': color,
                            style: { backgroundColor: color },
                            onClick: () =>
                              inline(
                                {
                                  property: popup === 'Text color' ? 'color' : 'background-color',
                                  value: color,
                                },
                                true,
                              ),
                          }),
                        ),
                      ),
                      createElement(
                        'label',
                        null,
                        'Custom color',
                        createElement('input', {
                          type: 'color',
                          value: /^#[0-9a-f]{6}$/i.test(input) ? input : '#2563eb',
                          onChange: (event) => setInput(event.currentTarget.value),
                        }),
                      ),
                      createElement('input', {
                        'aria-label': 'Hex color',
                        value: input,
                        onChange: (event) => setInput(event.currentTarget.value),
                      }),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'inkforge-primary',
                          onClick: () => {
                            if (/^#[0-9a-f]{6}$/i.test(input))
                              inline(
                                {
                                  property: popup === 'Text color' ? 'color' : 'background-color',
                                  value: input,
                                },
                                true,
                              );
                          },
                        },
                        'Apply color',
                      ),
                      createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: () =>
                            inline(
                              { property: popup === 'Text color' ? 'color' : 'background-color' },
                              true,
                            ),
                        },
                        'Reset color',
                      ),
                    ),
              createElement('button', { type: 'button', onClick: () => close(true) }, 'Cancel'),
            ),
          );
        return controls;
      })(),
    ),
  };
}

function icon(label: string) {
  const paths: Record<string, string> = {
    Bold: 'M7 4h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z',
    Italic: 'M10 4h10M4 20h10M15 4 9 20',
    Underline: 'M6 4v7a6 6 0 0 0 12 0V4M4 21h16',
    Strikethrough: 'M17 6c-3-4-12-2-10 3M4 12h16M7 18c4 4 12 1 10-3',
    'Inline code': 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16',
    'Bulleted list': 'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1',
    'Numbered list': 'M8 5h13M8 12h13M8 19h13M2 3h2v5M2 12h3l-3 6h3',
    Link: 'm10 14 4-4M9 16l-2 2a4 4 0 0 1-5-5l5-5a4 4 0 0 1 5 0m0 0 2-2a4 4 0 0 1 5 5l-5 5a4 4 0 0 1-5 0',
    'Text color': 'm5 18 7-15 7 15M8 12h8M3 22h18',
    Highlight: 'm6 15 8-11 6 5-8 11H6zm-2 7h14',
    'Clear formatting': 'm7 4 14 0M14 4 9 17M3 21l6-6 5 5-1 1H3m12-6 6 6m0-6-6 6',
  };
  return (
    paths[label] ??
    (label === 'Align center'
      ? 'M3 4h18M7 9h10M3 14h18M7 19h10'
      : label === 'Align right'
        ? 'M3 4h18M9 9h12M3 14h18M9 19h12'
        : label === 'Align justify'
          ? 'M3 4h18M3 9h18M3 14h18M3 19h18'
          : 'M3 4h18M3 9h12M3 14h18M3 19h12')
  );
}

function positionTooltip(button: HTMLElement) {
  const rect = button.getBoundingClientRect();
  button.style.setProperty(
    '--inkforge-tooltip-left',
    Math.max(8, Math.min(rect.left, button.ownerDocument.documentElement.clientWidth - 156)) + 'px',
  );
  button.style.setProperty('--inkforge-tooltip-top', Math.max(8, rect.top - 34) + 'px');
}
