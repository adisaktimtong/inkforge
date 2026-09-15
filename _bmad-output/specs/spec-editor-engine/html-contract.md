# สัญญา HTML

## บทบาท

HTML เป็นสัญญาสำหรับจัดเก็บข้อมูลใน CMS และส่งเนื้อหาไปแสดงบนเว็บไซต์ แต่ไม่ใช่ mutable editor state ตอนโหลด ระบบ parse HTML เป็น document model และตอนบันทึก serialize model state เป็น normalized HTML

Source mode รองรับ valid body HTML ที่ไม่เป็น executable content Node ที่ visual schema หรือ plugin รองรับต้อง parse เป็น structured node ส่วน safe subtree อื่นต้องเก็บแบบ lossless เป็น `RawHtmlNode` และแก้ผ่าน Source mode เท่านั้น

## Mapping ของ MVP

| เนื้อหาใน Editor | Canonical HTML |
|---|---|
| Paragraph | `<p>` |
| Heading ระดับ 1–4 | `<h1>` ถึง `<h4>` |
| Blockquote | `<blockquote>` |
| Ordered list | `<ol>` ที่มี `<li>` |
| Unordered list | `<ul>` ที่มี `<li>` |
| Code block | `<pre><code>` |
| Bold | `<strong>` |
| Italic | `<em>` |
| Underline | `<u>` |
| Strikethrough | `<s>` |
| Link | `<a href>` พร้อม attribute ที่ allowlist อนุญาต |
| Image | `<figure>` ที่มี `<img>` และ `<figcaption>` ซึ่งเป็น optional |
| Text color token | `<span class="{prefix}text-{token}">` |
| Text highlight token | `<span class="{prefix}highlight-{token}">` |
| Typography token | `<span class="{prefix}typo-{token}">` |
| Font family token | `<span class="{prefix}font-{token}">` |
| Block background token | `class="{prefix}bg-{token}"` บน block element ที่รองรับ |

Serializer ใช้รูปแบบ canonical เพียงแบบเดียว แม้ importer จะรับ tag ที่มีความหมายเท่ากัน เช่น `<b>` สำหรับ bold และ `<i>` สำหรับ italic

## การ Normalize

- Markup input ที่มีความหมายเท่ากันต้อง serialize เป็น canonical mapping เดียวกัน
- ไม่รักษาลำดับ attribute, whitespace ที่ไม่กระทบความหมาย และ tag alias เดิม
- Empty block ต้อง normalize เป็นรูปแบบเดียวที่บันทึกไว้ในเอกสาร
- การซ้อน tag ที่ไม่ถูกต้องต้องซ่อมด้วยกฎที่ deterministic เท่านั้น มิฉะนั้น parser ต้องรายงาน compatibility issue แบบมีโครงสร้าง
- Attribute ที่เก็บ URL ต้องตรวจตาม protocol policy ที่แอปกำหนด
- Serializer ส่งออก presentation token เป็น class ที่มี namespace และอยู่ใน token registry เท่านั้น `classPrefix` กำหนด namespace และมีค่าเริ่มต้นเป็น `rte-`
- Parser, serializer, wrapper, `content.css` และ sanitizer allowlist ต้องใช้ effective prefix เดียวกัน Prefix เป็น immutable ต่อ editor instance และการเปลี่ยน persisted prefix ต้องผ่าน migration
- Public token class ห้ามถูก hash และต้องคงความหมายเดิมตลอดอายุ major version
- Font family และ typography ใช้ token ID ภายใน map ไปยัง CSS rule ที่กำหนดไว้ ห้ามรับค่า CSS ดิบจากผู้ใช้
- Importer สามารถรับ legacy inline style จาก TinyMCE ได้ แต่ต้อง map เข้าสู่ token ที่รู้จักหรือเข้าสู่นโยบาย unsupported content ก่อนบันทึกใหม่
- Semantic meaning ใช้ HTML element, presentation ใช้ token class และ metadata เชิงโครงสร้างของ custom node ใช้ `data-*`

## สัญญา CSS

CSS แยกเป็นสองส่วน:

```text
editor.css   → toolbar, menu, selection และ editor interaction; ใช้เฉพาะ CMS
content.css  → typography, color, background และ content layout; ใช้ทั้ง CMS preview และเว็บไซต์
```

ทั้ง CMS preview และหน้าเว็บไซต์ต้องครอบ HTML ด้วย `.{prefix}content` เช่น `.rte-content` เมื่อใช้ค่าเริ่มต้น และ rule ใน `content.css` ต้อง scope ใต้ wrapper นี้เพื่อไม่ให้ style รั่วไปยังส่วนอื่นของแอป

