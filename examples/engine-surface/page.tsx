'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  createEngine,
  createDocument,
  createParagraph,
  createText,
  createLink,
  type EngineController,
} from '@inkforge/editor-core';
import { InkforgeEngineEditor, type EngineSurfaceHandle } from '@inkforge/editor-react/engine';
import {
  createInkforgeCommonUiAdapter,
  InkforgeEngineField,
} from '@inkforge/editor-react/common-ui';
import {
  UiProvider,
  Button,
  Field,
  FieldLabel,
  FieldDescription,
} from '@adisaktimtong/ui-component';
const uiAdapter = createInkforgeCommonUiAdapter();
const initialDocument = () => createDocument([createParagraph([createText('สวัสดี editor')])]);
const plain = (node: {
  type: string;
  text?: string;
  children?: readonly unknown[];
  items?: readonly unknown[];
}): string =>
  node.type === 'text'
    ? (node.text ?? '')
    : node.type === 'hard-break'
      ? '\n'
      : (node.children ?? node.items ?? [])
          .map((n) => plain(n as Parameters<typeof plain>[0]))
          .join('|');
function make(instanceId: string): EngineController {
  const segmenters = {
    grapheme: new Intl.Segmenter('th', { granularity: 'grapheme' }),
    word: new Intl.Segmenter('th', { granularity: 'word' }),
  };
  return createEngine({
    instanceId,
    document: initialDocument(),
    origin: 'persisted',
    clock: () => performance.now(),
    segmentation: {
      locale: 'th',
      fingerprint: 'fixture-intl/browser',
      boundaries: (text, unit) => [
        ...Array.from(segmenters[unit].segment(text), (segment) => segment.index),
        text.length,
      ],
    },
  });
}
export default function Page() {
  const [controller] = useState(() => make('engine-main'));
  const [other] = useState(() => make('engine-other'));
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [context, setContext] = useState('owner-A'),
    [theme, setTheme] = useState(false),
    [compact, setCompact] = useState(false),
    [mounted, setMounted] = useState(true),
    [toolbar, setToolbar] = useState(true),
    [disabled, setDisabled] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string[]>([]),
    [status, setStatus] = useState('ready');
  const surface = useRef<EngineSurfaceHandle>(null),
    div = useRef<HTMLDivElement>(null);
  const owner = useRef(context);
  owner.current = context;
  const captures = useRef(0),
    mountedCount = useRef(0),
    cleanups = useRef(0);
  useEffect(() => {
    mountedCount.current++;
    const probe = {
      controller,
      other,
      snapshot: () => controller.getSnapshot(),
      surface: () => surface.current?.getStatus(),
      checkpoint: () => controller.captureCheckpoint({ expected: controller.getSnapshot().token }),
      context: () => setContext((x) => (x === 'owner-A' ? 'owner-B' : 'owner-A')),
      presentation: () => {
        setTheme((x) => !x);
        setCompact((x) => !x);
      },
      toggleMount: () => setMounted((x) => !x),
      disabled: () => setDisabled((x) => !x),
      replace: () =>
        controller.loadExternal(
          createDocument([createParagraph([createText('Replacement')])]),
          'unsaved',
          { expected: controller.getSnapshot().token },
        ),
      discard: () => surface.current?.discardDraft(),
      move: () => {
        const s = controller.getSnapshot(),
          node = Object.values(s.nodeIndex).find((n) => n.node.type === 'text')!;
        const p = { nodeId: node.id, offset: 1, affinity: 'forward' as const };
        return controller.setSelection({ anchor: p, head: p }, { expected: s.token });
      },
      policy: () => {
        const s = controller.getSnapshot();
        return controller.loadExternal(
          createDocument([
            createParagraph([
              createLink('javascript:window.bad=true', [
                createText('Policy-held', [], { style: 'color:red' }),
              ]),
            ]),
          ]),
          'unsaved',
          { expected: s.token },
        );
      },
      cleanup: () => ({ setups: mountedCount.current, cleanups: cleanups.current }),
      captures: () => captures.current,
    };
    Object.assign(window, { u07c: probe });
    return () => {
      cleanups.current++;
      delete (window as Window & { u07c?: unknown }).u07c;
    };
  }, [controller, other]);
  return (
    <>
      <p>
        U07-C actual controller-owned surface. Model operations own history; host acknowledgment
        remains gated.
      </p>
      <output data-testid="model">{JSON.stringify(snapshot.document)}</output>
      <output data-testid="revision">{snapshot.revision}</output>
      <output data-testid="epoch">{snapshot.selectionEpoch}</output>
      <output data-testid="composing">{String(snapshot.composing)}</output>
      <output data-testid="status">{status}</output>
      <output data-testid="disposed">{String(snapshot.disposed)}</output>
      <output data-testid="diagnostics">{diagnostics.join(',')}</output>
      <UiProvider
        scopeId="engine-main"
        theme={{
          id: 'default-light',
          version: '0.1.0',
          ...(theme ? { overrides: { action: '#1D4ED8' as const } } : {}),
        }}
        themeStrategy="nonceStyle"
        styleNonce="engine-fixture"
        locale="th-TH"
        dir="ltr"
        interactionContextKey={context}
        density={compact ? 'compact' : 'comfortable'}
      >
        <Button onClick={() => setToolbar((x) => !x)}>Toggle toolbar</Button>
        <Button onClick={() => setMounted((x) => !x)}>Toggle surface</Button>
        <Button onClick={() => surface.current?.discardDraft()}>Discard draft</Button>
        {mounted && (
          <Field controlKind="composite">
            <FieldLabel>Engine body</FieldLabel>
            <FieldDescription>Controller-owned rich text</FieldDescription>
            <InkforgeEngineField
              controller={controller}
              ref={div}
              surfaceRef={surface}
              uiAdapter={uiAdapter}
              toolbar={toolbar}
              disabled={disabled}
              captureHostFence={() => {
                captures.current++;
                const captured = owner.current;
                return { reference: captured, isCurrent: (ticket) => owner.current === ticket };
              }}
              onDiagnostic={(d) => setDiagnostics((v) => [...v, d.code])}
              onSurfaceStatusChange={(s) => setStatus(s.phase)}
            />
          </Field>
        )}
      </UiProvider>
      <section aria-label="Independent native surface">
        <InkforgeEngineEditor
          controller={other}
          aria-label="Other engine"
          captureHostFence={() => {
            const captured = owner.current;
            return { reference: captured, isCurrent: (ticket) => owner.current === ticket };
          }}
        />
      </section>
    </>
  );
}
