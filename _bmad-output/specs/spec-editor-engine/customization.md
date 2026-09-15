# สัญญาการปรับแต่ง

## เป้าหมาย

Consumer ต้องสามารถปรับรูปแบบข้อความ โครง toolbar และ custom action ได้โดยไม่ต้อง fork package หรือแก้ editor core การปรับแต่งทุกชนิดต้องทำผ่าน public API, React composition หรือ plugin contract เท่านั้น

## Style Token Configuration

Consumer เป็นผู้กำหนด design token ที่ editor อนุญาต:

```ts
interface StyleTokenOption {
  id: string
  label: string
  aliases?: string[]
}

interface EditorStyleOptions {
  textColors?: StyleTokenOption[]
  highlightColors?: StyleTokenOption[]
  blockBackgroundColors?: StyleTokenOption[]
  typography?: StyleTokenOption[]
  fontFamilies?: StyleTokenOption[]
}

interface EditorCustomizationOptions {
  classPrefix?: string
  styles: EditorStyleOptions
}
```

`classPrefix` มีค่าเริ่มต้นเป็น `rte-` ต้องตรงกับ `/^[a-z][a-z0-9-]{0,30}-$/` และเป็น immutable ตลอดอายุ editor instance Parser, serializer, wrapper class, `content.css` และ sanitizer allowlist ต้องใช้ effective prefix เดียวกัน การเปลี่ยน prefix หลังมี persisted HTML เป็น migration ไม่ใช่ runtime configuration update

Token ID และ alias ต้องตรงกับ `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` และยาวไม่เกิน 64 ตัวอักษร ID กับ alias ต้องไม่ซ้ำกันภายใน category เดียวกัน ID เดียวกันใช้ข้าม category ได้เพราะ serializer ใส่ category segment ใน class name เช่น `{prefix}text-primary` กับ `{prefix}bg-primary`

Alias เป็น import-only identifier ต้อง map ไปยัง canonical ID เดียวและ serializer ต้องส่งออก canonical ID เสมอ Configuration เป็น immutable ตลอดอายุ editor instance หากต้องเปลี่ยน registry ให้ host บันทึกหรือเก็บ snapshot ปัจจุบัน dispose instance เดิม และสร้าง instance ใหม่ตาม migration policy ใน `html-contract.md`

Engine ต้องตรวจสอบ configuration ทั้งหมดก่อนสร้าง editor และต้องตรวจ token ID อีกครั้งก่อนสร้าง transaction หรือ HTML Token ที่ไม่รู้จักต้องเข้าสู่ unknown-token policy โดยห้ามสร้าง partial transaction หรือ partial HTML Document model เก็บ token ID เท่านั้น ส่วน CSS value, responsive breakpoint และ line-height อยู่ใน `content.css`

## Style Commands และ Selection

Built-in command ขั้นต่ำ:

```ts
editor.dispatch('setTextColor', { tokenId })
editor.dispatch('setHighlightColor', { tokenId })
editor.dispatch('setBlockBackground', { tokenId })
editor.dispatch('setTypography', { tokenId })
editor.dispatch('setFontFamily', { tokenId })
editor.dispatch('clearTextStyle')
```

```ts
type DispatchResult =
  | {
      ok: true
      changed: boolean
      revision: number
      skippedNodeIds?: string[]
    }
  | {
      ok: false
      reason:
        | 'unknown-command'
        | 'invalid-payload'
        | 'invalid-selection'
        | 'unknown-token'
        | 'unsupported-content'
        | 'disposed-editor'
    }
```

Collapsed selection ใช้ text-level token เป็น stored mark สำหรับข้อความที่จะพิมพ์ต่อไป Ranged selection ใช้ token กับ text node ที่ schema อนุญาตภายใน transaction เดียวและรายงาน node ที่ข้ามผ่าน `skippedNodeIds` หากไม่มี node ที่ใช้ได้ให้คืน `invalid-selection` โดยไม่สร้าง transaction

`setBlockBackground` ใช้กับ block node ที่ schema อนุญาตเท่านั้น `clearTextStyle` ล้างเฉพาะ built-in text color, highlight, typography และ font-family marks ไม่ล้าง block background หรือ plugin mark คำสั่งที่ไม่รู้จัก payload ผิด หรือ editor ถูก dispose ต้องคืน failure result และห้าม throw ใน user interaction path

## การประกอบ Toolbar

Toolbar ไม่เป็นส่วนบังคับของ headless engine Consumer เลือกใช้ component มาตรฐานหรือประกอบ UI เอง:

```tsx
<RichTextEditor
  initialHtml={html}
  customization={{
    classPrefix: 'rte-',
    styles: styleOptions,
  }}
>
  <EditorToolbar>
    <UndoButton />
    <FontFamilySelect />
    <TypographySelect />
    <TextColorPicker />
    <HighlightColorPicker />
    <BlockBackgroundPicker />
    <CustomModalButton />
  </EditorToolbar>
  <Editable />
</RichTextEditor>
```

