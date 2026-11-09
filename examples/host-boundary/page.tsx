'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createEngine, createDocument, createParagraph, createText } from '@inkforge/editor-core';
import { createContentProfile } from '@inkforge/editor-html';
import { parseContentHtml } from '@inkforge/editor-html/browser';
import { createEngineContentCodec } from '@inkforge/editor-html/engine';
import {
  createEngineFieldBinding,
  createStandaloneHostField,
  type PublicHostFieldPort,
} from '@inkforge/editor-react/host';
import { InkforgeEngineEditor, type EngineSurfaceHandle } from '@inkforge/editor-react/engine';
import { createInkforgeCommonUiAdapter } from '@inkforge/editor-react/common-ui';
import { UiProvider, Button } from '@adisaktimtong/ui-component';
import { createCore } from '@pagebuilder/headless/core';
import {
  builtInDefinitions,
  demoSiteConfiguration,
  type ElementDefinition,
} from '@pagebuilder/headless/definitions';
import { createBoundFieldPort } from '@pagebuilder/headless/editor/field-binding';
const uiAdapter = createInkforgeCommonUiAdapter();
function makeRuntime(kind: 'standalone' | 'builder') {
  const codec = createEngineContentCodec(createContentProfile(), parseContentHtml);
  const segments = {
    grapheme: new Intl.Segmenter('th', { granularity: 'grapheme' }),
    word: new Intl.Segmenter('th', { granularity: 'word' }),
  };
  const controller = createEngine({
    document: createDocument([createParagraph([createText('base')])]),
    origin: 'persisted',
    instanceId: kind,
    clock: () => performance.now(),
    segmentation: {
      locale: 'th',
      fingerprint: 'fixture-intl/browser',
      boundaries: (text, unit) => [
        ...Array.from(segments[unit].segment(text), (s) => s.index),
        text.length,
      ],
    },
  });
  const state = {
    surface: null as EngineSurfaceHandle | null,
    lastSurface: { phase: 'ready', pending: false },
    authorized: true,
    delay: false,
    release: null as null | (() => void),
  };
  let core: import('@pagebuilder/headless/core').Core | null = null;
  let underlying: PublicHostFieldPort & { dispose(): void; suspend(): void };
  if (kind === 'standalone')
    underlying = createStandaloneHostField({
      codec,
      fieldBindingId: kind,
      interactionContextKey: 'owner-a',
      html: '<p>base</p>',
      isAuthorized: () => state.authorized,
    });
  else {
    const definition: ElementDefinition = {
      type: 'cms.richText',
      version: 1,
      capabilities: [],
      slots: {},
      properties: {
        html: {
          type: 'string',
          required: true,
          responsive: false,
          bindable: false,
          tokens: [],
          control: 'text',
          default: { kind: 'literal', value: '<p>base</p>' },
        },
        contentProfile: {
          type: 'enum',
          values: ['cms-body-v1'],
          required: true,
          responsive: false,
          bindable: false,
          tokens: [],
          control: 'select',
          default: { kind: 'literal', value: 'cms-body-v1' },
        },
      },
    };
    const result = createCore({
      definitions: [...builtInDefinitions, definition],
      siteConfiguration: demoSiteConfiguration,
    });
    if (result.status !== 'created') throw Error('FIXTURE_CORE');
    core = result.core;
    core.createDocument({ expectedSessionId: null });
    const inserted = core.executeTransaction({
      expectedSessionId: core.getSnapshot().sessionId!,
      operations: [
        {
          opKey: 'section',
          kind: 'insertNode',
          type: 'core.section',
          destination: { kind: 'root', placement: { kind: 'append' } },
        },
        {
          opKey: 'body',
          kind: 'insertNode',
          type: 'cms.richText',
          destination: {
            kind: 'slot',
            parent: { kind: 'created', opKey: 'section' },
            slotName: 'content',
            placement: { kind: 'append' },
          },
        },
      ],
    });
    if (inserted.status !== 'committed') throw Error('FIXTURE_INSERT');
    core.loadDocument({
      expectedSessionId: core.getSnapshot().sessionId,
      input: core.getSnapshot().document,
      origin: 'persisted',
    });
    underlying = createBoundFieldPort({
      core,
      nodeId: inserted.created.body!,
      nodeType: 'cms.richText',
      htmlProperty: 'html',
      profileProperty: 'contentProfile',
      profile: codec.profile,
      fieldBindingId: kind,
      bindingEpoch: 1,
      interactionContextKey: 'owner-a',
      captureContextFence: () => 'original-owner',
      isContextFenceCurrent: () => state.authorized,
      validate: (html) => {
        const r = codec.decode(html);
        return r.status === 'accepted' ? [] : r.diagnostics;
      },
    });
  }
  const host: PublicHostFieldPort = {
    getSnapshot: underlying.getSnapshot,
    subscribe: underlying.subscribe,
    captureFence: underlying.captureFence,
    isContextCurrent: underlying.isContextCurrent,
    isFenceCurrent: underlying.isFenceCurrent,
    async submitFieldEdit(edit) {
      const ack = await underlying.submitFieldEdit(edit);
      if (state.delay)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      return ack;
    },
  };
  const binding = createEngineFieldBinding({
    controller,
    hostField: host,
    codec,
    surfaceStatus: () => state.surface?.getStatus() ?? state.lastSurface,
  });
  return { controller, host, binding, state, core, underlying, codec };
}
type Runtime = ReturnType<typeof makeRuntime>;
function Surface({ runtime: r, kind }: { runtime: Runtime; kind: string }) {
  const [mounted, setMounted] = useState(true);
  const snapshot = useSyncExternalStore(
    r.controller.subscribe,
    r.controller.getSnapshot,
    r.controller.getSnapshot,
  );
  const status = useSyncExternalStore(
    r.binding.subscribe,
    r.binding.getStatus,
    r.binding.getStatus,
  );
  useEffect(() => {
    const probe = {
      runtime: r,
      flush: () => r.binding.flush(),
      prepare: () => r.binding.prepareField(),
      hide: () => setMounted(false),
      show: () => setMounted(true),
      delay: () => {
        r.state.delay = true;
      },
      release: () => {
        r.state.delay = false;
        r.state.release?.();
      },
      revoke: () => {
        r.state.authorized = false;
      },
      dispose: () => r.underlying.dispose(),
      summary: () => ({
        controller: r.controller.getSnapshot(),
        host: r.host.getSnapshot(),
        binding: r.binding.getStatus(),
        core: r.core?.getSnapshot() ?? null,
      }),
    };
    (window as any).u07d ??= {};
    (window as any).u07d[kind] = probe;
    return () => {
      delete (window as any).u07d?.[kind];
    };
  }, [r, kind]);
  return (
    <section data-testid={kind}>
      <h2>{kind}</h2>
      {mounted && (
        <InkforgeEngineEditor
          controller={r.controller}
          uiAdapter={uiAdapter}
          captureHostFence={r.binding.captureHostFence}
          surfaceRef={(handle) => {
            if (r.state.surface) r.state.lastSurface = r.state.surface.getStatus();
            r.state.surface = handle;
          }}
          onSurfaceStatusChange={(s) => {
            r.state.lastSurface = s;
          }}
          aria-label={`${kind} content`}
        />
      )}
      <Button onClick={() => void r.binding.flush()}>Deliver {kind}</Button>
      <output data-testid={`${kind}-revision`}>{snapshot.revision}</output>
      <output data-testid={`${kind}-delivery`}>{status.delivery}</output>
    </section>
  );
}
export default function Page() {
  const [runtimes, setRuntimes] = useState<Runtime[] | null>(null),
    once = useRef<Runtime[] | null>(null);
  useEffect(() => {
    once.current ??= [makeRuntime('standalone'), makeRuntime('builder')];
    setRuntimes(once.current);
  }, []);
  return (
    <UiProvider
      interactionContextKey="owner-a"
      theme={{ id: 'default-light', version: '0.1.0' }}
      themeStrategy="nonceStyle"
      styleNonce="host-fixture"
      locale="th-TH"
      dir="ltr"
    >
      {runtimes ? (
        runtimes.map((runtime, i) => (
          <Surface key={i} runtime={runtime} kind={i ? 'builder' : 'standalone'} />
        ))
      ) : (
        <p>Preparing editors</p>
      )}
    </UiProvider>
  );
}