Responsive typography อยู่ใน `content.css` โดย HTML และ document model เก็บเพียง token ID:

```css
/* ตัวอย่างเมื่อ classPrefix = "rte-" */
.rte-content .rte-typo-lead {
  font-size: var(--rte-lead-size-mobile);
  line-height: var(--rte-lead-line-height-mobile);
}

@media (min-width: 768px) {
  .rte-content .rte-typo-lead {
    font-size: var(--rte-lead-size-desktop);
    line-height: var(--rte-lead-line-height-desktop);
  }
}
```

เว็บไซต์ต้อง deploy `content.css` ที่รองรับ token ใหม่ก่อน CMS เปิดให้ผู้เขียนเลือก token นั้น Token ที่เลิกใช้ต้องมี alias จนกว่าเนื้อหาเดิมถูก migrate และการถอด alias เป็น breaking change

## Node ที่ขยายเพิ่มเติม

Custom node ใช้ semantic HTML หากทำได้ และใช้ namespaced `data-*` attribute เฉพาะเมื่อ HTML ไม่มี element ที่สื่อความหมายเหมาะสม

```html
<aside data-editor-node="callout" data-tone="warning">
  <p>ข้อความแจ้งเตือน</p>
</aside>
```

Plugin ของ custom node เป็นเจ้าของทั้ง parse rule และ serialize rule การถอด plugin ออกทำให้ markup ของมันกลายเป็น unsupported content และต้องเข้าสู่นโยบายจัดการ unsupported content ที่ตั้งไว้

## Safe Body HTML และ Raw HTML

Element ที่ใช้ได้ใน body และผ่าน security policy สามารถอยู่ใน Source mode ได้ แม้ visual schema จะไม่มี editing behavior สำหรับ element นั้น Parser ต้องรักษา safe unsupported subtree เป็น raw fragment โดยไม่ normalize ภายในและ serializer ต้องนำ fragment กลับมาโดยไม่เปลี่ยน

Document-level element ได้แก่ `html`, `head`, `body`, `meta`, `title`, `base` และ `link` ไม่อยู่ใน page-content contract รายละเอียด validation, Source mode lifecycle และ `RawHtmlNode` อยู่ใน `source-editing.md`

## ความเข้ากันได้กับ HTML เดิมจาก TinyMCE

ก่อน migration ต้องรวบรวม production fixture ที่ไม่เปิดเผยข้อมูลสำคัญให้ครอบคลุม element, attribute, class, inline style, media pattern และโครงสร้างผิดรูปทุกแบบที่พบในข้อมูลเดิม จากนั้นจัดแต่ละ fixture เป็น:

- รองรับและ normalize เป็น canonical HTML
- รองรับผ่าน product plugin
- รักษาเป็น read-only ตามนโยบาย unsupported content ที่เลือก
- ปฏิเสธอย่างชัดเจนพร้อมข้อความวินิจฉัยที่ผู้ใช้เห็นได้

Compatibility test เปรียบเทียบความหมายของ parsed document และ canonical reserialization ไม่เปรียบเทียบ raw string ทุก fixture ต้อง render อย่างปลอดภัยและได้ผลที่ยอมรับได้ภายใต้ typography `.page-content` ชุดเดียวกับเว็บไซต์

## Security Boundary

Editor importer และ Source mode ต้องปฏิเสธ script, event-handler attribute, unsafe URL scheme, executable SVG, document-level element และ active embed ที่ไม่ผ่าน policy แต่ไม่ได้ทำให้ HTML ที่ไม่น่าเชื่อถือปลอดภัยโดยอัตโนมัติ CMS server ต้องใช้ allowlist sanitizer ก่อนบันทึกหรือ render ตรวจ URL ของ link/image/media และอนุญาตเฉพาะ token class ที่เกิดจาก effective prefix กับ token registry จริง ไม่ใช่อนุญาตเพียงเพราะชื่อขึ้นต้นด้วย prefix หน้าเว็บไซต์สาธารณะต้อง render เฉพาะ HTML ที่ผ่านการ sanitize แล้ว

## สัญญาการบันทึก

```ts
interface EditorChange {
  html: string
  isEmpty: boolean
  revision: number
}
```

Editor ส่ง deterministic HTML และ local revision ที่เพิ่มขึ้นเท่านั้น Page form หลักเป็นเจ้าของจังหวะบันทึก การส่งข้อมูล การจัดการข้อผิดพลาด และการยืนยัน dirty state ส่วน editor ต้องไม่เรียก CMS persistence API โดยตรง
