# สัญญา HTML

## บทบาท

HTML เป็นสัญญาสำหรับจัดเก็บข้อมูลใน CMS และส่งเนื้อหาไปแสดงบนเว็บไซต์ แต่ไม่ใช่ mutable editor state ตอนโหลด ระบบ parse HTML เป็น document model และตอนบันทึก serialize model state เป็น normalized HTML

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

Serializer ใช้รูปแบบ canonical เพียงแบบเดียว แม้ importer จะรับ tag ที่มีความหมายเท่ากัน เช่น `<b>` สำหรับ bold และ `<i>` สำหรับ italic

## การ Normalize

- Markup input ที่มีความหมายเท่ากันต้อง serialize เป็น canonical mapping เดียวกัน
- ไม่รักษาลำดับ attribute, whitespace ที่ไม่กระทบความหมาย และ tag alias เดิม
- Empty block ต้อง normalize เป็นรูปแบบเดียวที่บันทึกไว้ในเอกสาร
- การซ้อน tag ที่ไม่ถูกต้องต้องซ่อมด้วยกฎที่ deterministic เท่านั้น มิฉะนั้น parser ต้องรายงาน compatibility issue แบบมีโครงสร้าง
- Attribute ที่เก็บ URL ต้องตรวจตาม protocol policy ที่แอปกำหนด
- รูปแบบที่เป็นหน้าที่ของ website typography ควรใช้ CSS class หรือ semantic element แทน arbitrary inline style

## Node ที่ขยายเพิ่มเติม

Custom node ใช้ semantic HTML หากทำได้ และใช้ namespaced `data-*` attribute เฉพาะเมื่อ HTML ไม่มี element ที่สื่อความหมายเหมาะสม

```html
<aside data-editor-node="callout" data-tone="warning">
  <p>ข้อความแจ้งเตือน</p>
</aside>
```

Plugin ของ custom node เป็นเจ้าของทั้ง parse rule และ serialize rule การถอด plugin ออกทำให้ markup ของมันกลายเป็น unsupported content และต้องเข้าสู่นโยบายจัดการ unsupported content ที่ตั้งไว้

## ความเข้ากันได้กับ HTML เดิมจาก TinyMCE

ก่อน migration ต้องรวบรวม production fixture ที่ไม่เปิดเผยข้อมูลสำคัญให้ครอบคลุม element, attribute, class, inline style, media pattern และโครงสร้างผิดรูปทุกแบบที่พบในข้อมูลเดิม จากนั้นจัดแต่ละ fixture เป็น:

- รองรับและ normalize เป็น canonical HTML
- รองรับผ่าน product plugin
- รักษาเป็น read-only ตามนโยบาย unsupported content ที่เลือก
- ปฏิเสธอย่างชัดเจนพร้อมข้อความวินิจฉัยที่ผู้ใช้เห็นได้

Compatibility test เปรียบเทียบความหมายของ parsed document และ canonical reserialization ไม่เปรียบเทียบ raw string ทุก fixture ต้อง render อย่างปลอดภัยและได้ผลที่ยอมรับได้ภายใต้ typography `.page-content` ชุดเดียวกับเว็บไซต์

## Security Boundary

Editor importer ต้องปฏิเสธ active content แต่ไม่ได้ทำให้ HTML ที่ไม่น่าเชื่อถือปลอดภัยโดยอัตโนมัติ CMS server ต้องใช้ allowlist sanitizer ก่อนบันทึกหรือ render ตรวจ URL ของรูปและลิงก์ และเป็นเจ้าของนโยบาย attribute สำหรับ external link หน้าเว็บไซต์สาธารณะต้อง render เฉพาะ HTML ที่ผ่านการ sanitize แล้ว

## สัญญาการบันทึก

```ts
interface EditorChange {
  html: string
  isEmpty: boolean
  revision: number
}
```

Editor ส่ง deterministic HTML และ local revision ที่เพิ่มขึ้นเท่านั้น Page form หลักเป็นเจ้าของจังหวะบันทึก การส่งข้อมูล การจัดการข้อผิดพลาด และการยืนยัน dirty state ส่วน editor ต้องไม่เรียก CMS persistence API โดยตรง
