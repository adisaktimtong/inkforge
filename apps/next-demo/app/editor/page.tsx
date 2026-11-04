import { EditorDemo } from './editor-demo.js';

export default function EditorPage() {
  return (
    <main>
      <h1>Next.js editor integration</h1>
      <p>This editor renders on the server and hydrates as a client component.</p>
      <EditorDemo />
    </main>
  );
}
