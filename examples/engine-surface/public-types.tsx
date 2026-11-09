import { createEngine, createDocument } from '@inkforge/editor-core';
import { InkforgeEngineEditor, type EngineSurfaceHandle } from '@inkforge/editor-react/engine';
import {
  InkforgeEngineField,
  createInkforgeCommonUiAdapter,
  type InkforgeEngineFieldProps,
} from '@inkforge/editor-react/common-ui';
import { createRef } from 'react';
const controller = createEngine({
  instanceId: 'typed-engine',
  origin: 'unsaved',
  clock: () => 0,
  document: createDocument(),
});
const native = createRef<HTMLDivElement>(),
  surface = createRef<EngineSurfaceHandle>();
const valid = <InkforgeEngineEditor controller={controller} ref={native} surfaceRef={surface} />;
// @ts-expect-error the controller is required
const absent = <InkforgeEngineEditor />;
// @ts-expect-error legacy HTML value cannot create a second editing authority
const value = <InkforgeEngineEditor controller={controller} value="<p>x</p>" />;
// @ts-expect-error legacy initial values cannot bypass the controller
const initial = <InkforgeEngineEditor controller={controller} defaultValue="x" />;
// @ts-expect-error a DOM-change callback is not the model transaction interface
const callback = <InkforgeEngineEditor controller={controller} onChange={() => {}} />;
const button = (
  // @ts-expect-error native forwarded ref remains an HTMLDivElement ref
  <InkforgeEngineEditor controller={controller} ref={createRef<HTMLButtonElement>()} />
);
// @ts-expect-error the separate surface handle is not a controller or a native div
const ref = <InkforgeEngineEditor controller={controller} surfaceRef={native} />;
// @ts-expect-error native input events are reserved for the single DOM owner
const onInput = <InkforgeEngineEditor controller={controller} onInput={() => {}} />;
// @ts-expect-error native composition events are reserved for the single DOM owner
const composition = <InkforgeEngineEditor controller={controller} onCompositionEnd={() => {}} />;
// @ts-expect-error component parts are privately composed
const parts = <InkforgeEngineEditor controller={controller} parts={{}} />;
const field: InkforgeEngineFieldProps = {
  controller,
  uiAdapter: createInkforgeCommonUiAdapter(),
  // @ts-expect-error composite Field owns its control id
  id: 'conflict',
};
void [valid, absent, value, initial, callback, button, ref, onInput, composition, parts, field];