Public hook ต้องคืน `enabled`, `active` และ `mixed` สำหรับ command ที่เกี่ยวข้อง และอัปเดตหลัง selection หรือ document transaction ทุกครั้ง Component มาตรฐานต้อง dispatch command ผ่าน public API และห้ามอ่านหรือแก้ DOM โดยตรง

## Custom Action และ Modal

Consumer เป็นเจ้าของสถานะ เนื้อหา portal, focus trap และ lifecycle ของ modal ปุ่มใน toolbar ต้องเก็บ selection bookmark ก่อนที่ focus จะย้ายออกจาก editor เมื่อผู้ใช้ยืนยัน ระบบต้องคืน selection ก่อน แล้วจึง dispatch command ที่ engine หรือ plugin ลงทะเบียนไว้

`captureSelection()` ต้องคืน `null` หาก active selection ไม่ได้เป็นของ editor instance นั้น Bookmark ต้องผูกกับ editor instance และอัปเดตตำแหน่งตาม transaction ที่เกิดขึ้นระหว่างเปิด modal `restoreSelection()` ต้องคืน `false` เมื่อ bookmark หมดอายุ, editor ถูก dispose, document ถูกแทนที่ หรือตำแหน่งเดิมไม่สามารถ map ได้

เมื่อ capture หรือ restore ไม่สำเร็จ custom action ต้องไม่ dispatch command และต้องแจ้ง failure ให้ UI จัดการ Bookmark ต้องถูกล้างทั้งเมื่อ cancel, close, confirm สำเร็จ และ confirm ล้มเหลว Consumer ต้องป้องกัน callback ซ้ำขณะ confirm กำลังทำงาน

หาก custom action เพิ่ม content type ใหม่ Consumer ต้องติดตั้ง plugin ที่ประกาศ schema, namespaced command และ HTML mapping สำหรับ content type นั้นด้วย Plugin ID, command ID และ node type ต้องไม่ซ้ำ ระบบต้องตรวจ conflict ตอนสร้าง editor และ plugin HTML ต้องผ่าน validation/sanitization policy เดียวกับ built-in HTML

```tsx
function InsertCalloutButton() {
  const editor = useEditor()
  const [open, setOpen] = useState(false)
  const bookmarkRef = useRef<SelectionBookmark | null>(null)
  const confirmingRef = useRef(false)

  const clearAndClose = () => {
    bookmarkRef.current = null
    confirmingRef.current = false
    setOpen(false)
  }

  const openModal = () => {
    const bookmark = editor.captureSelection()
    if (!bookmark) return
    bookmarkRef.current = bookmark
    setOpen(true)
  }

  const confirm = (value: CalloutInput) => {
    if (confirmingRef.current || !bookmarkRef.current) return
    confirmingRef.current = true

    if (!editor.restoreSelection(bookmarkRef.current)) {
      clearAndClose()
      return
    }

    const result = editor.dispatch('callout.insert', value)
    clearAndClose()
    return result
  }

  return (
    <>
      <button type="button" onClick={openModal}>เพิ่ม Callout</button>
      <CalloutModal open={open} onClose={clearAndClose} onConfirm={confirm} />
    </>
  )
}
```

## เกณฑ์ตรวจรับ

### Style

- Consumer กำหนด `classPrefix` ได้และระบบใช้ effective prefix เดียวกันใน parser, serializer, wrapper, CSS และ sanitizer
- ระบบปฏิเสธ prefix ผิดรูปก่อนสร้าง editor และการเปลี่ยน prefix ต้องไม่เกิดขึ้นระหว่างอายุ editor instance
- Consumer เปลี่ยนรายการ typography, สี และ font-family token ได้ด้วย configuration
- ระบบปฏิเสธ token ID/alias ผิดรูป ซ้ำ หรือชนกันก่อนสร้าง editor
- Alias import กลับเป็น canonical ID และ serializer ไม่ส่งออก alias
- Token ที่ไม่อยู่ใน registry ถูกจัดการตาม policy โดยไม่มี partial transaction หรือ HTML
- Collapsed, ranged, mixed และ unsupported selection ให้ผลตาม selection contract
- Typography token แสดงขนาดและ line-height ต่างกันบน mobile/desktop ผ่าน `content.css` โดย HTML ไม่เปลี่ยน

### Toolbar

- Consumer เพิ่ม ลบ และจัดลำดับ toolbar control ได้โดยไม่แก้ package
- Toolbar state แสดง `enabled`, `active` และ `mixed` และอัปเดตหลัง selection/transaction
- Custom UI ไม่ทำให้ headless core หรือ DOM adapter import React component ของ consumer

### Custom Action

- Custom button เก็บ selection ก่อนเปิด modal คืน selection และ dispatch namespaced plugin command ได้
- Capture/restore failure, modal cancel, editor disposal และ confirm ซ้ำต้องไม่ dispatch command
- Unknown command และ invalid payload คืน typed failure result โดยไม่สร้าง transaction
- Plugin ID, command ID และ node type ที่ชนกันต้องถูกปฏิเสธก่อน editor พร้อมใช้งาน
- Plugin HTML ต้องผ่าน validation และ sanitization policy เดียวกับ built-in HTML
