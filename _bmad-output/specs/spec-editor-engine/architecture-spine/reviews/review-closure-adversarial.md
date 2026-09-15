# Closure Adversarial Review — Architecture Spine

## Verdict

**PARTIAL CLOSURE — ยังไม่พร้อมใช้เป็นสัญญาสำหรับ parallel implementation โดยไม่มี coordination เพิ่มเติม**

Revision นี้ปิดช่องเดิมได้จริงหลายส่วน: AD-18 ระบุ owning package ของ public shapes, AD-19 ผูก transaction/revision/snapshot และ save acknowledgement, AD-20 กัน React/plugin ออกจาก editable DOM, AD-21 ผูก HTML กับ stylesheet rollout, AD-22 เพิ่ม staged publish/rollback intent และ AD-23 ทำ raw node เป็น opaque boundary อย่างไรก็ตาม counterexample ที่ใช้ทีมสร้าง core, DOM/React, HTML/content และ release workflow แยกกันยังให้ผล incompatible ได้จาก semantics ที่ยังไม่ถูกกำหนดด้านล่าง

## Closure matrix

| Prior hole | Status | Closure evidence | Remaining divergence |
| --- | --- | --- | --- |
| Canonical owners | Partial | AD-18 ระบุ `editor-core`/`editor-html` เป็นเจ้าของ type | Structural Seed ยังบอกว่า `editor-content` เป็นเจ้าของ token registry; type identity/version compatibility ยังไม่ถูกบังคับใน tarball |
| Browser mutation ownership | Partial | AD-20 กำหนด DOM adapter เป็น browser event receiver เดียวและห้าม React/plugin แก้ subtree | AD-1 ยังบอก core เป็นเจ้าของ input/composition/clipboard โดยไม่แบ่ง semantic responsibility; cancel/flush rule ยังอ้าง “explicit rule” ที่ไม่มี |
| Selection/revision ordering | Partial | AD-19 กำหนด shape, monotonic revision, operation mapping, synchronous publication และ revision+digest acknowledgement | `offset` unit, `affinity` semantics, node-ID lifetime และ exact subscriber/dispatch boundary ยังเปิดให้ตีความต่างกัน |
| HTML/token contracts | Partial | AD-18 ให้ HTML AST/policy มี owner; AD-21 ผูก stylesheet/sanitizer rollout; AD-23 ระบุ opaque lossless raw node | จุดตัด raw fragment ก่อน/หลัง parse/sanitize และ normative policy equivalence ยังไม่ระบุ; token owner ใน seed ขัด AD-18 |
| Release cohorts/rollback | Partial | AD-9 ต้องมี cohort manifest; AD-22 publish ใต้ temporary tag, smoke test และคืน last-known-good | npm dist-tag promotion ไม่ atomic, manifest ไม่ถูกผูกกับ dependency resolution และ prerelease dependency closure ยังไม่กำหนด |

## Remaining critical/high divergence findings

### 1. Token-registry owner ยังมีสองคำตอบใน artifact เดียว

- **location:** AD-18; Structural Seed `packages/editor-content`
- **trigger_condition:** AD-18 ระบุว่า `editor-core` เป็นเจ้าของและ export token-registry interface แต่ Structural Seed ระบุ `editor-content` ว่า “token registry contract and content.css”; ทีม content จึงมีเหตุผลตามเอกสารที่จะประกาศ contract ของตัวเอง
- **guard_snippet:** แก้ Structural Seed ให้ชัดว่า `editor-content` มีเฉพาะ versioned CSS/generated token artifacts และ import canonical token-registry interface จาก `editor-core`; เพิ่ม invariant ว่า package นี้ห้าม export competing registry shape
- **potential_consequence:** HTML/sanitizer/core รับ registry คนละ shape หรือ fingerprint ขณะที่ CSS build สำเร็จแต่ไม่มี class ตรงกับ token ที่ serializer emit

### 2. Canonical selection shape ยังไม่ใช่ canonical coordinate system

