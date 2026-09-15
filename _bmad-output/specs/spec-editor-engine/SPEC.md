---
id: SPEC-editor-engine
companions:
  - architecture.md
  - html-contract.md
sources: []
---

> **สัญญาหลักของระบบ:** `SPEC.md` และไฟล์ใน `companions:` เป็นข้อกำหนดฉบับสมบูรณ์สำหรับการพัฒนา ทดสอบ และตรวจรับระบบ

# Engine สำหรับ Rich-Text Editor ที่ขยายความสามารถได้

## เหตุผล

CMS ปัจจุบันใช้ TinyMCE แก้ไขเนื้อหา HTML ที่เป็นส่วนหนึ่งของข้อมูลหน้าเพจ แต่การปรับแต่งให้เข้ากับผลิตภัณฑ์ทำได้ยากและมีค่า license จึงต้องสร้าง editor ภายในที่ทีมควบคุม extension point, ส่วนติดต่อผู้ใช้, HTML output และทิศทางการพัฒนาได้เอง โดยไม่ตั้งเป้าให้มีความสามารถเทียบเท่า TinyMCE ทั้งหมด

## ความสามารถ

- **CAP-1**
  - **เจตนา:** ผู้ใช้ CMS สามารถโหลด HTML เดิมที่รองรับ แก้ไข และบันทึกกลับเป็น HTML ที่มีความหมายเท่าเดิมสำหรับแสดงผลบนเว็บไซต์
  - **เกณฑ์สำเร็จ:** ชุด fixture สามารถ import, แก้ไข, export และโหลด HTML เดิมกลับมาใหม่ โดยข้อความ รูปแบบ ลิงก์ รายการ หัวข้อ blockquote, code block และรูปภาพที่รองรับไม่สูญหาย

- **CAP-2**
  - **เจตนา:** ผู้ใช้ CMS สามารถสร้างและจัดรูปแบบเนื้อหาทั่วไปของหน้าเว็บไซต์ได้
  - **เกณฑ์สำเร็จ:** ผู้ใช้สร้าง paragraph, heading, blockquote, ordered list, unordered list, code block, bold, italic, underline, strikethrough, link และ image ได้จาก toolbar และ keyboard shortcut ที่ระบุไว้

- **CAP-3**
  - **เจตนา:** ทีมผลิตภัณฑ์สามารถเพิ่มชนิดเนื้อหาและพฤติกรรมการแก้ไขได้โดยไม่แก้ editor core
  - **เกณฑ์สำเร็จ:** Callout plugin เพิ่ม node, command, shortcut, HTML parser และ serializer ผ่าน extension point สาธารณะเท่านั้น และนำเข้า/ส่งออกข้อมูลกลับไปกลับมาได้สำเร็จ

- **CAP-4**
  - **เจตนา:** แอป React สามารถใช้ editor เป็น form field ที่นำกลับมาใช้ซ้ำได้ โดย form หลักเป็นผู้ควบคุมการบันทึกข้อมูล
  - **เกณฑ์สำเร็จ:** React form กำหนด HTML เริ่มต้น ตรวจจับ dirty/change state อ่านหรือแทนที่ HTML ปัจจุบัน ตลอดจนสั่ง focus, clear, undo และ redo ได้โดยไม่ import type ภายในของ engine

- **CAP-5**
  - **เจตนา:** แอป Next.js สามารถแก้ไขเนื้อหาฝั่ง client และ render HTML ที่บันทึกแล้วฝั่ง server โดยไม่ส่ง editor bundle ไปยังหน้าเว็บไซต์สาธารณะ
  - **เกณฑ์สำเร็จ:** ตัวอย่าง integration ของ Next.js โหลด editor ภายใน client boundary และหน้า server-rendered แยกต่างหากแสดง sanitized HTML ได้โดยไม่มี editor runtime ใน client bundle

- **CAP-6**
  - **เจตนา:** ทีมผลิตภัณฑ์สามารถประกอบและกำหนด theme ของส่วนติดต่อ editor ได้อย่างอิสระ
  - **เกณฑ์สำเร็จ:** Toolbar control สามารถเพิ่ม ลบ และจัดลำดับใหม่ได้ และสามารถกำหนด typography, สี, spacing, focus, disabled และ error state โดยไม่แก้ editor core

- **CAP-7**
  - **เจตนา:** ผู้ใช้สามารถแก้ไขเนื้อหาโดยข้อมูลไม่เสียหายในกรณีทั่วไปของ selection, history, clipboard, keyboard และ text composition
  - **เกณฑ์สำเร็จ:** Automated test และ browser-level test ครอบคลุม collapsed/ranged selection, selection ข้าม block, undo/redo, shortcut, plain/rich paste และ Thai IME composition โดยข้อความไม่ซ้ำ สูญหาย หรือสลับลำดับ

