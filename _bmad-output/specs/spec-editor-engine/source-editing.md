# สัญญา Source-code Editing

## ขอบเขต

Source mode เปิดให้ผู้ใช้ที่ได้รับสิทธิ์แก้ valid body HTML ทั้งหมดที่ไม่เป็น executable content Visual mode แก้เฉพาะ node ที่ schema หรือ plugin รองรับ ส่วน safe HTML อื่นเก็บเป็น `RawHtmlNode` แบบ lossless และ read-only

Document-level element ได้แก่ `html`, `head`, `body`, `meta`, `title`, `base` และ `link` ไม่อยู่ใน page-content contract

## Mode Lifecycle

```text
Visual document snapshot
  → serialize เป็น working-copy HTML
  → แก้ใน Source mode
  → validate syntax และ security policy
  → parse เป็น structured node กับ RawHtmlNode
  → commit เป็น transaction เดียว
  → กลับ Visual mode
```

การ Cancel ต้องทิ้ง working copy โดยไม่เปลี่ยน document การ Apply ที่สำเร็จต้อง undo/redo ได้เป็นหนึ่ง history step และ dirty state เปลี่ยนหลัง commit เท่านั้น

## Validation Result

```ts
interface HtmlValidationIssue {
  line: number
  column: number
  code:
    | 'invalid-html'
    | 'forbidden-element'
    | 'forbidden-attribute'
    | 'unsafe-url'
    | 'unsafe-css'
    | 'unsupported-document-element'
  message: string
}

type ApplySourceResult =
  | { ok: true; revision: number }
  | { ok: false; issues: HtmlValidationIssue[] }
```

เมื่อผลเป็น `ok: false` ระบบต้องไม่สร้าง transaction, partial HTML, history entry หรือ cursor relocation และ Source mode ต้องรักษา working copy เพื่อให้ผู้ใช้แก้ต่อได้

## Executable-content Policy

ต้องปฏิเสธ:

- `script` และ executable inline SVG
- Attribute ที่ขึ้นต้นด้วย `on` โดยไม่คำนึงถึงตัวพิมพ์เล็กใหญ่
- URL scheme `javascript:` และ `vbscript:` รวมถึงค่าที่ผ่าน encoding หรือ whitespace obfuscation
- `iframe srcdoc`, `object`, `embed`, `applet`, `base`, `meta`, `link` และ active embed ที่ไม่ผ่าน policy
- `style` element และ CSS declaration ที่อยู่นอก CSS policy
- Form action ที่ส่งข้อมูลไปยังปลายทางซึ่ง policy ไม่อนุญาต

URL ของ link, image, iframe, audio และ video ต้องผ่าน protocol/host policy ที่ consumer กำหนด Iframe ที่อนุญาตต้อง render ใน sandbox โดยไม่เปิด script เป็นค่าเริ่มต้น

## RawHtmlNode

```ts
interface RawHtmlNode {
  type: 'raw-html'
  html: string
  displayMode: 'placeholder' | 'sandbox'
  editable: false
}
```

Raw node ต้องรักษา safe source fragment โดยไม่ normalize ภายใน ห้าม execute active content และต้องมีขอบเขต DOM/selection ที่ชัดเจน ผู้ใช้ลบทั้ง node หรือแก้ผ่าน Source mode ได้ แต่ห้ามวาง caret เข้าไปแก้บางส่วนใน Visual mode

## เกณฑ์ตรวจรับ

- Safe body HTML ที่ schema ไม่รองรับต้องผ่าน Source → Visual → Source โดย fragment ไม่เปลี่ยน
- Script, event handler, unsafe URL และ executable SVG ต้องถูกปฏิเสธแม้ใช้ตัวพิมพ์หรือ encoding ต่างกัน
- Validation error ต้องมี line, column, code และ message และไม่เปลี่ยน document เดิม
- Apply ที่สำเร็จต้องเป็น transaction เดียวและ undo/redo ได้
- Cancel ต้องไม่เปลี่ยน document, dirty state หรือ history
- RawHtmlNode ต้องไม่ execute code และ Visual mode ต้องไม่แก้ภายใน node
- ผู้ใช้ที่ไม่มีสิทธิ์ต้องไม่สามารถเปิดหรือ Apply Source mode
