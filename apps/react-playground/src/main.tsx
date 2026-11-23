import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InkForgeEditor } from '@inkforge/editor-react';
import { createContentProfile, serializeHtml } from '@inkforge/editor-html';
import { InkforgeEngineEditor } from '@inkforge/editor-react/engine';
import {
  createDocument,
  createEngine,
  createLink,
  createParagraph,
  createText,
} from '@inkforge/editor-core';
import { useSyncExternalStore } from 'react';
import '@inkforge/editor-content/content.css';
import '@inkforge/editor-react/editor.css';
import './playground.css';

const initial = '<p>Hello <strong>InkForge</strong></p>';
const unsafe =
  '<p onclick="alert(1)">Safe <a href="javascript:alert(1)">link</a></p><script>alert(1)</script>';

function Playground() {
  const [value, setValue] = useState(initial);
  const [uncontrolled, setUncontrolled] = useState('');
  const [defaultValue, setDefaultValue] = useState('<p>Uncontrolled draft</p>');
  const [diagnostics, setDiagnostics] = useState<unknown[]>([]);
  const [diagnosticCalls, setDiagnosticCalls] = useState(0);
  const [changes, setChanges] = useState(0);
  const [renders, setRenders] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const uncontrolledEditor = useRef<HTMLDivElement>(null);
  const [rejectEdits, setRejectEdits] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  return (
    <main>
      <h1>InkForge editor playground</h1>
      <p>A native HTML editing surface for CMS forms. Labels and output belong to the host.</p>
      <section aria-labelledby="controlled-heading">
        <h2 id="controlled-heading">Controlled editor</h2>
        <div className="actions">
          <button onClick={() => setValue(initial)}>Reset controlled</button>
          <button onClick={() => setValue('<h2>External replacement</h2><p>New draft</p>')}>
            Replace value
          </button>
          <button onClick={() => setValue(unsafe)}>Load unsafe HTML</button>
          <button onClick={() => setValue('')}>Clear controlled</button>
          <button onClick={() => setValue('<p><br></p>')}>Load hard break</button>
          <button onClick={() => setRenders((n) => n + 1)}>Rerender parent ({renders})</button>
          <button onClick={() => editor.current?.focus()}>Focus editor</button>
          <button onClick={() => setShowToolbar((show) => !show)}>Toggle toolbars</button>
        </div>
        <label>
          <input
            type="checkbox"
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />
          Disabled
        </label>
        <label>
          <input
            type="checkbox"
            checked={readOnly}
            onChange={(event) => setReadOnly(event.target.checked)}
          />
          Read only
        </label>
        <label>
          <input
            type="checkbox"
            checked={rejectEdits}
            onChange={(event) => setRejectEdits(event.target.checked)}
          />
          Reject controlled edits
        </label>
        <p id="controlled-label">Article body</p>
        <InkForgeEditor
          toolbar={showToolbar}
          ref={editor}
          aria-labelledby="controlled-label"
          aria-describedby="controlled-help"
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(html) => {
            if (!rejectEdits) setValue(html);
            setChanges((n) => n + 1);
          }}
          onDiagnostics={(items) => {
            setDiagnostics(items);
            setDiagnosticCalls((count) => count + 1);
          }}
        />
        <p id="controlled-help">Type or paste formatted content. Unsafe markup is removed.</p>
        <p>
          Committed edits: <output data-testid="change-count">{changes}</output>
        </p>
        <h3>Sanitized HTML</h3>
        <pre data-testid="controlled-html">{value}</pre>
        <p>
          Diagnostics callbacks: <output data-testid="diagnostic-count">{diagnosticCalls}</output>
        </p>
        <h3>Diagnostics</h3>
        <pre data-testid="diagnostics">{JSON.stringify(diagnostics, null, 2)}</pre>
      </section>
      <section>
        <h2>Uncontrolled editor</h2>
        <button onClick={() => setDefaultValue('<p>Changed default</p>')}>
          Change default prop
        </button>
        <button onClick={() => uncontrolledEditor.current?.focus()}>
          Focus uncontrolled editor
        </button>
        <InkForgeEditor
          ref={uncontrolledEditor}
          toolbar={showToolbar}
          aria-label="Uncontrolled article"
          defaultValue={defaultValue}
          onChange={setUncontrolled}
        />
        <pre data-testid="uncontrolled-html">{uncontrolled}</pre>
      </section>
      <section>
        <h2>Fixed controlled value</h2>
        <InkForgeEditor aria-label="Fixed article" value="<p>Fixed draft</p>" />
      </section>
      <section>
        <h2>Empty editor</h2>
        <InkForgeEditor aria-label="Empty article" />
      </section>
    </main>
  );
}

// Strict CMS body profile with alignment classes, a brand colour and sub/superscript.
const cmsProfile = createContentProfile({
  id: 'cms-body-v2',
  tokenClasses: [
    'rte-align-left',
    'rte-align-center',
    'rte-align-right',
    'rte-align-justify',
    'rte-text-brand',
  ],
});
function ProfilePlayground() {
  const [value, setValue] = useState('<p>First paragraph</p><p>H2O and x2</p>');
  return (
    <main>
      <h1>CMS body profile</h1>
      <InkForgeEditor
        toolbar
        className="inkforge-content"
        aria-label="CMS body"
        profile={cmsProfile}
        value={value}
        onChange={setValue}
      />
      <pre data-testid="cms-html">{value}</pre>
    </main>
  );
}

const engineMode = new URLSearchParams(location.search).get('engine');
// Controller-based editing surface: the toolbar issues model commands instead of editing the DOM.
const engine = createEngine({
  document: createDocument(
    // ?engine=styled starts from content that carries a class and a link.
    engineMode === 'styled' || engineMode === 'nopolicy'
      ? [
          createParagraph(
            [
              createText('Read '),
              createLink('https://example.com/a', [createText('the guide')]),
              createText(' first'),
            ],
            { className: 'rte-align-center' },
          ),
        ]
      : [
          createParagraph([createText('First paragraph')]),
          createParagraph([createText('Second paragraph')]),
        ],
  ),
  instanceId: 'playground-engine',
  clock: () => Date.now(),
  // Backspace and Delete need grapheme and word boundaries from the host.
  segmentation: {
    locale: 'en',
    fingerprint: 'intl-segmenter-en',
    boundaries(text, unit) {
      const points = [0];
      for (const part of new Intl.Segmenter('en', { granularity: unit }).segment(text))
        points.push(part.index + part.segment.length);
      return points;
    },
  },
  origin: 'persisted',
});
function EnginePlayground() {
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return (
    <main>
      <h1>Engine surface</h1>
      <InkforgeEngineEditor
        controller={engine}
        aria-label="Engine body"
        className="inkforge-content"
        {...(engineMode === 'nopolicy' ? {} : { contentProfile: cmsProfile })}
        // ?engine=picker stands in for a host that offers its own pages instead of a typed address.
        {...(engineMode === 'picker'
          ? {
              requestLink: async () => 'cms-ref:content:c3e6b3d2-6fbd-4c63-a7da-05be2b79d256',
            }
          : {})}
      />
      <pre data-testid="engine-html">
        {serializeHtml(snapshot.document, { referenceLinks: true })}
      </pre>
    </main>
  );
}

const query = new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(
  query.get('engine') ? (
    <EnginePlayground />
  ) : query.get('profile') === 'cms-body-v2' ? (
    <ProfilePlayground />
  ) : (
    <Playground />
  ),
);
