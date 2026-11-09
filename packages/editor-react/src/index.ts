'use client';

import { EditorInteractionContext, EditorUiBoundary, type InkforgeUiAdapterV1 } from './ui-adapter.js';
export type { InkforgeUiAdapterV1 } from './ui-adapter.js';
import { useToolbar } from './toolbar.js';
import {
  parseHtml,
  serializeHtml,
  contentProfileFingerprint,
  type HtmlDiagnostic,
  type ContentProfile,
} from '@inkforge/editor-html';
import { parseContentHtml } from '@inkforge/editor-html/browser';
import {
  createEditorEngine,
  createDocument,
  type EditorEngine,
  type EngineSnapshot,
  type EditorSelection,
  type EngineResult,
  type SaveCheckpoint,
} from '@inkforge/editor-core';
import {
  createElement,
  Fragment,
  forwardRef,
  useEffect,
  useContext,
  useLayoutEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useSyncExternalStore,
  type Ref,
  useRef,
  type HTMLAttributes,
} from 'react';

export interface InkForgeEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'dangerouslySetInnerHTML' | 'contentEditable' | 'defaultValue' | 'onChange'
> {
  /** Optional owner-issued Common UI presentation; does not grant engine/host bridge capabilities. */
  uiAdapter?: InkforgeUiAdapterV1;
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
  /** Show the optional formatting toolbar. Defaults to false. */
  toolbar?: boolean;
  /** Optional host-owned engine. Its initial state replaces value/defaultValue. */
  engine?: EditorEngine;
  /** Immutable CMS content allowlist. Unsupported input is rejected without overwriting content. */
  profile?: ContentProfile;
  /** Save/dirty/undo API; the legacy forwarded ref remains the editable div. */
  controllerRef?: Ref<InkForgeController>;
  /** Host labels for registered content classes; never persisted as HTML. */
  contentTokenLabels?: Readonly<Record<string, string>>;
}

export interface InkForgeController {
  readonly engine: EditorEngine;
  getHtml():
    | { status: 'ready'; html: string; snapshot: EngineSnapshot }
    | { status: 'pending'; code: 'COMPOSITION_ACTIVE' }
    | { status: 'rejected'; code: string };
  undo(): void;
  redo(): void;
  focus(): void;
  /** Atomic Source/host update. A stale dialog must never overwrite newer edits. */
  applyHtml(
    html: string,
    context: { expectedSessionId: string; expectedRevision: number },
  ): EngineResult;
  createSaveCheckpoint():
    | { status: 'created'; html: string; checkpoint: SaveCheckpoint }
    | { status: 'rejected'; diagnostics: { code: string }[] };
}
export function useEditorSnapshot(engine: EditorEngine): EngineSnapshot {
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
}
function sanitize(html: string, profile?: ContentProfile) {
  if (profile) {
    if (typeof document === 'undefined')
      return {
        html: '',
        document: createDocument(),
        diagnostics: [] as HtmlDiagnostic[],
        rejected: false,
      };
    const result = parseContentHtml(html, profile);
    if (result.status === 'rejected')
      return {
        html: '',
        document: createDocument(),
        diagnostics: result.diagnostics.map((d) => ({ code: d.code, message: d.message })),
        rejected: true,
      };
    return {
      html: result.canonicalHtml,
      document: result.document,
      diagnostics: [] as HtmlDiagnostic[],
      rejected: false,
    };
  }
  const result = parseHtml(html);
  return {
    html: serializeHtml(result.document),
    document: result.document,
    diagnostics: result.diagnostics,
    rejected: false,
  };
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

function readSelection(element: HTMLDivElement): EditorSelection | null {
  const selection = element.ownerDocument.getSelection();
  const offset = (node: Node | null, position: number): number | null => {
    if (!node || !element.contains(node)) return null;
    let result =
      node.nodeType === 3
        ? position
        : Array.from(node.childNodes)
            .slice(0, position)
            .reduce((n, child) => n + size(child), 0);
    while (node !== element && node.parentNode) {
      for (let sibling = node.previousSibling; sibling; sibling = sibling.previousSibling)
        result += size(sibling);
      node = node.parentNode;
    }
    return result;
  };
  const anchor = selection && offset(selection.anchorNode, selection.anchorOffset);
  const focus = selection && offset(selection.focusNode, selection.focusOffset);
  return anchor == null || focus == null ? null : { anchor, focus };
}
function restoreSelection(element: HTMLDivElement, value: EditorSelection | null) {
  const selection = element.ownerDocument.getSelection();
  if (!value || !selection) return;
  const point = (position: number): [Node, number] => {
    const descend = (node: Node, remaining: number): [Node, number] => {
      if (node.nodeType === 3) return [node, Math.min(remaining, node.textContent?.length ?? 0)];
      for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i]!;
        const length = size(child);
        if (child.nodeName === 'BR' && remaining <= 1) return [node, i + remaining];
        if (remaining < length || (child.nodeType === 3 && remaining === length))
          return descend(child, remaining);
        remaining -= length;
      }
      return [node, node.childNodes.length];
    };
    return descend(element, position);
  };
  selection.setBaseAndExtent(...point(value.anchor), ...point(value.focus));
}
function replaceHtml(element: HTMLDivElement, html: string, selection?: EditorSelection | null) {
  const nextSelection = selection === undefined ? readSelection(element) : selection;
  if (element.innerHTML !== html) element.innerHTML = html;
  restoreSelection(element, nextSelection);
}

