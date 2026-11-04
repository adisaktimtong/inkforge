'use client';

import { parseHtml, serializeHtml, type HtmlDiagnostic } from '@inkforge/editor-html';
import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  type HTMLAttributes,
} from 'react';

export interface InkForgeEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'dangerouslySetInnerHTML' | 'contentEditable' | 'defaultValue' | 'onChange'
> {
  /** Controlled HTML. Do not switch between controlled and uncontrolled usage. */
  value?: string;
  /** Initial HTML for an uncontrolled editor; later changes are ignored. */
  defaultValue?: string;
  /** Sanitized HTML, emitted once per distinct committed edit. */
  onChange?: (html: string) => void;
  /** HTML-boundary diagnostics for initial values, external updates, and edits. */
  onDiagnostics?: (diagnostics: HtmlDiagnostic[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

function sanitize(html: string) {
  const result = parseHtml(html);
  return { html: serializeHtml(result.document), diagnostics: result.diagnostics };
}

// Semantic offsets survive text-node coalescing and wrapper normalization.
// A hard break and each text block boundary occupy one position.
const textBlock = (node: Node) =>
  /^(?:P|H[1-6]|DIV|LI)$/.test(node.nodeName) &&
  !Array.from(node.childNodes).some((child) => /^(?:P|H[1-6]|DIV|UL|OL)$/.test(child.nodeName));
const size = (node: Node): number =>
  node.nodeType === 3
    ? (node.textContent?.length ?? 0)
    : node.nodeName === 'BR'
      ? 1
      : Array.from(node.childNodes).reduce((total, child) => total + size(child), 0) +
        Number(textBlock(node));

function replaceHtml(element: HTMLDivElement, html: string) {
  if (element.innerHTML === html) return;
  const selection = element.ownerDocument.getSelection();
  const offset = (node: Node | null, position: number) => {
    if (!node || !element.contains(node)) return null;
    let result =
      node.nodeType === 3
        ? position
        : Array.from(node.childNodes)
            .slice(0, position)
            .reduce((total, child) => total + size(child), 0);
    while (node !== element && node.parentNode) {
      for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling)
        result += size(sibling);
      node = node.parentNode;
    }
    return result;
  };
  const anchor = selection && offset(selection.anchorNode, selection.anchorOffset);
  const focus = selection && offset(selection.focusNode, selection.focusOffset);
  element.innerHTML = html;
  if (anchor == null || focus == null || !selection) return;
  const point = (position: number): [Node, number] => {
    const descend = (node: Node, remaining: number): [Node, number] => {
      if (node.nodeType === 3) return [node, Math.min(remaining, node.textContent?.length ?? 0)];
      for (let index = 0; index < node.childNodes.length; index++) {
        const child = node.childNodes[index]!;
        const length = size(child);
        if (child.nodeName === 'BR' && remaining <= 1) return [node, index + remaining];
        if (remaining < length || (child.nodeType === 3 && remaining === length))
          return descend(child, remaining);
        remaining -= length;
      }
      return [node, node.childNodes.length];
    };
    return descend(element, position);
  };
  selection.setBaseAndExtent(...point(anchor), ...point(focus));
}

function boundary(node: Node, root: HTMLElement, tags: RegExp): Element | null {
  let current = node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (current && current !== root) {
    if (tags.test(current.nodeName)) return current;
    current = current.parentElement;
  }
  return null;
}
const hasContent = (node: Element | DocumentFragment) =>
  !!node.textContent || !!node.querySelector('br');

function insertFragment(root: HTMLDivElement, range: Range, fragment: DocumentFragment) {
  const doc = root.ownerDocument;
  const start = boundary(range.startContainer, root, /^(?:P|H[1-6]|LI)$/);
  const end = boundary(range.endContainer, root, /^(?:P|H[1-6]|LI)$/);
  const startItem = boundary(range.startContainer, root, /^LI$/);
  const endItem = boundary(range.endContainer, root, /^LI$/);
  const endRoot = boundary(range.endContainer, root, /^(?:P|H[1-6]|UL|OL|DIV)$/);
  const inline =
    start &&
    fragment.childNodes.length === 1 &&
    fragment.firstChild?.nodeName === 'P' &&
    !(fragment.firstChild as Element).attributes.length;
  const marker = doc.createComment('caret');
  const insertion = range.cloneRange();
  insertion.collapse(true);
  insertion.insertNode(marker);
  range.setStartAfter(marker);
  range.deleteContents();
  if (inline) {
    const paragraph = fragment.firstChild!;
    while (paragraph.firstChild) fragment.insertBefore(paragraph.firstChild, paragraph);
    paragraph.remove();
    marker.parentNode!.insertBefore(fragment, marker);
    if (end && end !== start && end.isConnected) {
      while (end.firstChild) start.appendChild(end.firstChild);
      let parent = end.parentElement;
      end.remove();
      while (
        parent &&
        parent !== root &&
        /^(?:LI|UL|OL)$/.test(parent.nodeName) &&
        !hasContent(parent)
      ) {
        const ancestor = parent.parentElement;
        parent.remove();
        parent = ancestor;
      }
    }
    if (
      startItem &&
      endItem &&
      startItem !== endItem &&
      endItem.isConnected &&
      startItem.parentNode === endItem.parentNode
    ) {
      while (endItem.firstChild) startItem.appendChild(endItem.firstChild);
      endItem.remove();
    }
    range.setStartBefore(marker);
    range.collapse(true);
    marker.remove();
  } else {
    let block: Node = marker;
    while (block.parentNode && block.parentNode !== root) block = block.parentNode;
    let after: Node | null = marker;
    if (block !== marker) {
      const suffixRange = doc.createRange();
      suffixRange.selectNodeContents(block);
      suffixRange.setStartAfter(marker);
      const suffix = suffixRange.extractContents();
      after = block.nextSibling;
      if (hasContent(suffix)) {
        const trailing = block.cloneNode(false);
        trailing.appendChild(suffix);
        root.insertBefore(trailing, after);
        after = trailing;
      }
      marker.remove();
      if (!hasContent(block as Element)) block.parentNode!.removeChild(block);
    }
    const last = fragment.lastElementChild!;
    root.insertBefore(fragment, after);
    marker.remove();
    if (endRoot?.isConnected && endRoot !== block && !hasContent(endRoot)) endRoot.remove();
    // Keep the next typed character inside the last pasted text block.
    const leaves = last.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li');
    const target = leaves[leaves.length - 1] ?? last;
    range.selectNodeContents(target);
    range.collapse(false);
  }
  const selection = doc.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

/** A browser-owned contentEditable surface with the shared HTML boundary. */
export const InkForgeEditor = forwardRef<HTMLDivElement, InkForgeEditorProps>(
  function InkForgeEditor(
    {
      value,
      defaultValue,
      onChange,
      onDiagnostics,
      disabled = false,
      readOnly = false,
      className,
      tabIndex,
      onInput,
      onBlur,
      onCompositionStart,
      onCompositionEnd,
      onPaste,
      onDrop,
      ...attributes
    },
    forwardedRef,
  ) {
    const element = useRef<HTMLDivElement>(null);
    const initial = useRef<ReturnType<typeof sanitize> | null>(null);
    if (!initial.current) initial.current = sanitize(value ?? defaultValue ?? '');
    const committed = useRef(initial.current.html);
    const immediateEcho = useRef<string | null>(null);
    const diagnosedInitial = useRef(false);
    const diagnosedValue = useRef<ReturnType<typeof sanitize> | null | undefined>(undefined);
    const [, requestReconcile] = useReducer((revision: number) => revision + 1, 0);
    const composing = useRef(false);
    const browserEmpty = useRef(false);
    const pendingValue = useRef<ReturnType<typeof sanitize> | null>(null);
    const callbacks = useRef({ onChange, onDiagnostics });
    callbacks.current = { onChange, onDiagnostics };
    useImperativeHandle(forwardedRef, () => element.current!, []);

    const controlled = useMemo(() => (value === undefined ? null : sanitize(value)), [value]);
    useEffect(() => {
      if (diagnosedValue.current === controlled) return;
      diagnosedValue.current = controlled;
      if (!diagnosedInitial.current) {
        diagnosedInitial.current = true;
        callbacks.current.onDiagnostics?.(initial.current!.diagnostics);
      } else if (controlled) {
        const echo = immediateEcho.current === controlled.html && !controlled.diagnostics.length;
        immediateEcho.current = null;
        if (!echo) callbacks.current.onDiagnostics?.(controlled.diagnostics);
      }
      if (controlled && composing.current) pendingValue.current = controlled;
    }, [controlled]);

    useEffect(() => {
      if (!controlled || composing.current || !element.current) return;
      if (controlled.html !== committed.current) {
        immediateEcho.current = null;
        browserEmpty.current = false;
        replaceHtml(element.current, controlled.html);
        committed.current = controlled.html;
      }
    });

    const commit = (normalize: boolean, diagnostics: HtmlDiagnostic[] = []) => {
      if (!element.current || composing.current) return;
      const raw = element.current.innerHTML;
      const placeholder = /^(?:<br>|<(?:p|div)(?: [^>]*)?><br><\/(?:p|div)>)$/.test(raw);
      const next = sanitize(browserEmpty.current && placeholder ? '' : raw);
      callbacks.current.onDiagnostics?.([...diagnostics, ...next.diagnostics]);
      if (normalize) replaceHtml(element.current, next.html);
      if (next.html !== committed.current) {
        committed.current = next.html;
        immediateEcho.current = next.html;
        callbacks.current.onChange?.(next.html);
        if (controlled) requestReconcile();
      }
    };
    const finishComposition = () => {
      composing.current = false;
      const pending = pendingValue.current;
      pendingValue.current = null;
      if (pending && element.current) {
        browserEmpty.current = false;
        replaceHtml(element.current, pending.html);
        committed.current = pending.html;
      } else {
        commit(true);
      }
    };

    return createElement('div', {
      ...attributes,
      ref: element,
      role: 'textbox',
      'aria-multiline': true,
      'aria-disabled': disabled || undefined,
      'aria-readonly': readOnly || disabled || undefined,
      className: ['inkforge-editor', className].filter(Boolean).join(' '),
      tabIndex: disabled ? -1 : (tabIndex ?? 0),
      contentEditable: !disabled && !readOnly,
      suppressContentEditableWarning: true,
      // This never changes after mount: React must not reconcile browser edits.
      dangerouslySetInnerHTML: { __html: initial.current.html },
      onInput(event) {
        if (!disabled && !readOnly) {
          browserEmpty.current = /^(?:<br>|<(?:p|div)(?: [^>]*)?><br><\/(?:p|div)>)$/.test(
            event.currentTarget.innerHTML,
          );
          commit(false);
        }
        onInput?.(event);
      },
      onBlur(event) {
        if (composing.current) finishComposition();
        else commit(true);
        onBlur?.(event);
      },
      onCompositionStart(event) {
        composing.current = true;
        onCompositionStart?.(event);
      },
      onCompositionEnd(event) {
        if (composing.current) finishComposition();
        onCompositionEnd?.(event);
      },
      onPaste(event) {
        onPaste?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        if (disabled || readOnly || composing.current || !element.current) return;
        const rich = event.clipboardData.getData('text/html');
        const plain = event.clipboardData.getData('text/plain');
        if (!rich && !plain) return;
        // Escape plain text before passing through the same HTML boundary.
        const source =
          rich ||
          '<p>' +
            plain
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\r?\n/g, '<br>') +
            '</p>';
        const next = sanitize(
          /<(?:p|div|h[1-6]|ul|ol|section|article|li)\b/i.test(source)
            ? source
            : `<p>${source}</p>`,
        );
        const selection = element.current.ownerDocument.getSelection();
        if (
          !selection?.rangeCount ||
          !element.current.contains(selection.anchorNode) ||
          !element.current.contains(selection.focusNode)
        )
          return;
        const template = element.current.ownerDocument.createElement('template');
        // No raw clipboard markup enters any DOM node.
        template.innerHTML = next.html;
        if (!hasContent(template.content)) {
          callbacks.current.onDiagnostics?.(next.diagnostics);
          return;
        }
        browserEmpty.current = false;
        insertFragment(element.current, selection.getRangeAt(0), template.content);
        commit(true, next.diagnostics);
      },
      onDrop(event) {
        onDrop?.(event);
        // Native HTML drops bypass paste sanitization; this MVP does not accept drops.
        event.preventDefault();
      },
    });
  },
);
