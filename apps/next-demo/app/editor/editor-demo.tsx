'use client';

import { useState } from 'react';
import { InkForgeEditor } from '@inkforge/editor-react';
import '@inkforge/editor-react/editor.css';

export function EditorDemo() {
  const [html, setHtml] = useState('<p>Server rendered <strong>draft</strong></p>');
  const [diagnostics, setDiagnostics] = useState<unknown[]>([]);
  return (
    <section>
      <p id="article-label">Article body</p>
      <InkForgeEditor
        toolbar
        aria-labelledby="article-label"
        value={html}
        onChange={setHtml}
        onDiagnostics={setDiagnostics}
      />
      <button onClick={() => setHtml('<p>Reset from Next.js</p>')}>Reset editor</button>
      <pre data-testid="next-html">{html}</pre>
      <pre data-testid="next-diagnostics">{JSON.stringify(diagnostics)}</pre>
    </section>
  );
}
