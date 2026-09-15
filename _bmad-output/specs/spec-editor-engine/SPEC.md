---
id: SPEC-editor-engine
companions:
  - architecture.md
  - html-contract.md
  - customization.md
  - source-editing.md
  - content-checks.md
sources: []
---

> **สัญญาหลักของระบบ:** `SPEC.md` และไฟล์ใน `companions:` เป็นข้อกำหนดฉบับสมบูรณ์สำหรับการพัฒนา ทดสอบ และตรวจรับระบบ

# Engine สำหรับ Rich-Text Editor ที่ขยายความสามารถได้

## เหตุผล

CMS ปัจจุบันใช้ TinyMCE แก้ไขเนื้อหา HTML ที่เป็นส่วนหนึ่งของข้อมูลหน้าเพจ แต่การปรับแต่งให้เข้ากับผลิตภัณฑ์ทำได้ยากและมีค่า license จึงต้องสร้าง editor ภายในที่ทีมควบคุม extension point, ส่วนติดต่อผู้ใช้, HTML output และทิศทางการพัฒนาได้เอง โดยไม่ตั้งเป้าให้มีความสามารถเทียบเท่า TinyMCE ทั้งหมด

## ความสามารถ

- **CAP-1**
  - **เจตนา:** ผู้ใช้ CMS สามารถโหลด HTML เดิมที่รองรับ แก้ไข และบันทึกกลับเป็น HTML ที่มีความหมายเท่าเดิมสำหรับแสดงผลบนเว็บไซต์
  - **เกณฑ์สำเร็จ:** ชุด fixture สามารถ import, แก้ไข, export และโหลด HTML เดิมกลับมาใหม่ โดย structured content ไม่สูญหาย และ safe body HTML ที่ visual schema ไม่รองรับยังคงอยู่แบบ lossless `RawHtmlNode`

- **CAP-2**
  - **เจตนา:** ผู้ใช้ CMS สามารถสร้างและจัดรูปแบบเนื้อหาทั่วไปของหน้าเว็บไซต์ได้
  - **เกณฑ์สำเร็จ:** ผู้ใช้สร้าง paragraph, heading, blockquote, ordered list, unordered list, code block, bold, italic, underline, strikethrough, link และ image รวมถึงเลือก typography, สีข้อความ สีพื้นหลังข้อความ สีพื้นหลังระดับ block และ font family จาก design token ที่ consumer กำหนดได้

- **CAP-3**
  - **เจตนา:** ทีมผลิตภัณฑ์สามารถเพิ่มชนิดเนื้อหาและพฤติกรรมการแก้ไขได้โดยไม่แก้ editor core
  - **เกณฑ์สำเร็จ:** Callout plugin เพิ่ม node, command, shortcut, HTML parser และ serializer ผ่าน extension point สาธารณะเท่านั้น และนำเข้า/ส่งออกข้อมูลกลับไปกลับมาได้สำเร็จ

- **CAP-4**
  - **เจตนา:** แอป React สามารถใช้ editor เป็น form field ที่นำกลับมาใช้ซ้ำได้ โดย form หลักเป็นผู้ควบคุมการบันทึกข้อมูล
  - **เกณฑ์สำเร็จ:** React form กำหนด HTML เริ่มต้น ตรวจจับ dirty/change state อ่านหรือแทนที่ HTML ปัจจุบัน ตลอดจนสั่ง focus, clear, undo และ redo ได้โดยไม่ import type ภายในของ engine

- **CAP-5**
  - **เจตนา:** แอป Next.js สามารถแก้ไขเนื้อหาฝั่ง client และ render HTML ที่บันทึกแล้วฝั่ง server โดยไม่ส่ง editor bundle ไปยังหน้าเว็บไซต์สาธารณะ
  - **เกณฑ์สำเร็จ:** ตัวอย่าง integration ของ Next.js โหลด editor ภายใน client boundary โดย CMS preview และหน้า server-rendered ใช้ versioned content stylesheet เดียวกัน ขณะที่หน้าเว็บไซต์ไม่มี editor runtime หรือ editor UI stylesheet ใน client bundle

- **CAP-6**
  - **เจตนา:** ทีมผลิตภัณฑ์สามารถประกอบและกำหนด theme ของส่วนติดต่อ editor ได้อย่างอิสระ
  - **เกณฑ์สำเร็จ:** Consumer เพิ่ม ลบ และจัดลำดับ toolbar/menu control กำหนด typography, สี, spacing, focus, disabled, error state และ public class prefix ตลอดจนเปิด modal ของ consumer เก็บและคืน selection แล้ว dispatch command ที่ลงทะเบียนไว้ได้โดยไม่แก้ editor core

