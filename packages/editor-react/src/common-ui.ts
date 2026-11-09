'use client';

import * as React from 'react';
import { Button, Toolbar, useFieldControl, useUiSnapshot } from '@adisaktimtong/ui-component';
import { tokenMetadata } from '@adisaktimtong/ui-component/tokens';
import { InkforgeEngineEditor, type InkforgeEngineEditorProps } from './engine.js';
import { InkForgeEditor, type InkForgeEditorProps } from './index.js';
import {
  EditorInteractionContext,
  issueAdapter,
  type InkforgeUiAdapterV1,
  type EngineToolbarProps,
} from './ui-adapter.js';
export type { InkforgeUiAdapterV1 } from './ui-adapter.js';

const CommonButton = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
  function CommonButton(
    { 'aria-disabled': blocked, 'aria-busy': busy, dangerouslySetInnerHTML: _html, ...props },
    ref,
  ) {
    return React.createElement(Button, {
      ...props,
      ref,
      variant: 'ghost',
      disabled: props.disabled || blocked === true || blocked === 'true',
      loading: busy === true || busy === 'true',
    });
  },
);
function Scope({ children }: { children: React.ReactNode }) {
  const ui = useUiSnapshot();
  return React.createElement(
    EditorInteractionContext.Provider,
    { value: ui },
    React.createElement(
      'div',
      {
        className: 'inkforge-common-ui',
        'data-ui-adapter': 'inkforge',
        'data-ui-adapter-api': '1',
        'data-ui-adapter-context': ui.interactionContextKey,
        'data-ui-adapter-ready': ui.status,
      },
      children,
    ),
  );
}
function CommonEngineToolbar({ label, actions, onKeyDown }: EngineToolbarProps) {
  return React.createElement(
    Toolbar,
    { label, itemIds: actions.map((a) => a.id), className: 'inkforge-toolbar', onKeyDown },
    ...actions.map((action) =>
      React.createElement(
        Button,
        {
          key: action.id,
          toolbarItemId: action.id,
          disabled: action.disabled,
          variant: 'ghost',
          'aria-pressed': action.pressed,
          onTriggerIntent: action.onIntent,
          onClick: action.onActivate,
        },
        action.label,
      ),
    ),
  );
}
export function createInkforgeCommonUiAdapter(): InkforgeUiAdapterV1 {
  if (arguments.length) throw new Error('INVALID_INKFORGE_UI_ADAPTER_OPTIONS');
  return issueAdapter(
    {
      kind: 'inkforge',
      adapterApiVersion: 1,
      uiContractVersion: '0.2.0',
      tokenSourceVersion: '0.2.0',
      cssFingerprint: tokenMetadata.cssFingerprint,
      capabilities: [
        'scopedTheme',
        'nativeButtons',
        'compositeField',
        'legacyHtmlSurface',
        'controllerSurface',
        'engineToolbar',
      ],
    },
    { Button: CommonButton, Scope, EngineToolbar: CommonEngineToolbar },
  );
}

export interface InkforgeFieldEditorProps extends Omit<
  InkForgeEditorProps,
  'id' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required'
> {
  uiAdapter: InkforgeUiAdapterV1;
}
/** Public Field bridge only: IDs/ARIA never acquire HTML, save or history ownership. */
export const InkforgeFieldEditor = React.forwardRef<HTMLDivElement, InkforgeFieldEditorProps>(
  function InkforgeFieldEditor(props, ref) {
    const field = useFieldControl();
    if (field.controlKind !== 'composite')
      throw new Error('InkforgeFieldEditor requires a composite Field');
    return React.createElement(InkForgeEditor, { ...props, ...field.controlProps, ref });
  },
);

export interface InkforgeEngineFieldProps extends Omit<
  InkforgeEngineEditorProps,
  'id' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required'
> {
  uiAdapter: InkforgeUiAdapterV1;
}
export const InkforgeEngineField = React.forwardRef<HTMLDivElement, InkforgeEngineFieldProps>(
  function InkforgeEngineField(props, ref) {
    const field = useFieldControl();
    if (field.controlKind !== 'composite')
      throw new Error('InkforgeEngineField requires a composite Field');
    return React.createElement(InkforgeEngineEditor, { ...props, ...field.controlProps, ref });
  },
);