- **location:** AD-19
- **trigger_condition:** `{nodeId, offset, affinity}` ระบุชื่อ field แต่ไม่ระบุว่า `offset` นับ UTF-16 code units, Unicode code points, grapheme clusters หรือ child slots และไม่กำหนดความหมายของ affinity ที่ insert/delete/split/join boundary
- **guard_snippet:** Tighten AD-19 ให้กำหนด offset unit แยก text/container positions, valid range, normalization และ affinity result ต่อ operation ทุกชนิด; บังคับ shared fixtures สำหรับ surrogate pairs, combining marks, Thai grapheme clusters และ element boundaries
- **potential_consequence:** DOM adapter กับ core compile ผ่าน type เดียวกันแต่ map caret/bookmark/fix ไปคนละตำแหน่ง โดยเฉพาะภาษาไทยและ emoji

### 3. Node-ID lifetime ไม่รองรับ checker/bookmark contract อย่างแน่นอน

- **location:** AD-18; AD-19; AD-17
- **trigger_condition:** Core เป็นเจ้าของ node IDs แต่ไม่มี rule ว่า ID คงอยู่ผ่าน transaction ใด, undo/redo, `setHtml`, Source Apply, parse/serialize หรือ clone อย่างไร และ reuse ID หลังลบได้หรือไม่
- **guard_snippet:** เพิ่ม node-identity invariant: ID unique ต่อ editor lifetime, ห้าม reuse, preserved for logically surviving nodes through operation maps, regenerated on document replacement, และ external result/bookmark ต้อง fail closed เมื่อ document epoch เปลี่ยน; เพิ่ม `documentEpoch` หาก revision อย่างเดียวแยก replacement ไม่พอ
- **potential_consequence:** checker result หรือ bookmark ที่ revision/digest ดูถูกต้องอาจอ้าง node คนละตัวหลัง replace/undo ทำให้ focus หรือ fix เปลี่ยนเนื้อหาผิดจุด

### 4. AD-1 กับ AD-20 ยังแบ่ง input/composition/clipboard ownership ไม่ลงตัว

- **location:** AD-1; AD-20
- **trigger_condition:** AD-1 ให้ทีม/core เป็นเจ้าของ input, composition และ clipboard behavior ขณะที่ AD-20 ให้ DOM adapter เป็น event owner และถือ transient composition buffer แต่ไม่ระบุว่า layer ใดตัดสิน semantic edit, paste transform, history grouping และ invalid-composition recovery
- **guard_snippet:** Tighten AD-1/AD-20 เป็น normative port split: DOM owns capture/capability/DOM mapping only; core owns typed editing intents, document transforms, validation และ history boundaries; ระบุ payload/result ของ composition/paste intents และห้าม adapter normalize document content เอง
- **potential_consequence:** browser adapters commit composition หรือ sanitize/normalize paste ต่างกัน ทำให้ document/history แตกต่างทั้งที่ทุก mutation สุดท้ายผ่าน command

### 5. Composition cancellation rule ถูกอ้างแต่ไม่มี contract

- **location:** AD-20
- **trigger_condition:** ข้อความ “commit เข้า core ครั้งเดียวเมื่อจบหรือยกเลิกตาม explicit rule” ไม่มี explicit rule สำหรับ `compositioncancel`, blur, DOM replacement, editor disposal, interrupted `beforeinput`, browser ที่ไม่ส่ง `compositionend` หรือ selection ย้ายออก
- **guard_snippet:** เพิ่ม composition state table ระบุ event sequence → action (`commit`, `discard`, `reconcile`, `fail`) → history/revision/selection effect และ recovery timeout/blur behavior; ใช้ตารางเดียวกันเป็น Playwright/Thai IME fixture
- **potential_consequence:** ทีมหนึ่ง discard buffer แต่อีกทีม commit เมื่อ blur/dispose ทำให้ตัวอักษรหาย ซ้ำ หรือ undo boundary แตกต่างตาม browser

### 6. Opaque lossless raw HTML ยังไม่มี capture boundary ที่ browser/server ทำตรงกันได้