- **CAP-7**
  - **เจตนา:** ผู้ใช้สามารถแก้ไขเนื้อหาโดยข้อมูลไม่เสียหายในกรณีทั่วไปของ selection, history, clipboard, keyboard และ text composition
  - **เกณฑ์สำเร็จ:** Automated test และ browser-level test ครอบคลุม collapsed/ranged selection, selection ข้าม block, undo/redo, shortcut, plain/rich paste และ Thai IME composition โดยข้อความไม่ซ้ำ สูญหาย หรือสลับลำดับ

- **CAP-8**
  - **เจตนา:** แอปที่นำ editor ไปใช้สามารถกำหนดขั้นตอนอัปโหลดรูปเอง และผู้ใช้สามารถเพิ่มรูปที่เข้าถึงได้ในเนื้อหา
  - **เกณฑ์สำเร็จ:** Editor เรียก upload handler ที่แอปส่งให้ แทรก URL ของ asset ที่ได้รับ เปิดให้แก้ alt text และ export เป็น HTML รูปภาพตามสัญญา

- **CAP-9**
  - **เจตนา:** Form หลักสามารถตรวจสอบได้อย่างเชื่อถือได้ว่าเนื้อหามีการเปลี่ยนแปลงหรือไม่ และรับ HTML ที่มีผลลัพธ์แน่นอนเพื่อนำไปบันทึก
  - **เกณฑ์สำเร็จ:** Document state ที่เทียบเท่ากัน serialize เป็น normalized HTML ที่คงที่ และ dirty state จะกลับเป็น clean หลัง host ยืนยัน saved snapshot แล้วเท่านั้น

- **CAP-10**
  - **เจตนา:** ผู้เขียนสามารถตรวจหาปัญหา accessibility ในเนื้อหาและไปยังตำแหน่งที่ต้องแก้ได้
  - **เกณฑ์สำเร็จ:** Checker รายงาน rule ID ที่อ้างอิง WCAG 2.2 Level AA, message, node location, ระดับ และ optional fix สำหรับ image alt, heading structure, link text, semantic markup, color-only meaning และ contrast โดยไม่อ้างว่าเว็บไซต์ทั้งระบบผ่านมาตรฐาน

- **CAP-11**
  - **เจตนา:** ผู้เขียนที่ได้รับสิทธิ์สามารถตรวจและแก้ valid safe body HTML ผ่าน Source mode โดยไม่สูญเสีย HTML ที่ visual schema ไม่รองรับ
  - **เกณฑ์สำเร็จ:** การ Apply source ต้อง validate syntax และ security policy ก่อน commit เป็น transaction เดียวที่ undo ได้ หากพบ error ต้องรายงานตำแหน่งและไม่เปลี่ยน document ส่วน safe unsupported HTML ต้องกลับเข้า visual mode เป็น read-only `RawHtmlNode` แบบ lossless

- **CAP-12**
  - **เจตนา:** ผู้เขียนสามารถตรวจปัญหา content SEO ที่เกิดจากเนื้อหาใน editor ก่อนบันทึกหน้าเพจ
  - **เกณฑ์สำเร็จ:** Checker ตรวจ heading structure, heading ว่าง, semantic HTML, image alt, descriptive link text และ crawlable link แล้วแยกผลจาก page-level SEO metadata ที่ CMS เป็นเจ้าของ

## ข้อจำกัด

- HTML ยังคงเป็นสัญญาสำหรับจัดเก็บใน CMS และแสดงผลบนเว็บไซต์ ส่วน editor ใช้ structured document model เฉพาะระหว่างแก้ไข
- Core engine เป็น headless และต้องไม่ขึ้นกับ React, Next.js, toolbar component, CSS ของแอป หรือ persistence API
- การเปลี่ยน document ต้องผ่าน command และ transaction ที่ตรวจสอบแล้ว Plugin ห้ามแก้ internal state โดยตรง
- React integration และ DOM integration ต้องแยกจาก core เพื่อเพิ่ม UI adapter อื่นได้โดยไม่เปลี่ยน document engine
- Editor UI บน Next.js ทำงานเฉพาะฝั่ง client ส่วนหน้าเว็บไซต์สาธารณะต้องไม่ต้องใช้ editor runtime
- ต้อง sanitize HTML ฝั่ง server ด้วย allowlist ก่อน render ข้อมูลที่ไม่น่าเชื่อถือ การ parse ฝั่ง client ไม่ถือเป็น security boundary
- HTML เดิมที่รองรับต้องมี compatibility fixture จากข้อมูล production ก่อนย้ายออกจาก TinyMCE
- Typography, color, font และ background ต้องใช้ design token ที่ consumer กำหนด ผู้เขียนห้ามป้อน CSS value อิสระ
- Presentation token ต้อง serialize เป็น stable namespaced class จาก `classPrefix` ที่ consumer กำหนด โดยค่าเริ่มต้นคือ `rte-`; class เป็น public HTML contract และห้ามผ่าน CSS Modules หรือการ hash ชื่อ
- `classPrefix` เป็น immutable configuration และ parser, serializer, content stylesheet, wrapper กับ sanitizer allowlist ต้องใช้ค่าเดียวกัน การเปลี่ยน prefix หลังมี persisted HTML ต้องทำผ่าน migration
- CSS ต้องแยกเป็น editor UI stylesheet สำหรับ CMS และ versioned content stylesheet ที่ CMS preview กับเว็บไซต์ใช้ร่วมกัน
- เว็บไซต์ต้องรองรับ token class ใหม่ก่อน CMS เริ่มสร้าง HTML ที่ใช้ token นั้น และต้องรักษา alias ของ token เดิมจนกว่าเนื้อหาเก่าจะ migrate แล้ว
- Source mode รองรับเฉพาะ valid body HTML ที่ไม่เป็น executable content และต้องปฏิเสธ script, event-handler attribute, unsafe URL scheme, executable SVG และ active embed ที่ไม่ผ่าน policy
- การ Apply source ต้อง validate, parse และตรวจ policy ก่อน commit; validation failure ต้องไม่สร้าง partial state หรือเปลี่ยน document เดิม
- Raw HTML preview ต้องไม่ execute active content และ iframe/embed ที่อนุญาตต้องผ่าน sandbox กับ URL policy
- Editor UI และ built-in control ต้องผ่าน WCAG 2.2 Level AA ส่วน content checker ต้องอ้างอิง success criterion ที่เกี่ยวข้อง

