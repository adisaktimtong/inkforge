import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InkForgeEditor } from '@inkforge/editor-react';
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
        <InkForgeEditor
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

createRoot(document.getElementById('root')!).render(<Playground />);
