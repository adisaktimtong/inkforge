# สัญญา Accessibility และ Content SEO Checker

## ขอบเขต

Checker ตรวจเฉพาะ HTML และ document model ภายใน editor ไม่รับรองว่าเว็บไซต์ทั้งระบบผ่าน accessibility หรือ SEO และไม่รับผิดชอบ page metadata เช่น title, meta description, canonical URL, Open Graph, robots, sitemap, slug หรือ structured data ระดับหน้า

Editor UI และ built-in control ต้องออกแบบและทดสอบตาม [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) ส่วน content checker ต้องผูกแต่ละ accessibility rule กับ success criterion ระดับ AA ที่เกี่ยวข้อง เมื่อกฎใดตรวจอัตโนมัติไม่ได้ต้องรายงานให้ตรวจด้วยมนุษย์หรือ `not-evaluated` แทนการสรุปว่าผ่าน

## Issue Contract

```ts
interface ContentIssue {
  checker: 'accessibility' | 'seo'
  ruleId: string
  message: string
  nodeId: string
  level: 'error' | 'warning'
  status: 'failed' | 'manual-review' | 'not-evaluated'
  standardReference?: string
  fix?: EditorCommand
}
```

Issue ต้องอ้าง node ที่ยังอยู่ใน snapshot ที่ตรวจ เมื่อ document เปลี่ยน ระบบต้อง mark ผลเดิมเป็น stale หรือรัน checker ใหม่ Optional fix ต้อง dispatch command ผ่าน transaction และต้องไม่แก้ document โดยอัตโนมัติ

## Accessibility Rules

ชุดกฎขั้นต่ำตรวจ:

- Image ไม่มี alt text หรือไม่มีการระบุว่าเป็น decorative image
- Heading ว่าง ข้ามระดับ หรือมีโครงสร้างไม่ต่อเนื่อง
- Link ไม่มี accessible text หรือใช้ข้อความที่ไม่สื่อความหมายตาม policy
- Semantic element หรือ attribute ขัดกับ schema
- เนื้อหาใช้สีเพียงอย่างเดียวเพื่อสื่อความหมายเมื่อ engine ตรวจได้
- คู่ text/background token ไม่มี contrast result ที่ consumer registry รองรับ

Contrast checker ใช้ resolved token pair จาก `content.css` contract และต้องตรวจแยกตาม responsive/theme variant ที่ consumer ประกาศ หากหาค่าที่คำนวณได้ไม่ครบให้รายงานว่า `not-evaluated` แทนการสรุปว่าผ่าน

## Content SEO Rules

ชุดกฎขั้นต่ำตรวจ:

- Heading ว่าง ข้ามระดับ หรือใช้ heading โดยไม่มีข้อความที่สื่อความหมาย
- Link ไม่มี descriptive anchor text หรือใช้ URL ที่ crawler ตามไม่ได้ตาม URL policy
- Image ที่มีความหมายไม่มี alt text
- Markup ใช้ presentation element แทน semantic structure ในกรณีที่ schema แปลงได้
- Content มีโครงสร้างผิดรูปจน serializer ไม่สามารถสร้าง canonical HTML ได้

กฎที่ซ้ำกับ Accessibility ต้องใช้ rule implementation ร่วมกันได้ แต่รายงาน checker context แยกเมื่อคำแนะนำต่อผู้ใช้ต่างกัน

## การนำเสนอผล

UI ต้องแสดงรายการ issue, filter ตาม checker/level, นำ focus หรือ selection ไปยัง node ที่ยังใช้ได้ และเปิดคำอธิบายกฎได้ RawHtmlNode ที่ตรวจโครงสร้างภายในไม่ได้ต้องแสดงสถานะ `not-evaluated` ไม่ถือว่าผ่าน

## เกณฑ์ตรวจรับ

- Checker คืนผลแบบ deterministic สำหรับ document snapshot เดียวกัน
- Issue ทุกข้อมี rule ID, message, node ID, checker และ level
- Accessibility issue ระบุ WCAG 2.2 AA success criterion หรือเหตุผลที่ต้องตรวจด้วยมนุษย์
- ผลเก่าถูกทำเครื่องหมาย stale หรือแทนที่หลัง document เปลี่ยน
- Optional fix ทำงานผ่าน command และ undo ได้
- Accessibility report ไม่อ้างว่าเว็บไซต์ทั้งระบบผ่านมาตรฐาน
- SEO report แยก content issue ออกจาก page-level metadata
- Contrast ตรวจทุก theme/responsive variant ที่ประกาศหรือรายงาน `not-evaluated`
- RawHtmlNode ที่ตรวจไม่ได้ต้องไม่ถูกนับเป็น passed content