- **location:** AD-5; AD-6; AD-23; Consistency Conventions — HTML
- **trigger_condition:** AD-5 บังคับ native DOM parser ใน browser และ parse5 ใน server ขณะที่ AD-23 บังคับ unsupported subtree เป็น lossless แต่ไม่ระบุว่า raw string ถูกตัดจาก input ก่อน parse, หลัง syntax repair, หลัง policy validation หรือหลัง sanitizer และ whitespace รอบ subtree เป็นของ node ใด
- **guard_snippet:** Tighten AD-23 ด้วย pipeline เดียว: validate/tokenize source with location spans → policy verdict → classify subtree → preserve exact Unicode slice plus boundary metadata; ห้ามสร้าง raw payload ด้วย DOM/parse5 reserialization; ระบุ handling ของ malformed-but-parser-repairable markup และ adjacent whitespace
- **potential_consequence:** browser/server สร้าง `RawHtmlNode` boundaries หรือ payload ต่างกัน ทำให้ semantic document, digest, dirty state และ Source round-trip แตกต่าง

### 7. Sanitizer parity ยังเทียบผลกับสิ่งที่ไม่มี normative semantics

- **location:** AD-6; AD-18
- **trigger_condition:** Fixtures ต้องเทียบ policy verdict และ normalized safe AST แต่ `ContentPolicy` มีเพียง owning package และ restricted defaults ไม่มี normative URL canonicalization, namespace handling, duplicate attribute behavior, CSS parsing หรือ rule เมื่อ DOMPurify/sanitize-html express policy ได้ไม่เท่ากัน
- **guard_snippet:** เพิ่ม AD สำหรับ policy semantics: pure evaluator/canonical URL algorithm, default-deny fields, compiler capability validation และ rule ว่าค่า config ที่ backend ใดบังคับไม่ได้ต้อง reject ตอนสร้าง policy; fixtures ต้องมี authoritative expected verdict/AST ไม่ใช่แค่เทียบ adapter สองตัวเข้าหากัน
- **potential_consequence:** sanitizer ทั้งสองอาจ “ตรงกัน” ใน fixture ที่ไม่ครอบ หรือ diverge บน malformed/encoded attack; server security boundary อนุญาต semantic ที่ policy owner ไม่ได้ตั้งใจ

### 8. Public-owner rule ไม่ป้องกัน duplicate runtime copies ใน `editor-react`

- **location:** AD-10; AD-18; dependency graph
- **trigger_condition:** Private DOM/source ต้องถูก bundle แต่ไม่มี rule ว่า `editor-core`, `editor-html`, React และ owner-provided runtime values ต้อง externalize หรือมี singleton identity; bundler สามารถฝัง core/html สำเนาหนึ่งและรับ engine/plugin จาก consumer ที่ใช้สำเนาอีกชุด
- **guard_snippet:** เพิ่ม runtime-boundary AD: `editor-react` bundle ได้เฉพาะ private code, externalize public runtime owners กับ React, declare reviewed peer/runtime ranges และ packed test ต้องยืนยัน dependency tree ไม่มี duplicate owner runtime พร้อมทดสอบ consumer-imported engine/plugin ข้าม package
- **potential_consequence:** types compile แต่ symbols, contexts, plugin registry, `instanceof` checks หรือ engine handles มาจากคนละ runtime ทำให้ integration fail แบบหาเหตุยาก

### 9. Client boundary ยังไม่กำหนด export/evaluation behavior

- **location:** AD-7; Public imports convention
- **trigger_condition:** “browser entry point ต้องมี client boundary” ไม่ระบุ root/subpath exports, `browser`/`node`/`react-server` conditions, top-level side effects หรือห้าม server-safe entry re-export value จาก DOM module
- **guard_snippet:** Tighten AD-7 ด้วย normative exports matrix; server-safe entry ต้องไม่มี transitive DOM/client import และห้ามอ่าน browser globals ตอน module evaluation; เพิ่ม Node import test และ Next.js RSC/SSR fixture จาก packed tarball สำหรับทุก public subpath
- **potential_consequence:** independently built React adapter ผ่าน browser test แต่ทำ Next.js server build crash เพียง import utility หรือ root package

