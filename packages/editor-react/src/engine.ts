'use client';
import * as React from 'react';
import type {
  ControllerCommand,
  EngineBookmark,
  EngineController,
  HostFence,
  Mark,
  ModelSelection,
} from '@inkforge/editor-core';
import {
  mountEngineDom,
  renderEngineSeed,
  type EngineDomBinding,
  type EngineDomDiagnostic,
  type EngineSurfaceHandle,
  type EngineSurfaceStatus,
} from '../../../internal/editor-dom/src/controller-dom.js';
import {
  EditorUiBoundary,
  EditorInteractionContext,
  EditorEngineToolbar,
  type EngineToolbarAction,
  type InkforgeUiAdapterV1,
} from './ui-adapter.js';
export type { EngineDomDiagnostic, EngineSurfaceHandle, EngineSurfaceStatus };
export type EngineActionId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'paragraph'
  | 'heading2'
  | 'undo'
  | 'redo';
type Native = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | 'children'
  | 'dangerouslySetInnerHTML'
  | 'contentEditable'
  | 'defaultValue'
  | 'onChange'
  | 'onInput'
  | 'onBeforeInput'
  | 'onCompositionStart'
  | 'onCompositionUpdate'
  | 'onCompositionEnd'
  | 'onPaste'
  | 'onCut'
  | 'onCopy'
  | 'onDrop'
  | 'onKeyDown'
  | 'onKeyUp'
