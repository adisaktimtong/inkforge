'use client';
import * as React from 'react';
import { isProfileHref, type ContentProfile } from '@inkforge/editor-html';
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
  EditorButton,
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
  | 'subscript'
  | 'superscript'
  | 'paragraph'
  | 'heading2'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
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
  /**
   * Strict profile of the content. It lets the surface render registered classes and
   * allowed links, and adds alignment and content style actions for the registered classes.
   */
  readonly contentProfile?: ContentProfile;
  /**
   * Lets the host choose a link; `detail.target` tells whether the current link opens in a new tab, for example with a picker for its own pages and files.
   * Resolve with the address to set (alone, or with whether it opens in a new tab), `null`
   * to remove the link, or `undefined` to cancel. Without it the editor shows a field for
   * typing an address.
   */
  readonly requestLink?: (
    current: string | null,
    detail: Readonly<{ target: '_self' | '_blank' }>,
  ) => Promise<EngineLinkChoice | null | undefined>;
  /** Display names for content style classes; a readable name is derived otherwise. */
  readonly tokenLabels?: Readonly<Record<string, string>>;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly maxNativeTextUtf16?: number;
  readonly captureHostFence?: () => HostFence;
  readonly onDiagnostic?: (diagnostic: EngineDomDiagnostic) => void;
  readonly onSurfaceStatusChange?: (status: EngineSurfaceStatus) => void;
  /** Separate from the unchanged forwarded HTMLDivElement ref. */
  readonly surfaceRef?: React.Ref<EngineSurfaceHandle>;
}
export type EngineLinkChoice = string | Readonly<{ href: string; target?: '_self' | '_blank' }>;
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
  subscript: 'Subscript',
  superscript: 'Superscript',
  paragraph: 'Paragraph',
  heading2: 'Heading 2',
  blockquote: 'Quote',
  codeBlock: 'Code block',
  horizontalRule: 'Horizontal rule',
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
      contentProfile,
      tokenLabels,
      requestLink,
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
    // The selection a link is being chosen for, kept while focus is in the address field.
    const [linkDraft, setLinkDraft] = React.useState<{
      bookmark: EngineBookmark;
      value: string;
      error: string;
    } | null>(null);
    const [surface, setSurface] = React.useState<EngineSurfaceStatus>({
      phase: 'ready',
      pending: false,
      diagnostic: null,
    });
    const armed = React.useRef<{
      action: string;
      bookmark: EngineBookmark | null;
      context: string;
    } | null>(null);
    const contextKey = ui?.interactionContextKey ?? 'standalone';
    const contentPolicy = React.useMemo(
      () =>
        contentProfile && {
          classes: contentProfile.tokenClasses,
          href: (href: string) => isProfileHref(href, contentProfile),
        },
      [contentProfile],
    );
    const callbacks = React.useRef({ onDiagnostic, onSurfaceStatusChange });
    callbacks.current = { onDiagnostic, onSurfaceStatusChange };
    const options = {
      disabled: disabled || readOnly || (!readyOnce.current && ui?.status === 'pending'),
      interactionContextKey: contextKey,
      maxNativeTextUtf16,
      captureHostFence,
      contentPolicy,
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
    function arm(action: string, event?: { preventDefault(): void }): undefined {
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
          if (['paragraph', 'heading', 'blockquote', 'code-block'].includes(node.node.type))
            return current;
          current = node.parentId;
        }
        return snapshot.nodeIndex[snapshot.rootId]?.childIds[0] ?? null;
      }
      const a = ancestor(selection.anchor.nodeId),
        b = ancestor(selection.head.nodeId);
      const all = Object.values(snapshot.nodeIndex)
          .filter((v) => ['paragraph', 'heading', 'blockquote', 'code-block'].includes(v.node.type))
          .map((v) => v.id),
        start = all.indexOf(a ?? ''),
        end = all.indexOf(b ?? '');
      return all.slice(Math.min(start, end), Math.max(start, end) + 1);
    }
    // Classes the profile registers, split into alignment and content styles.
    const alignPrefix = contentProfile ? contentProfile.classPrefix + 'align-' : '',
      alignTokens = contentProfile?.tokenClasses.filter((c) => c.startsWith(alignPrefix)) ?? [],
      styleTokens = contentProfile?.tokenClasses.filter((c) => !c.startsWith(alignPrefix)) ?? [],
      styleGroup = (token: string) =>
        styleTokens.filter(
          (c) =>
            c.slice(contentProfile!.classPrefix.length).split('-')[0] ===
            token.slice(contentProfile!.classPrefix.length).split('-')[0],
        );
    const classesOf = (id: string): string =>
      (snapshot.nodeIndex[id]?.node as { className?: string } | undefined)?.className ?? '';
    const classable = (selection: ModelSelection) =>
      blocks(selection).filter((id) => snapshot.nodeIndex[id]?.node.type !== 'code-block');
    const collapsed = (selection: ModelSelection) =>
      selection.anchor.nodeId === selection.head.nodeId &&
      selection.anchor.offset === selection.head.offset;
    function classCommand(action: string, selection: ModelSelection): ControllerCommand | null {
      const [kind, token] = [
        action.slice(0, action.indexOf(':')),
        action.slice(action.indexOf(':') + 1),
      ];
      if (kind === 'align') {
        const targets = classable(selection),
          active = targets.every((id) => classesOf(id).split(/\s+/).includes(token));
        return targets.length
          ? {
              kind: 'setBlockClasses',
              blocks: targets,
              remove: alignTokens,
              ...(active ? {} : { add: token }),
            }
          : null;
      }
      const remove = token ? styleGroup(token) : styleTokens;
      // Selected words take the style; a bare caret styles its block.
      if (!collapsed(selection))
        return {
          kind: 'setTextClasses',
          range: selection,
          remove,
          ...(token ? { add: token } : {}),
        };
      const targets = classable(selection);
      return targets.length
        ? { kind: 'setBlockClasses', blocks: targets, remove, ...(token ? { add: token } : {}) }
        : null;
    }
    const linkNodeAt = (selection: ModelSelection) => {
      for (
        let id: string | null = selection.head.nodeId;
        id;
        id = snapshot.nodeIndex[id]?.parentId ?? null
      ) {
        const node = snapshot.nodeIndex[id]?.node;
        if (node?.type === 'link') return node;
      }
      return null;
    };
    const linkAt = (selection: ModelSelection): string | null =>
      linkNodeAt(selection)?.href ?? null;
    const openLink = React.useRef(linkDraft);
    openLink.current = linkDraft;
    React.useEffect(
      () => () => {
        if (openLink.current) controller.releaseBookmark(openLink.current.bookmark);
      },
      [controller],
    );
    function finishLink(bookmark: EngineBookmark, choice: EngineLinkChoice | null) {
      const link = typeof choice === 'string' ? { href: choice } : choice;
      binding.current?.applyBookmark(
        bookmark,
        link === null
          ? { kind: 'removeLink', range: bookmark.selection }
          : {
              kind: 'setLink',
              range: bookmark.selection,
              href: link.href,
              ...(link.target === '_blank' ? { target: '_blank' as const } : {}),
            },
      );
      controller.releaseBookmark(bookmark);
    }
    function submitLink() {
      if (!linkDraft || !contentProfile) return;
      const href = linkDraft.value.trim();
      if (!isProfileHref(href, contentProfile)) {
        setLinkDraft({ ...linkDraft, error: 'Enter an address this content may link to.' });
        return;
      }
      setLinkDraft(null);
      finishLink(linkDraft.bookmark, href);
    }
    function cancelLink() {
      if (!linkDraft) return;
      controller.releaseBookmark(linkDraft.bookmark);
      setLinkDraft(null);
      root.current?.focus({ preventScroll: true });
    }
    function activate(action: EngineActionId | string) {
      if (!armed.current || armed.current.action !== action) arm(action);
      const original = armed.current;
      armed.current = null;
      if (!original?.bookmark || original.context !== contextKey) return;
      const bookmark = original.bookmark;
      if (action === 'link') {
        const current = linkAt(bookmark.selection);
        if (!requestLink) {
          if (linkDraft) controller.releaseBookmark(linkDraft.bookmark);
          setLinkDraft({ bookmark, value: current ?? '', error: '' });
          return;
        }
        const target = linkNodeAt(bookmark.selection)?.target === '_blank' ? '_blank' : '_self';
        void requestLink(current, { target }).then(
          (choice) => {
            const href = typeof choice === 'string' ? choice : choice?.href;
            // An address the profile refuses is dropped rather than stored.
            if (
              choice === undefined ||
              (choice !== null &&
                (typeof href !== 'string' || !isProfileHref(href, contentProfile!)))
            ) {
              // Nothing changes; the author continues where the Link action was taken.
              binding.current?.focusBookmark(bookmark);
              controller.releaseBookmark(bookmark);
            } else finishLink(bookmark, choice);
          },
          () => {
            binding.current?.focusBookmark(bookmark);
            controller.releaseBookmark(bookmark);
          },
        );
        return;
      }
      if (action === 'unlink') {
        finishLink(bookmark, null);
        return;
      }
      let command: ControllerCommand | null;
      if (action.includes(':')) command = classCommand(action, bookmark.selection);
      else if (action === 'undo' || action === 'redo') command = { kind: action };
      else if (action === 'blockquote' || action === 'codeBlock')
        command = {
          kind: 'setBlockType',
          blocks: blocks(bookmark.selection),
          type: action === 'blockquote' ? 'blockquote' : 'code-block',
        };
      else if (action === 'horizontalRule')
        command = { kind: 'insertHorizontalRule', at: bookmark.selection.head };
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
      if (command) binding.current?.applyBookmark(bookmark, command);
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
    const unavailable =
      options.disabled ||
      snapshot.readOnly ||
      snapshot.disposed ||
      snapshot.composing ||
      surface.pending ||
      surface.phase === 'readOnly' ||
      !snapshot.selection;
    // cms-body-v1 cannot store these, so a host on that profile does not offer them.
    const extended: EngineActionId[] = [
      'subscript',
      'superscript',
      'blockquote',
      'codeBlock',
      'horizontalRule',
    ];
    const selectedBlocks = snapshot.selection ? classable(snapshot.selection) : [];
    const currentLink = snapshot.selection ? linkAt(snapshot.selection) : null,
      selectionCollapsed = !snapshot.selection || collapsed(snapshot.selection);
    const hasClass = (token: string) =>
      selectedBlocks.length > 0 &&
      selectedBlocks.every((id) => classesOf(id).split(/\s+/).includes(token));
    const classAction = (id: string, label: string, pressed?: boolean): EngineToolbarAction => ({
      id,
      label,
      disabled: unavailable,
      ...(pressed === undefined ? {} : { pressed }),
      onIntent: (event) => arm(id, event),
      onActivate: () => activate(id),
    });
    const styleName = (token: string) =>
      tokenLabels?.[token] ??
      token
        .slice(contentProfile!.classPrefix.length)
        .replace(/^(?:typo|text|bg|font)-/, '')
        .replace(/-/g, ' ');
    const actions: EngineToolbarAction[] = [
      ...(Object.keys(defaults) as EngineActionId[])
        .filter((id) => contentProfile?.id !== 'cms-body-v1' || !extended.includes(id))
        .map(
          (id): EngineToolbarAction => ({
            id,
            label: actionLabels?.[id] ?? defaults[id],
            disabled:
              unavailable ||
              (id === 'undo' && !snapshot.canUndo) ||
              (id === 'redo' && !snapshot.canRedo),
            ...((
              [
                'bold',
                'italic',
                'underline',
                'strike',
                'code',
                'subscript',
                'superscript',
              ] as string[]
            ).includes(id)
              ? { pressed: binding.current?.selectionMarks().includes(id as Mark) ?? false }
              : {}),
            onIntent: (event) => arm(id, event),
            onActivate: () => activate(id),
          }),
        ),
      ...alignTokens.map((token) =>
        classAction('align:' + token, 'Align ' + token.slice(alignPrefix.length), hasClass(token)),
      ),
      ...styleTokens.map((token) => classAction('style:' + token, 'Style: ' + styleName(token))),
      ...(styleTokens.length ? [classAction('style:', 'Reset content style')] : []),
      // Links need a profile: it decides which addresses may be stored and rendered.
      ...(contentProfile
        ? [
            {
              ...classAction('link', 'Link', currentLink !== null),
              disabled: unavailable || (currentLink === null && selectionCollapsed),
            },
            {
              ...classAction('unlink', 'Remove link'),
              disabled: unavailable || currentLink === null,
            },
          ]
        : []),
    ];
    const linkPanel = linkDraft
      ? React.createElement(
          'div',
          {
            role: 'dialog',
            'aria-label': 'Link',
            className: 'inkforge-toolbar-panel inkforge-link-panel',
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelLink();
              }
            },
          },
          React.createElement(
            'label',
            null,
            'Address',
            React.createElement('input', {
              autoFocus: true,
              value: linkDraft.value,
              placeholder: 'https://example.com',
              'aria-invalid': !!linkDraft.error,
              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setLinkDraft({ ...linkDraft, value: event.currentTarget.value, error: '' }),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitLink();
                }
              },
            }),
          ),
          linkDraft.error ? React.createElement('p', { role: 'alert' }, linkDraft.error) : null,
          React.createElement(EditorButton, { type: 'button', onClick: submitLink }, 'Apply'),
          React.createElement(EditorButton, { type: 'button', onClick: cancelLink }, 'Cancel'),
        )
      : null;
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
      linkPanel,
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