// Native Enter can create div paragraphs. Normalize only editing artifacts;
// source, paste and externally supplied HTML still use the strict profile unchanged.
function editingHtml(element: HTMLDivElement): string {
  const copy = element.cloneNode(true) as HTMLDivElement;
  for (const div of copy.querySelectorAll('div')) {
    if (div.querySelector('p,div,h1,h2,h3,h4,h5,h6,ul,ol')) continue;
    const paragraph = element.ownerDocument.createElement('p');
    for (const attribute of Array.from(div.attributes))
      paragraph.setAttribute(attribute.name, attribute.value);
    paragraph.append(...Array.from(div.childNodes));
    div.replaceWith(paragraph);
  }
  return copy.innerHTML;
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

/** Contenteditable adapter; committed document/history/save baseline belong to the pure engine. */
export const InkForgeEditor = forwardRef<HTMLDivElement, InkForgeEditorProps>(
  function InkForgeEditor(props, ref) {
    if ('engineBinding' in props && props.engineBinding !== undefined)
      throw new Error('INKFORGE_ENGINE_BINDING_NOT_IMPLEMENTED');
    return createElement(EditorUiBoundary, { adapter: props.uiAdapter,
      children: createElement(InkForgeEditorContent, { ...props, ref }) });
  },
);
const InkForgeEditorContent = forwardRef<HTMLDivElement, InkForgeEditorProps>(
  function InkForgeEditor(
    {
      uiAdapter: _uiAdapter,
      value,
      defaultValue,
      onChange,
      onDiagnostics,
      disabled: disabledProp = false,
      readOnly = false,
      toolbar = false,
      engine: providedEngine,
      profile,
      controllerRef,
      contentTokenLabels,
      className,
      tabIndex,
      onInput,
      onFocus,
      onPointerDown,
      onKeyDown,
      onBlur,
      onCompositionStart,
      onCompositionEnd,
      onPaste,
      onDrop,
      ...attributes
    },
    forwardedRef,
  ) {
    const ui = useContext(EditorInteractionContext);
    // Initial hydration readiness is a gate, not a recurring editing-mode change.
    // Presentation updates must never toggle contentEditable during native IME.
    const uiReadyOnce = useRef(ui === null || ui.status === 'ready');
    useLayoutEffect(() => { if (ui?.status === 'ready') uiReadyOnce.current = true; }, [ui?.status]);
    const disabled = disabledProp || (!uiReadyOnce.current && ui?.status === 'pending');
    const element = useRef<HTMLDivElement>(null);
    const initial = useRef<ReturnType<typeof sanitize> | null>(null);
    if (providedEngine && (value !== undefined || defaultValue !== undefined))
      throw new Error('Use engine or value/defaultValue, not both');
    if (!initial.current)
      initial.current = profile
        ? sanitize('', profile)
        : sanitize(
            providedEngine
              ? serializeHtml(providedEngine.getSnapshot().document)
              : (value ?? defaultValue ?? ''),
          );
    const localEngine = useRef<EditorEngine | null>(null);
    if (!localEngine.current)
      localEngine.current = createEditorEngine({ document: initial.current.document });
    const engine = providedEngine ?? localEngine.current;
    const binding = useRef({
      engine,
      profile: profile ? contentProfileFingerprint(profile) : null,
      controlled: value !== undefined,
    });
    if (
      binding.current.engine !== engine ||
      binding.current.profile !== (profile ? contentProfileFingerprint(profile) : null) ||
      binding.current.controlled !== (value !== undefined)
    )
      throw new Error(
        'Remount InkForgeEditor when changing engine, content profile, or controlled mode',
      );
    const engineSnapshot = useEditorSnapshot(engine);
    const localMutation = useRef(false);
    const localRevision = useRef<string | null>(null);
    const profileInitialized = useRef(false);
    const committed = useRef(initial.current.html);
    const immediateEcho = useRef<string | null>(null);
    const diagnosedInitial = useRef(false);
    const diagnosedValue = useRef<ReturnType<typeof sanitize> | null | undefined>(undefined);
    const [, requestReconcile] = useReducer((revision: number) => revision + 1, 0);
    const composing = useRef(false);
    const browserEmpty = useRef(false);
    const lastTypingTime = useRef(0);
    const pendingValue = useRef<ReturnType<typeof sanitize> | null>(null);
    const callbacks = useRef({ onChange, onDiagnostics });
    callbacks.current = { onChange, onDiagnostics };
    useImperativeHandle(forwardedRef, () => element.current!, []);

    const controlled = useMemo(
      () => (value === undefined ? null : sanitize(value, profile)),
      [value, profile],
    );
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
      if (controlled && !controlled.rejected && composing.current)
        pendingValue.current = controlled;
    }, [controlled]);

    useEffect(() => {
      if (
        !controlled ||
        controlled.rejected ||
        composing.current ||
        !element.current ||
        (profile && !profileInitialized.current)
      )
        return;
      if (controlled.html !== committed.current) {
        immediateEcho.current = null;
        browserEmpty.current = false;
        replaceHtml(element.current, controlled.html);
        formatting.invalidate();
        committed.current = controlled.html;
        engine.load(controlled.document, {
          expectedSessionId: engine.getSnapshot().sessionId,
          origin: 'unsaved',
        });
      }
    });

    useEffect(() => {
      if (!profile || profileInitialized.current || !element.current) return;
      const source = providedEngine
        ? serializeHtml(engine.getSnapshot().document, { referenceLinks: true })
        : (value ?? defaultValue ?? '');
      const next = sanitize(source, profile);
      callbacks.current.onDiagnostics?.(next.diagnostics);
      if (next.rejected) return;
      profileInitialized.current = true;
      committed.current = next.html;
      replaceHtml(element.current, next.html);
      if (!providedEngine)
        engine.load(next.document, {
          expectedSessionId: engine.getSnapshot().sessionId,
          origin: 'persisted',
        });
      requestReconcile();
    }, [engine, profile, providedEngine, value, defaultValue]);
    useEffect(() => {
      if (
        localMutation.current ||
        composing.current ||
        !element.current ||
        engineSnapshot !== engine.getSnapshot() ||
        localRevision.current === `${engineSnapshot.sessionId}:${engineSnapshot.revision}`
      )
        return;
      const next = sanitize(
        serializeHtml(engineSnapshot.document, { referenceLinks: !!profile }),
        profile,
      );
      if (next.rejected) return;
      committed.current = next.html;
      replaceHtml(element.current, next.html);
    }, [engineSnapshot.document, engineSnapshot.sessionId, profile]);
    const history = (kind: 'undo' | 'redo') => {
      if (disabled || readOnly || composing.current || (profile && !profileInitialized.current))
        return;
      const result = engine.dispatch(
        { kind },
        { expectedSessionId: engine.getSnapshot().sessionId },
      );
      if (result.status === 'committed') {
        const next = sanitize(
          serializeHtml(result.snapshot.document, { referenceLinks: !!profile }),
          profile,
        );
        if (!next.rejected && element.current) {
          committed.current = next.html;
          immediateEcho.current = next.html;
          replaceHtml(element.current, next.html, result.snapshot.selection);
          callbacks.current.onChange?.(next.html);
        }
      }
    };
    useEffect(() => {
      const root = element.current;
      if (!root || composing.current) return;
      if (root === root.ownerDocument.activeElement)
        restoreSelection(root, engineSnapshot.selection);
    }, [engineSnapshot.selection]);
    useEffect(() => {
      const root = element.current;
      if (!root) return;
      const track = () => {
        if (composing.current || localMutation.current || root !== root.ownerDocument.activeElement)
          return;
        const selection = readSelection(root);
        if (selection)
          engine.dispatch(
            { kind: 'setSelection', selection },
            { expectedSessionId: engine.getSnapshot().sessionId },
          );
      };
      root.ownerDocument.addEventListener('selectionchange', track);
      return () => root.ownerDocument.removeEventListener('selectionchange', track);
    }, [engine]);
    useImperativeHandle(
      controllerRef,
      () => ({
        engine,
        applyHtml: (html, context) => {
          if (disabled || readOnly || (profile && !profileInitialized.current))
            return { status: 'rejected', diagnostics: [{ code: 'READ_ONLY' }] };
          if (composing.current)
            return { status: 'rejected', diagnostics: [{ code: 'COMPOSITION_ACTIVE' }] };
          const next = sanitize(html, profile);
          if (next.rejected || next.diagnostics.length)
            return {
              status: 'rejected',
              diagnostics: next.diagnostics.map((d) => ({ code: d.code })),
            };
          const result = engine.dispatch(
            { kind: 'replaceDocument', document: next.document, selection: null },
            context,
          );
          if (result.status === 'committed' && element.current) {
            committed.current = next.html;
            immediateEcho.current = next.html;
            replaceHtml(element.current, next.html, null);
            formatting.invalidate();
            callbacks.current.onChange?.(next.html);
          }
          return result;
        },
        createSaveCheckpoint: () => {
          if (profile && !profileInitialized.current)
            return { status: 'rejected', diagnostics: [{ code: 'PROFILE_NOT_READY' }] };
          if (composing.current)
            return { status: 'rejected', diagnostics: [{ code: 'COMPOSITION_ACTIVE' }] };
          const next = sanitize(
            serializeHtml(engine.getSnapshot().document, { referenceLinks: !!profile }),
            profile,
          );
          if (next.rejected)
            return { status: 'rejected', diagnostics: [{ code: 'INVALID_CONTENT' }] };
          const result = engine.createSaveCheckpoint();
          return result.status === 'created' ? { ...result, html: next.html } : result;
        },
        focus: () => element.current?.focus(),
        undo: () => history('undo'),
        redo: () => history('redo'),
        getHtml: () => {
          if (profile && !profileInitialized.current)
            return { status: 'rejected' as const, code: 'PROFILE_NOT_READY' };
          if (composing.current || engine.getSnapshot().composing)
            return { status: 'pending' as const, code: 'COMPOSITION_ACTIVE' as const };
          const next = sanitize(
            serializeHtml(engine.getSnapshot().document, { referenceLinks: !!profile }),
            profile,
          );
          return next.rejected
            ? { status: 'rejected' as const, code: 'INVALID_CONTENT' }
            : { status: 'ready' as const, html: next.html, snapshot: engine.getSnapshot() };
        },
      }),
      [engine, profile, disabled, readOnly],
    );
    const commit = (
      normalize: boolean,
      diagnostics: HtmlDiagnostic[] = [],
      historyGroup?: string,
    ) => {
      if (!element.current || composing.current) return;
      const raw = profile ? editingHtml(element.current) : element.current.innerHTML;
      const placeholder = /^(?:<br>|<(?:p|div)(?: [^>]*)?><br><\/(?:p|div)>)$/.test(raw);
      const next = sanitize(browserEmpty.current && placeholder ? '' : raw, profile);
      callbacks.current.onDiagnostics?.([...diagnostics, ...next.diagnostics]);
      if (next.rejected) {
        replaceHtml(element.current, committed.current);
        return;
      }
      localMutation.current = true;
      const transaction = engine.dispatch(
        {
          kind: 'replaceDocument',
          document: next.document,
          selection: readSelection(element.current),
          ...(historyGroup ? { historyGroup } : {}),
        },
        { expectedSessionId: engine.getSnapshot().sessionId },
      );
      localMutation.current = false;
      if (transaction.status !== 'rejected')
        localRevision.current = `${transaction.snapshot.sessionId}:${transaction.snapshot.revision}`;
      if (transaction.status === 'rejected') {
        replaceHtml(element.current, committed.current);
        callbacks.current.onDiagnostics?.(
          transaction.diagnostics.map((d) => ({ code: d.code, message: d.code })),
        );
        return;
      }
      if (normalize) replaceHtml(element.current, next.html);
      if (next.html !== committed.current) {
        committed.current = next.html;
        immediateEcho.current = next.html;
        callbacks.current.onChange?.(next.html);
        if (controlled) requestReconcile();
      }
    };
    const formatting = useToolbar(
      element,
      toolbar,
      disabled || readOnly || composing.current || (!!profile && !profileInitialized.current),
      () => commit(false),
      () => disabled || readOnly || composing.current || (!!profile && !profileInitialized.current),
      () => commit(true),
      profile,
      contentTokenLabels,
    );
    const previousContext = useRef(ui?.interactionContextKey);
    useLayoutEffect(() => {
      if (previousContext.current !== ui?.interactionContextKey) {
        previousContext.current = ui?.interactionContextKey;
        formatting.invalidate();
      }
    }, [ui?.interactionContextKey]);
    useEffect(() => {
      const root = element.current;
      const handler = (event: Event) => {
        const input = event as InputEvent;
        if (input.inputType === 'historyUndo' || input.inputType === 'historyRedo') {
          event.preventDefault();
          history(input.inputType === 'historyUndo' ? 'undo' : 'redo');
          return;
        }
        if (root && !composing.current) {
          if (performance.now() - lastTypingTime.current > 750) engine.closeHistoryGroup();
          const selection = readSelection(root);
          if (selection)
            engine.dispatch(
              { kind: 'setSelection', selection },
              { expectedSessionId: engine.getSnapshot().sessionId },
            );
        }
        formatting.beforeInput(input);
      };
      root?.addEventListener('beforeinput', handler);
      return () => root?.removeEventListener('beforeinput', handler);
    });
    const finishComposition = () => {
      composing.current = false;
      engine.dispatch(
        { kind: 'endComposition' },
        { expectedSessionId: engine.getSnapshot().sessionId },
      );
      requestReconcile();
      const pending = pendingValue.current;
      pendingValue.current = null;
      if (pending && element.current) {
        browserEmpty.current = false;
        replaceHtml(element.current, pending.html);
        formatting.invalidate();
        committed.current = pending.html;
        engine.load(pending.document, {
          expectedSessionId: engine.getSnapshot().sessionId,
          origin: 'unsaved',
        });
      } else {
        formatting.finishComposition();
        commit(true);
      }
    };

    const surface = createElement('div', {
      ...attributes,
      key: 'surface',
      ref: element,
      role: 'textbox',
      'aria-multiline': true,
      'aria-disabled': disabled || undefined,
      'aria-readonly':
        readOnly || disabled || (!!profile && !profileInitialized.current) || undefined,
      className: ['inkforge-editor', className].filter(Boolean).join(' '),
      tabIndex: disabled ? -1 : (tabIndex ?? 0),
      contentEditable: !disabled && !readOnly && (!profile || profileInitialized.current),
      suppressContentEditableWarning: true,
      // This never changes after mount: React must not reconcile browser edits.
      dangerouslySetInnerHTML: { __html: initial.current.html },
      onPointerDown(event) {
        engine.closeHistoryGroup();
        formatting.activate(true);
        onPointerDown?.(event);
      },
      onKeyDown(event) {
        formatting.activate();
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          ['z', 'y'].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
          history(event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo');
        }
      },
      onFocus(event) {
        if (formatting.container.current?.contains(event.relatedTarget as Node | null))
          formatting.restore();
        onFocus?.(event);
      },
      onInput(event) {
        if (!disabled && !readOnly && !formatting.running.current) {
          const now = performance.now();
          if (now - lastTypingTime.current > 750) engine.closeHistoryGroup();
          lastTypingTime.current = now;
          browserEmpty.current = /^(?:<br>|<(?:p|div)(?: [^>]*)?><br><\/(?:p|div)>)$/.test(
            event.currentTarget.innerHTML,
          );
          commit(
            false,
            [],
            ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(
              (event.nativeEvent as InputEvent).inputType,
            )
              ? 'typing:' + (event.nativeEvent as InputEvent).inputType
              : undefined,
          );
        }
        onInput?.(event);
      },
      onBlur(event) {
        engine.closeHistoryGroup();
        if (composing.current) finishComposition();
        else if (!formatting.container.current?.contains(event.relatedTarget as Node | null))
          commit(true);
        if (!formatting.container.current?.contains(event.relatedTarget as Node | null))
          formatting.refresh();
        onBlur?.(event);
      },
      onCompositionStart(event) {
        formatting.startComposition();
        composing.current = true;
        engine.dispatch(
          { kind: 'beginComposition' },
          { expectedSessionId: engine.getSnapshot().sessionId },
        );
        requestReconcile();
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
          profile,
        );
        if (next.rejected) {
          callbacks.current.onDiagnostics?.(next.diagnostics);
          return;
        }
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
      onClick(event) {
        if ((event.target as Element).closest?.('a')) event.preventDefault();
        attributes.onClick?.(event);
      },
      onDrop(event) {
        onDrop?.(event);
        // Native HTML drops bypass paste sanitization; this MVP does not accept drops.
        event.preventDefault();
      },
    });
    // The stable keyed surface never remounts when its sibling toolbar changes.
    // A Fragment preserves the original bare-div DOM when the toolbar is absent.
    return createElement(Fragment, null, toolbar ? formatting.view : null, surface);
  },
);