>;
export interface InkforgeEngineEditorProps extends Native {
  /** Borrowed controller: unmount never disposes it. Remount to change identity. */
  readonly controller: EngineController;
  readonly uiAdapter?: InkforgeUiAdapterV1;
  readonly toolbar?: boolean;
  readonly toolbarLabel?: string;
  readonly actionLabels?: Partial<Readonly<Record<EngineActionId, string>>>;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly maxNativeTextUtf16?: number;
  readonly captureHostFence?: () => HostFence;
  readonly onDiagnostic?: (diagnostic: EngineDomDiagnostic) => void;
  readonly onSurfaceStatusChange?: (status: EngineSurfaceStatus) => void;
  /** Separate from the unchanged forwarded HTMLDivElement ref. */
  readonly surfaceRef?: React.Ref<EngineSurfaceHandle>;
}
export const InkforgeEngineEditor = React.forwardRef<HTMLDivElement, InkforgeEngineEditorProps>(
  function InkforgeEngineEditor(props, ref) {
    if ('value' in props || 'defaultValue' in props || 'engineBinding' in props)
      throw new Error('ENGINE_SURFACE_REQUIRES_CONTROLLER_ONLY');
    return React.createElement(EditorUiBoundary, {
      adapter: props.uiAdapter,
      children: React.createElement(EngineContent, { ...props, ref }),
    });
  },
);
const defaults: Record<EngineActionId, string> = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  code: 'Inline code',
  paragraph: 'Paragraph',
  heading2: 'Heading 2',
  undo: 'Undo',
  redo: 'Redo',
};
const EngineContent = React.forwardRef<HTMLDivElement, InkforgeEngineEditorProps>(
  function EngineContent(
    {
      controller,
      uiAdapter: _adapter,
      toolbar = true,
      toolbarLabel = 'Text formatting',
      actionLabels,
      disabled = false,
      readOnly = false,
      maxNativeTextUtf16 = 500000,
      captureHostFence,
      onDiagnostic,
      onSurfaceStatusChange,
      surfaceRef,
      className,
      tabIndex,
      ...native
    },
    ref,
  ) {
    const initialController = React.useRef(controller);
    if (initialController.current !== controller)
      throw new Error('Remount InkforgeEngineEditor when changing controller');
    if (
      !Number.isSafeInteger(maxNativeTextUtf16) ||
      maxNativeTextUtf16 < 1 ||
      maxNativeTextUtf16 > 1048576
    )
      throw new Error('INVALID_NATIVE_TEXT_LIMIT');
    const snapshot = React.useSyncExternalStore(
      controller.subscribe,
      controller.getSnapshot,
      controller.getSnapshot,
    );
    const ui = React.useContext(EditorInteractionContext),
      readyOnce = React.useRef(ui === null || ui.status === 'ready');
    const root = React.useRef<HTMLDivElement>(null),
      binding = React.useRef<EngineDomBinding | null>(null);
    const initialHtml = React.useRef<string | null>(null);
    if (initialHtml.current === null) initialHtml.current = renderEngineSeed(snapshot);
    if (snapshot.disposed) initialHtml.current = ''; // Terminal ownership also clears the cached SSR seed.
    const [surface, setSurface] = React.useState<EngineSurfaceStatus>({
      phase: 'ready',
      pending: false,
      diagnostic: null,
    });
    const armed = React.useRef<{
      action: EngineActionId;
      bookmark: EngineBookmark | null;
      context: string;
    } | null>(null);
    const contextKey = ui?.interactionContextKey ?? 'standalone';
    const callbacks = React.useRef({ onDiagnostic, onSurfaceStatusChange });
    callbacks.current = { onDiagnostic, onSurfaceStatusChange };
    const options = {
      disabled: disabled || readOnly || (!readyOnce.current && ui?.status === 'pending'),
      interactionContextKey: contextKey,
      maxNativeTextUtf16,
      captureHostFence,
      onDiagnostic: (d: EngineDomDiagnostic) => callbacks.current.onDiagnostic?.(d),
      onStatus: (s: EngineSurfaceStatus) => {
        setSurface(s);
        callbacks.current.onSurfaceStatusChange?.(s);
      },
    };
    const latest = React.useRef(options);
    latest.current = options;
    React.useLayoutEffect(() => {
      const current = mountEngineDom(root.current!, controller, latest.current);
      binding.current = current;
      return () => {
        const previous = armed.current;
        if (previous?.bookmark) controller.releaseBookmark(previous.bookmark);
        armed.current = null;
        current.detach();
        if (binding.current === current) binding.current = null;
      };
    }, [controller]);
    React.useLayoutEffect(() => {
      if (ui?.status === 'ready') readyOnce.current = true;
      binding.current?.update(options);
    });
    React.useLayoutEffect(() => {
      const previous = armed.current;
      if (previous?.context !== contextKey) {
        if (previous?.bookmark) controller.releaseBookmark(previous.bookmark);
        // Keep a rejected gesture until a fresh pointer/key/assistive intent arrives.
        armed.current = previous ? { ...previous, bookmark: null } : null;
      }
    }, [contextKey, controller]);
    React.useImperativeHandle(ref, () => root.current!, []);
    React.useImperativeHandle(
      surfaceRef,
      () => ({
        getStatus: () => binding.current?.getStatus() ?? surface,
        discardDraft: () => binding.current?.discardDraft() ?? false,
      }),
      [surface],
    );
    function arm(action: EngineActionId, event?: { preventDefault(): void }): undefined {
      const previous = armed.current;
      if (previous?.bookmark) controller.releaseBookmark(previous.bookmark);
      const bookmark = binding.current?.captureBookmark() ?? null;
      armed.current = { action, bookmark, context: contextKey };
      if (!bookmark) event?.preventDefault();
      return undefined;
    }
    function blocks(selection: ModelSelection): string[] {
      function ancestor(id: string): string | null {
        let current: string | null = id;
        while (current) {
          const node: import('@inkforge/editor-core').NodeView | undefined =
            snapshot.nodeIndex[current];
          if (!node) return null;
          if (['paragraph', 'heading'].includes(node.node.type)) return current;
          current = node.parentId;
        }
        return snapshot.nodeIndex[snapshot.rootId]?.childIds[0] ?? null;
      }
      const a = ancestor(selection.anchor.nodeId),
        b = ancestor(selection.head.nodeId);
      const all = Object.values(snapshot.nodeIndex)
          .filter((v) => ['paragraph', 'heading'].includes(v.node.type))
          .map((v) => v.id),
        start = all.indexOf(a ?? ''),
        end = all.indexOf(b ?? '');
      return all.slice(Math.min(start, end), Math.max(start, end) + 1);
    }
    function activate(action: EngineActionId) {
      if (!armed.current || armed.current.action !== action) arm(action);
      const original = armed.current;
      armed.current = null;
      if (!original?.bookmark || original.context !== contextKey) return;
      const bookmark = original.bookmark;
      let command: ControllerCommand;
      if (action === 'undo' || action === 'redo') command = { kind: action };
      else if (action === 'paragraph' || action === 'heading2')
        command =
          action === 'paragraph'
            ? { kind: 'setBlockType', blocks: blocks(bookmark.selection), type: 'paragraph' }
            : {
                kind: 'setBlockType',
                blocks: blocks(bookmark.selection),
                type: 'heading',
                level: 2,
              };
      else
        command = {
          kind: binding.current?.selectionMarks().includes(action as Mark)
            ? 'clearMark'
            : 'setMark',
          range: bookmark.selection,
          mark: action as Mark,
        };
      binding.current?.applyBookmark(bookmark, command);
      controller.releaseBookmark(bookmark);
    }
    const toolbarKey: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229 ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey)
      )
        return;
      const key = event.key.toLowerCase();
      const action: EngineActionId | undefined =
        key === 'z'
          ? event.shiftKey
            ? 'redo'
            : 'undo'
          : key === 'y'
            ? 'redo'
            : ({ b: 'bold', i: 'italic', u: 'underline' } as const)[key as 'b'];
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      arm(action, event);
      activate(action);
    };
    const actions: EngineToolbarAction[] = (Object.keys(defaults) as EngineActionId[]).map(
      (id) => ({
        id,
        label: actionLabels?.[id] ?? defaults[id],
        disabled:
          options.disabled ||
          snapshot.readOnly ||
          snapshot.disposed ||
          snapshot.composing ||
          surface.pending ||
          surface.phase === 'readOnly' ||
          !snapshot.selection ||
          (id === 'undo' && !snapshot.canUndo) ||
          (id === 'redo' && !snapshot.canRedo),
        ...(['bold', 'italic', 'underline', 'strike', 'code'].includes(id)
          ? { pressed: binding.current?.selectionMarks().includes(id as Mark) ?? false }
          : {}),
        onIntent: (event) => arm(id, event),
        onActivate: () => activate(id),
      }),
    );
    return React.createElement(
      React.Fragment,
      null,
      toolbar
        ? React.createElement(EditorEngineToolbar, {
            label: toolbarLabel,
            actions,
            onKeyDown: toolbarKey,
          })
        : null,
      React.createElement('div', {
        ...native,
        ref: root,
        role: 'textbox',
        'aria-multiline': true,
        className: ['inkforge-editor', 'inkforge-engine-editor', className]
          .filter(Boolean)
          .join(' '),
        tabIndex: disabled ? -1 : (tabIndex ?? 0),
        contentEditable: false,
        suppressContentEditableWarning: true,
        dangerouslySetInnerHTML: { __html: initialHtml.current },
      }),
    );
  },
);
