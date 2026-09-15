# สถาปัตยกรรม Editor Engine

## ขอบเขตของแต่ละส่วน

```text
CMS page form
    |
    v
React adapter -------- toolbar และ theme ที่ประกอบได้
    |
    v
DOM adapter ---------- input, composition, clipboard, DOM/selection mapping
    |
    v
Headless core -------- model, schema, commands, transactions, history, plugins
    |
    +------------------ HTML parser และ serializer
```

DOM เป็นภาพที่สร้างจาก editor state ไม่ใช่แหล่งข้อมูลหลัก Browser event สร้าง command, command สร้าง transaction ที่ผ่านการตรวจสอบ, transaction สร้าง state ใหม่ จากนั้น DOM adapter ปรับ view ให้ตรงกับ state และคืน selection ไปยังตำแหน่งที่ map แล้ว

## โครงสร้าง Package

```text
packages/
  editor-core/
    model/
    schema/
    selection/
    transaction/
    commands/
    history/
    plugins/
  editor-dom/
    input/
    composition/
    clipboard/
    reconciliation/
    selection-mapping/
  editor-html/
    parser/
    serializer/
    normalization/
  editor-react/
    EditorProvider.tsx
    Editable.tsx
    hooks/
    toolbar/
    theme/
```

Engine package ห้าม import จาก `editor-react` ส่วน React package สามารถขึ้นกับ layer ที่ต่ำกว่าได้ทั้งหมด

## Document Model

Block node ของ MVP ประกอบด้วย root, paragraph, heading, blockquote, ordered list, unordered list, list item, code block และ image ส่วน text มี mark ได้ตั้งแต่ศูนย์รายการขึ้นไป ได้แก่ bold, italic, underline, strikethrough และ link

ทุก node มี runtime identifier ที่คงที่สำหรับ selection mapping และ transaction Identifier นี้เป็น metadata ระหว่างแก้ไขและไม่ปรากฏใน HTML ทั่วไป เว้นแต่ plugin ต้องการ persistent identity อย่างชัดเจน

Schema ตรวจสอบความสัมพันธ์ parent-child, attribute ที่จำเป็น, mark ที่ใช้ได้ และ normalization rule หลังทุก transaction หาก transaction ไม่ถูกต้องต้องล้มเหลวโดยไม่แก้ state เพียงบางส่วน

## State และ Transaction

```ts
interface EditorState {
  doc: RootNode
  selection: EditorSelection | null
  revision: number
}

interface Transaction {
  baseRevision: number
  operations: Operation[]
  selection?: EditorSelection | null
  metadata?: Record<string, unknown>
}
```

Command แสดงเจตนา เช่น `insertText`, `splitBlock`, `deleteBackward`, `toggleMark`, `setBlockType`, `wrapInList`, `insertImage`, `undo` และ `redo` จากนั้น core แปลง command เป็น operation และ commit transaction แบบ atomic

History เก็บชุด transaction ที่ย้อนกลับได้แทน DOM snapshot การพิมพ์ต่อเนื่องและ composition สามารถรวมเป็นกลุ่มเดียว ส่วน structural edit ต้องเป็น undo boundary แยกกัน

## Selection และ Input

Core ใช้ model position ที่ไม่ขึ้นกับ DOM node ส่วน DOM adapter ดูแล mapping สองทางระหว่าง model position กับ browser range

การรับ input ครอบคลุม `beforeinput`, keyboard command, composition start/update/end, paste, cut, drop policy, pointer selection และการตรวจ DOM mutation ข้อความระหว่าง composition ต้องไม่ถูก normalize หรือ commit เป็น history step แยกกันจนกว่า composition จะสิ้นสุด

## สัญญาของ Plugin

```ts
interface EditorPlugin {
  name: string
  nodes?: NodeDefinition[]
  marks?: MarkDefinition[]
  commands?: CommandDefinition[]
  keymap?: Record<string, string>
  parseHtml?: HtmlParseRule[]
  serializeHtml?: HtmlSerializeRule[]
  normalize?: NormalizationRule[]
  onTransaction?(event: TransactionEvent): void
}
```

Plugin ใช้ public state reader และ command dispatch เท่านั้น ห้ามแก้ state, DOM, selection map หรือ history โดยตรง ชื่อ plugin, node และ command ต้องไม่ซ้ำกันภายใน editor instance หากเกิดการชนกันต้องแจ้งข้อผิดพลาดระหว่างสร้าง editor

Acceptance plugin คือ callout block ที่มี attribute `tone` และต้องติดตั้งได้โดยไม่แก้ core หรือ built-in package

## Public API สำหรับ React

```tsx
<RichTextEditor
  initialHtml={page.contentHtml}
  plugins={plugins}
  uploadImage={uploadImage}
  onChange={({ html, isEmpty, revision }) => updateField(html)}
  onDirtyChange={setDirty}
/>
```

```ts
interface RichTextEditorRef {
  focus(): void
  getHtml(): string
  setHtml(html: string): void
  clear(): void
  undo(): void
  redo(): void
}
```

Adapter เปิดเผยเฉพาะ type ที่ผลิตภัณฑ์เป็นเจ้าของ Internal node, transaction, DOM และ selection representation ไม่เป็นส่วนหนึ่งของ public API

## การทำงานร่วมกับ Next.js

Interactive editor export จาก entry point ที่ระบุเป็น client และ host application สามารถโหลดแบบ dynamic โดยปิด SSR ส่วน HTML parsing utility ที่พึ่งพา browser DOM ต้องเป็น client-only เช่นกัน เว้นแต่จะสร้าง server-safe parser แยกอย่างตั้งใจ

หน้าเว็บไซต์สาธารณะรับ HTML ที่ผ่านการ sanitize แล้ว และไม่ import `editor-react`, `editor-dom` หรือ editor CSS นอกเหนือจาก typography กลางสำหรับเนื้อหา

## ลำดับการพิสูจน์ระบบ

1. พิมพ์ paragraph ผ่าน browser input แล้วได้ model state และ deterministic HTML
2. เลือกช่วงข้อความ ทำ bold transaction, undo, redo, export และโหลดกลับ
3. พิมพ์ภาษาไทยผ่าน IME โดยข้อความระหว่างทางไม่เสียหายและ history ไม่แตกเป็นส่วนเกิน
4. สร้าง list และตรวจพฤติกรรม Enter/Backspace ที่ขอบ รวมถึง selection ข้าม block
5. Rich paste ผ่าน allowlisted parsing และ normalization
6. ติดตั้ง callout plugin และนำ semantic HTML เข้า/ออกโดยไม่แก้ core
7. เชื่อมกับ React form และพิสูจน์ Next.js client boundary