## สิ่งที่ไม่อยู่ในขอบเขต

- การรองรับหรือมีความสามารถเทียบเท่า TinyMCE ทั้งหมด
- Real-time collaboration, comment, track changes และ block drag-and-drop ใน MVP
- การแก้ HTML element ทุกชนิดแบบ visual; element ที่ไม่มี plugin ใช้ read-only `RawHtmlNode` และแก้ผ่าน Source mode
- JavaScript execution, event-handler attribute และ active content ที่ไม่ผ่าน security policy
- Document-level HTML (`html`, `head`, `body`, `meta`, `title`, `base`, `link`) ภายใน page content
- Page-level SEO metadata เช่น title, meta description, canonical URL, Open Graph, robots, sitemap, slug และ structured data ระดับหน้า
- การรักษา arbitrary HTML, whitespace หรือลำดับ attribute ให้เหมือนเดิมทุกตัวอักษร
- การ server-side render ตัว editor ที่โต้ตอบได้
- การจัดการ persistence, publishing workflow หรือ metadata ของหน้า CMS

## สัญญาณความสำเร็จ

หน้า CMS บน Next.js โหลด HTML ตัวอย่างจาก TinyMCE เปิดให้ผู้ใช้พิมพ์ภาษาไทยผ่าน IME เลือก responsive design token ใช้ custom modal กับ selection เดิม ตรวจ accessibility และ content SEO แก้ safe body HTML ผ่าน Source mode และเก็บ unsupported visual markup แบบ lossless ได้ การ Apply source ที่ผิดต้องไม่เปลี่ยน document ส่วน HTML ที่ถูกต้องต้อง undo/redo และโหลดกลับมาโดยความหมายเหมือนเดิม CMS preview กับเว็บไซต์ใช้ content stylesheet ชุดเดียวกันโดยหน้าเว็บไซต์ไม่โหลด editor runtime

## สมมติฐาน

- MVP เน้น desktop ก่อนและรองรับ evergreen browser รุ่นปัจจุบันเป็นลำดับแรก
- เนื้อหาจาก TinyMCE ส่วนใหญ่อยู่ในชุด element และ attribute ที่ MVP รองรับ
- Engine และ adapter จะพัฒนาด้วย TypeScript
- รายการ “กำหนดรูปแบบฟ้อน” ที่ระบุซ้ำหมายถึง font family use case เดียวกัน
- “สีพื้นหลังฟ้อน” หมายถึง text highlight และ “สีพื้นหลัง” หมายถึงพื้นหลังระดับ block
- “Accessibility ตามมาตรฐาน” หมายถึง WCAG 2.2 Level AA

## คำถามที่ยังเปิดอยู่

- ต้องรองรับ browser รุ่นต่ำสุดใดบ้าง และต้องรองรับการแก้ไขบน mobile ระดับใด?
- Table, media embed และ custom TinyMCE markup ชนิดใดต้องมี visual plugin ใน MVP แทนการแสดงเป็น `RawHtmlNode`?
- Image upload integration ต้องรองรับ request, response, authentication และ asset metadata แบบใด?
- สีพื้นหลังต้องใช้กับ block ที่เลือกหรือพื้นหลังของพื้นที่ editor ทั้งหมด?
- Legacy inline color, font-size และ font-family จาก TinyMCE ต้อง map เป็น token อย่างไรเมื่อไม่มีค่าที่ตรงกัน?
- iframe, audio และ video อนุญาต host, protocol และ attribute ใดบ้าง?
