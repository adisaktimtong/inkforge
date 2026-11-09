import * as React from 'react';

declare const adapterBrand: unique symbol;
export interface InkforgeUiAdapterV1 {
  readonly [adapterBrand]: true;
  readonly kind: 'inkforge';
  readonly metadata: Readonly<{
    kind: 'inkforge';
    adapterApiVersion: 1;
    uiContractVersion: '0.2.0';
    tokenSourceVersion: '0.2.0';
    cssFingerprint: string;
    capabilities: readonly string[];
  }>;
}
type ButtonProps = React.ComponentPropsWithoutRef<'button'> & { [key: `data-${string}`]: unknown };
type NativeButton = ButtonProps & React.RefAttributes<HTMLButtonElement>;
interface Presentation {
  readonly Button: React.ComponentType<NativeButton>;
  readonly Scope: React.ComponentType<{ children: React.ReactNode }>;
  readonly EngineToolbar?: React.ComponentType<EngineToolbarProps>;
}
const issued = new WeakMap<object, Presentation>();
const Context = React.createContext<Presentation | null>(null);
export const EditorInteractionContext = React.createContext<Readonly<{
  interactionContextKey: string;
  status: 'pending' | 'ready';
}> | null>(null);
export function issueAdapter(
  metadata: InkforgeUiAdapterV1['metadata'],
  parts: Presentation,
): InkforgeUiAdapterV1 {
  const descriptor = Object.freeze({
    kind: 'inkforge' as const,
    metadata: Object.freeze({
      ...metadata,
      capabilities: Object.freeze([...metadata.capabilities]),
    }),
  });
  issued.set(descriptor, Object.freeze(parts));
  return descriptor as InkforgeUiAdapterV1;
}
export function EditorUiBoundary({
  adapter,
  children,
}: {
  adapter?: InkforgeUiAdapterV1 | undefined;
  children: React.ReactNode;
}) {
  const initial = React.useRef(adapter);
  if (initial.current !== adapter)
    throw new Error('Remount InkForgeEditor when changing uiAdapter');
  const presentation = adapter === undefined ? null : issued.get(adapter);
  if (presentation === undefined) throw new Error('INVALID_INKFORGE_UI_ADAPTER');
  const content = React.createElement(Context.Provider, { value: presentation }, children);
  return presentation ? React.createElement(presentation.Scope, null, content) : content;
}
export const EditorButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function EditorButton(props, ref) {
    const presentation = React.useContext(Context);
    return React.createElement(presentation?.Button ?? 'button', { ...props, ref });
  },
);

export interface EngineToolbarIntent {
  preventDefault(): void;
}
export interface EngineToolbarAction {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly pressed?: boolean;
  onIntent(event: EngineToolbarIntent): undefined;
  onActivate(): void;
}
export interface EngineToolbarProps {
  readonly label: string;
  readonly actions: readonly EngineToolbarAction[];
  readonly onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
}
export function EditorEngineToolbar(props: EngineToolbarProps) {
  const presentation = React.useContext(Context);
  if (presentation?.EngineToolbar) return React.createElement(presentation.EngineToolbar, props);
  return React.createElement(
    'div',
    { role: 'toolbar', 'aria-label': props.label, className: 'inkforge-toolbar' },
    ...props.actions.map((action) =>
      React.createElement(
        'button',
        {
          key: action.id,
          type: 'button',
          disabled: action.disabled,
          'aria-pressed': action.pressed,
          onPointerDown: (event) => {
            if (event.button === 0) action.onIntent(event);
          },
          onKeyDown: (event) => {
            if (!event.nativeEvent.isComposing && ['Enter', ' '].includes(event.key))
              action.onIntent(event);
          },
          onClick: action.onActivate,
        },
        action.label,
      ),
    ),
  );
}