- **CAP-8**
  - **เจตนา:** แอปที่นำ editor ไปใช้สามารถกำหนดขั้นตอนอัปโหลดรูปเอง และผู้ใช้สามารถเพิ่มรูปที่เข้าถึงได้ในเนื้อหา
  - **เกณฑ์สำเร็จ:** Editor เรียก upload handler ที่แอปส่งให้ แทรก URL ของ asset ที่ได้รับ เปิดให้แก้ alt text และ export เป็น HTML รูปภาพตามสัญญา

- **CAP-9**
  - **เจตนา:** Form หลักสามารถตรวจสอบได้อย่างเชื่อถือได้ว่าเนื้อหามีการเปลี่ยนแปลงหรือไม่ และรับ HTML ที่มีผลลัพธ์แน่นอนเพื่อนำไปบันทึก
  - **เกณฑ์สำเร็จ:** Document state ที่เทียบเท่ากัน serialize เป็น normalized HTML ที่คงที่ และ dirty state จะกลับเป็น clean หลัง host ยืนยัน saved snapshot แล้วเท่านั้น

## ข้อจำกัด

- HTML ยังคงเป็นสัญญาสำหรับจัดเก็บใน CMS และแสดงผลบนเว็บไซต์ ส่วน editor ใช้ structured document model เฉพาะระหว่างแก้ไข
- Core engine เป็น headless และต้องไม่ขึ้นกับ React, Next.js, toolbar component, CSS ของแอป หรือ persistence API
- การเปลี่ยน document ต้องผ่าน command และ transaction ที่ตรวจสอบแล้ว Plugin ห้ามแก้ internal state โดยตรง
- React integration และ DOM integration ต้องแยกจาก core เพื่อเพิ่ม UI adapter อื่นได้โดยไม่เปลี่ยน document engine
- Editor UI บน Next.js ทำงานเฉพาะฝั่ง client ส่วนหน้าเว็บไซต์สาธารณะต้องไม่ต้องใช้ editor runtime
- ต้อง sanitize HTML ฝั่ง server ด้วย allowlist ก่อน render ข้อมูลที่ไม่น่าเชื่อถือ การ parse ฝั่ง client ไม่ถือเป็น security boundary
- HTML เดิมที่รองรับต้องมี compatibility fixture จากข้อมูล production ก่อนย้ายออกจาก TinyMCE

## สิ่งที่ไม่อยู่ในขอบเขต

- การรองรับหรือมีความสามารถเทียบเท่า TinyMCE ทั้งหมด
- Real-time collaboration, comment, track changes, table, video embed, raw HTML source editing และ block drag-and-drop ใน MVP
- การรักษา arbitrary HTML, whitespace หรือลำดับ attribute ให้เหมือนเดิมทุกตัวอักษร
- การ server-side render ตัว editor ที่โต้ตอบได้
- การจัดการ persistence, publishing workflow หรือ metadata ของหน้า CMS

## สัญญาณความสำเร็จ

หน้า CMS บน Next.js โหลด HTML ตัวอย่างจาก TinyMCE เปิดให้ผู้ใช้พิมพ์ภาษาไทยผ่าน IME แก้ไขและจัดรูปแบบ เพิ่ม callout ด้วย plugin ทำ undo/redo บันทึกเป็น deterministic HTML และโหลดกลับมาโดยความหมายของเนื้อหาเหมือนเดิมได้ หน้าเว็บไซต์สาธารณะ render ผลลัพธ์ที่ผ่านการ sanitize โดยไม่โหลด editor runtime

## สมมติฐาน

- MVP เน้น desktop ก่อนและรองรับ evergreen browser รุ่นปัจจุบันเป็นลำดับแรก
- เนื้อหาจาก TinyMCE ส่วนใหญ่อยู่ในชุด element และ attribute ที่ MVP รองรับ
- Engine และ adapter จะพัฒนาด้วย TypeScript

## คำถามที่ยังเปิดอยู่

- ต้องรองรับ browser รุ่นต่ำสุดใดบ้าง และต้องรองรับการแก้ไขบน mobile ระดับใด?
- HTML เดิมที่ไม่รองรับควรถูกแกะ tag, ปฏิเสธทั้งเอกสาร หรือเก็บเป็น sanitized read-only node?
- ข้อมูล production มี table, media embed, inline style หรือ custom TinyMCE markup ที่ต้องรองรับใน MVP หรือไม่?
- Image upload integration ต้องรองรับ request, response, authentication และ asset metadata แบบใด?
- ต้องผ่านมาตรฐาน accessibility ระดับใด?