### 10. Cohort manifest ยังไม่บังคับ npm ให้ resolve compatible set

- **location:** AD-9; AD-12; AD-22
- **trigger_condition:** AD-9 ต้อง “สร้าง” tested manifest แต่ไม่กำหนด schema, publication/discovery, dependency-range validation หรือว่า `latest` ของ package ที่ไม่เปลี่ยนต้องอยู่ใน cohort อย่างไร; consumer ยังติดตั้งแต่ละ package โดย resolver ปกติซึ่งไม่อ่าน manifest
- **guard_snippet:** เพิ่ม cohort invariant: signed/machine-readable manifest มี exact versions, HTML/CSS/policy contract versions และ digest; internal dependency/peer ranges ต้องรับเฉพาะ compatible versions; release gate ติดตั้งจาก empty lockfile ผ่าน registry resolver; publish manifest ใน stable package/metadata ที่ consumer tooling ตรวจได้
- **potential_consequence:** ทุก package publish ถูกต้องและ manifest ถูกต้อง แต่ `npm install ...@latest` ยังเลือกชุดที่ไม่ใช่ชุดที่ smoke-test

### 11. Rollback ของหลาย `latest` tags ยังมี transient mixed-cohort window

- **location:** AD-22
- **trigger_condition:** npm ไม่มี atomic multi-package dist-tag transaction; การ “เลื่อน `latest` ของทุก package” และ “คืน dist-tags” ทีละตัวทำให้ consumer ที่ติดตั้งระหว่าง promotion/rollback เห็นครึ่ง cohort ใหม่ครึ่ง cohort เก่า
- **guard_snippet:** Tighten AD-22 ให้ dependency closure ปลอดภัยแม้ tag ขยับทีละตัว: publish exact internal versions, promote leaf/dependency order ที่พิสูจน์แล้ว, เลื่อน single consumer-facing meta/cohort pointer เป็นขั้นสุดท้าย หรือห้าม docs ใช้ independent latest; run continuous install probes ระหว่าง promotion และกำหนด forward-fix procedure เมื่อ mixed window ถูกใช้ไปแล้ว
- **potential_consequence:** release ที่สุดท้าย rollback สำเร็จยังสร้าง lockfile เสียให้ consumer บางรายในช่วงกลาง และไม่สามารถเยียวยาด้วยการคืน tag ภายหลัง

### 12. Canary/beta dependency closure ยังเปิดให้ทดสอบ artifact คนละชุดกับที่ consumer ได้

- **location:** AD-12; AD-14; AD-22
- **trigger_condition:** ช่อง canary/snapshot/beta ไม่มี rule เรื่อง prerelease version format, rewriting internal ranges, removal of `workspace:*`, exact cohort pinning หรือ promotion artifact identity; packed smoke test สามารถใช้ lockfile เดิมแล้วผ่าน ขณะที่ registry install resolve ไป stable dependency
- **guard_snippet:** Tighten AD-14: prerelease ทุกตัว pin exact package versions จาก run/cohort เดียวกัน, tarball ห้ามมี workspace protocol, test จาก empty lockfile/isolated registry และ beta→latest ต้อง promote immutable artifact เดิมหรือ verify reproducible digest equality
- **potential_consequence:** canary/beta ที่ผ่าน gate ไม่ใช่ runtime graph ที่ผู้ใช้ติดตั้งจริง และปัญหา compatibility ปรากฏหลัง stable promotion

## Closure decision

ไม่พบเหตุให้ย้อน AD-18–AD-23; ควรเก็บไว้ทั้งหมด แต่ก่อนเริ่ม implementation แยกทีมควรปิดอย่างน้อย findings 1–7 และ 10–12 ซึ่งยังชน contract หลักที่ closure รอบนี้ตั้งใจแก้ ส่วน findings 8–9 ต้องปิดก่อนสร้าง packed public packages/Next.js consumer fixture เพราะเป็น package-runtime failures ที่ monorepo tests มักมองไม่เห็น
