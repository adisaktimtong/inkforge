# สถาปัตยกรรม Editor Engine

> **หมายเหตุสถานะ:** เอกสารนี้ยังอธิบาย document model และ integration contract ที่ใช้ร่วมกัน แต่การตัดสินใจเรื่อง package boundary, technology stack, security, testing, release และ rollout ให้ยึด [`architecture-spine/ARCHITECTURE-SPINE.md`](architecture-spine/ARCHITECTURE-SPINE.md) เป็นหลักเมื่อมีความขัดแย้ง

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
    +------------------ HTML parser, serializer และ validation
    |
    +------------------ accessibility และ content SEO checkers

CMS preview ----------- versioned content.css ----------- website renderer
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
    validation/
    raw-html/
  editor-checks/
    accessibility/
    seo/
  editor-source/
    SourceEditor.tsx
    diagnostics/
  editor-react/
    EditorProvider.tsx
    Editable.tsx
    hooks/
    toolbar/
    styles/editor.css
  editor-content/
    content.css
    token-registry.ts
```

Engine package ห้าม import จาก `editor-react` ส่วน React package สามารถขึ้นกับ layer ที่ต่ำกว่าได้ทั้งหมด

## Document Model

Block node ของ MVP ประกอบด้วย root, paragraph, heading, blockquote, ordered list, unordered list, list item, code block, image และ `RawHtmlNode` ส่วน text มี mark ได้ตั้งแต่ศูนย์รายการขึ้นไป ได้แก่ bold, italic, underline, strikethrough, link และ style token ที่ผ่านการตรวจสอบแล้ว Block ที่รองรับสามารถมี background token จาก registry ของ consumer

Document model เก็บ semantic token ID เช่น `body`, `lead`, `text-primary` และ `surface-warning` ไม่เก็บ CSS value, class prefix หรือ breakpoint ค่า mobile/desktop และ line-height เป็นหน้าที่ของ versioned content stylesheet Effective `classPrefix` เป็น immutable adapter/serialization configuration และมีค่าเริ่มต้นเป็น `rte-`

`RawHtmlNode` เก็บ valid safe body HTML ที่ visual schema ไม่รู้จักแบบ lossless เป็น read-only node Visual mode ห้ามแก้ภายใน node โดยตรง และ Source mode เป็นช่องทางแก้เนื้อหานั้น

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
  customization={{
    classPrefix: 'rte-',
    styles: styleOptions,
  }}
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
  captureSelection(): SelectionBookmark | null
  restoreSelection(bookmark: SelectionBookmark): boolean
}
```

Adapter เปิดเผยเฉพาะ type ที่ผลิตภัณฑ์เป็นเจ้าของ Internal node, transaction, DOM และ selection representation ไม่เป็นส่วนหนึ่งของ public API

Toolbar และ menu เป็น React composition layer ที่แยกจาก engine Consumer สามารถเก็บ selection ก่อนเปิด modal หรือ UI ภายนอก คืน selection เมื่อยืนยัน แล้วใช้ editor handle หรือ hook เพื่อ dispatch เฉพาะ command ที่ลงทะเบียนไว้ Bookmark ผูกกับ editor instance และต้อง map ผ่าน transaction ที่เกิดขึ้นระหว่าง modal เปิดอยู่หรือคืนค่า `false` เมื่อใช้ต่อไม่ได้ รายละเอียดอยู่ใน `customization.md`

## การทำงานร่วมกับ Next.js

Interactive editor export จาก entry point ที่ระบุเป็น client และ host application สามารถโหลดแบบ dynamic โดยปิด SSR ส่วน HTML parsing utility ที่พึ่งพา browser DOM ต้องเป็น client-only เช่นกัน เว้นแต่จะสร้าง server-safe parser แยกอย่างตั้งใจ

CMS import ทั้ง `editor.css` และ `content.css` ส่วนหน้าเว็บไซต์สาธารณะ import เฉพาะ `content.css` และรับ HTML ที่ผ่านการ sanitize แล้ว โดยไม่ import `editor-react`, `editor-dom` หรือ editor UI CSS ทั้งสองฝั่งต้องใช้ effective class prefix เดียวกับ parser/serializer และ sanitizer

Token class เป็น public HTML contract การเปิด token ใหม่ใช้ลำดับ deploy: เพิ่ม CSS รองรับบนเว็บไซต์ก่อน เปิดใช้ token ใน CMS จากนั้น migrate เนื้อหาเก่า และถอด alias เดิมได้เฉพาะใน major version หลัง migration เสร็จ

## Source Mode และ Content Checks

Source mode serialize snapshot ปัจจุบันเป็น HTML และแก้บน working copy แยกจาก document state การ Apply ต้องผ่าน syntax validation, executable-content policy และ parsing ทั้งหมดก่อนสร้าง transaction เดียว หากขั้นตอนใดล้มเหลว document และ history เดิมต้องไม่เปลี่ยน

Parser แปลง node ที่ schema รองรับเป็น structured node และเก็บ safe unsupported subtree เป็น `RawHtmlNode` Checker ทำงานกับ document snapshot เดียวกัน คืน issue ที่อ้าง `nodeId` และไม่แก้ document เว้นแต่ผู้ใช้สั่ง optional fix ผ่าน command รายละเอียดอยู่ใน `source-editing.md` และ `content-checks.md`

## ลำดับการพิสูจน์ระบบ

1. พิมพ์ paragraph ผ่าน browser input แล้วได้ model state และ deterministic HTML
2. เลือกช่วงข้อความ ทำ bold transaction, undo, redo, export และโหลดกลับ
3. พิมพ์ภาษาไทยผ่าน IME โดยข้อความระหว่างทางไม่เสียหายและ history ไม่แตกเป็นส่วนเกิน
4. สร้าง list และตรวจพฤติกรรม Enter/Backspace ที่ขอบ รวมถึง selection ข้าม block
5. Rich paste ผ่าน allowlisted parsing และ normalization
6. ติดตั้ง callout plugin และนำ semantic HTML เข้า/ออกโดยไม่แก้ core
7. เลือก typography, color, highlight, block background และ font family token แล้วนำเข้า/ส่งออก namespaced class กลับมาได้
8. แสดง typography token ด้วยขนาดและ line-height ต่างกันบน mobile/desktop โดย document model และ HTML ไม่เปลี่ยน
9. เพิ่ม custom toolbar action ที่เก็บ selection เปิด modal คืน selection และ dispatch command โดยไม่แก้ editor core
10. เชื่อมกับ React form พิสูจน์ Next.js client boundary และยืนยันว่า CMS preview กับเว็บไซต์ใช้ `content.css` ชุดเดียวกัน
11. แก้ safe body HTML ใน Source mode, Apply เป็น transaction เดียว, undo ได้ และรักษา unsupported markup ผ่าน `RawHtmlNode`
12. ปฏิเสธ script, event handler, unsafe URL และ active content โดยรายงาน diagnostic และไม่เปลี่ยน document
13. ตรวจ accessibility และ content SEO พร้อมนำผู้ใช้ไปยัง node และใช้ optional fix ผ่าน command
