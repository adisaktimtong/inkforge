# Adversarial Compatibility Review — Architecture Spine

## Verdict

**ยังไม่เป็น build substrate ที่ปลอดภัยสำหรับการพัฒนาแยกทีม** แม้ AD ทั้ง 17 ข้อจะกำหนดทิศทาง dependency, purity, security, testing และ release intent ได้ดี แต่ยังไม่กำหนด contract ที่วิ่งข้าม package boundary ให้เป็น canonical และตรวจสอบได้ สองทีมจึงสามารถทำตามข้อความทุกข้อแบบ literal แล้วได้ package ที่ compile แยกกัน ผ่าน test แยกกัน และยังประกอบกันไม่ได้หรือให้ผลต่างกันใน runtime

## Concrete split-build counterexample

สมมติแบ่งงานโดยไม่มีการสื่อสารเพิ่มเติมนอกจาก spine:

### Unit A — Kernel + persistence

- `editor-core` ใช้ position เป็น `{ nodeId, utf16Offset, affinity: 'left' | 'right' }`, เพิ่ม `revision` เฉพาะเมื่อ document เปลี่ยน และเรียก subscriber แบบ synchronous หลัง commit
- `editor-html` เก็บ `RawHtmlNode.html` เป็น source fragment หลัง security validation แต่ก่อน canonical entity/quote normalization และใช้ plugin parse rule ตัวแรกที่ match
- `editor-content` ส่ง token registry type ของตัวเองและเผยแพร่ `content.css` แยกเวอร์ชันจาก core
- รุ่น `editor-core@0.8`, `editor-html@0.8`, `editor-content@0.7` ถูก publish ด้วย Changesets, provenance และ `latest` ตามลำดับ package

Unit A ยังทำตาม AD-1–AD-6, AD-9 และ AD-13–AD-15: core เป็น pure state machine, mutation เป็น atomic transaction, HTML ใช้ normalized AST/canonical serializer, policy เป็น source of truth และ package version แยกกัน

### Unit B — Interaction + checks + delivery

- `internal/editor-dom` สร้าง position เป็น `{ path, codePointOffset, bias: 'forward' | 'backward' }`, คาดว่า selection change เพิ่ม revision และ debounce subscription เป็น microtask เพื่อรวม render
- `editor-checks` เก็บ `nodeId` จาก snapshot ข้าม parse/reload และถือว่า ID นั้น stable; plugin HTML rule เลือก rule ที่ specificity สูงสุด
- `editor-react` bundle DOM/source ตาม AD-10, externalize `editor-core` ด้วย range ที่ review แล้ว และ import `editor-html/browser` ผ่าน export path ที่ทีมกำหนดเอง; server export re-export type/value จาก browser module
- release ของ `editor-react@0.7` และ `editor-checks@0.7` ผ่าน Chromium/สาม browser, packed-tarball smoke test, approval และ Trusted Publishing โดยทดสอบกับ dependency set ใน lockfile ของ Unit B

Unit B ยังทำตาม AD-2–AD-4, AD-7, AD-10–AD-15 และ AD-17 แบบ literal: DOM ไม่เป็น source of truth, mutation dispatch ผ่าน command, private packages ถูก bundle, browser behavior ทดสอบใน browser จริง และ release มี gate/provenance

### จุดที่ประกอบกันไม่ได้

1. DOM adapter ส่ง selection shape และ offset unit ที่ core ไม่รู้จัก จึง restore caret ผิดตำแหน่งทันทีเมื่อมี emoji/combining mark/ภาษาไทย
2. React ไม่ได้รับ snapshot หลัง selection-only change ตามเวลาที่คาด ทำให้ toolbar state stale และ `useSyncExternalStore` อาจเห็น snapshot/event ordering ที่ไม่สอดคล้องกัน
3. Checker อ้าง node ID เก่าหลัง HTML reload ซึ่ง Unit A มีสิทธิ์สร้าง ID ใหม่ ทำให้ focus/fix ไปยัง node ผิดหรือใช้ไม่ได้
4. Plugin HTML mapping ของสองฝั่งเลือก rule คนละตัวแม้ใช้ plugin set เดียวกัน จึง parse/serialize ไม่เป็น semantic round-trip
5. `editor-react@latest` อาจ resolve กับ `editor-core@latest`/`editor-content@latest` คนละ compatibility cohort แม้แต่ละ package ทำ SemVer ถูกต้องในตัวเอง
6. Server import สามารถประเมิน browser module ที่แตะ DOM ระดับ top-level เพราะคำว่า “client boundary” ไม่ได้กำหนด export conditions หรือ evaluation rule

ไม่มี AD ปัจจุบันข้อใดบังคับ shape, offset unit, event ordering, identity lifetime, plugin precedence, export condition หรือ compatible release set ที่จะตัด implementation ฝั่งใดฝั่งหนึ่งทิ้ง

## Findings

### 1. ไม่มีเจ้าของ canonical contracts ที่วิ่งข้ามทุกลูกศร

- **location:** Design Paradigm; AD-1–AD-4; Consistency Conventions
- **trigger_condition:** กราฟกำหนดว่า package ใดเรียก package ใด แต่ไม่กำหนด canonical TypeScript contracts สำหรับ `DocumentNode`, `EditorSelection`, `Operation`, `Transaction`, `EditorCommand`, `DispatchResult`, `Snapshot`, `EditorEvent`, `ContentPolicy`, plugin ports และ normalized HTML AST หรือ package/entry point ที่เป็นเจ้าของ type เหล่านี้
- **guard_snippet:** **เพิ่ม AD-18 — Canonical cross-package contracts:** “Contract ที่ข้าม package boundary ทุกชนิดต้องประกาศครั้งเดียวใน owning public package, export ผ่าน documented `exports` path, ห้าม adapter นิยาม shadow shape และต้องมี compile-time contract tests ที่ build consumer fixtures จาก packed tarball ของ compatibility set เดียวกัน” พร้อมตาราง `contract → owner → consumers → stability class`
- **potential_consequence:** ทีมสร้าง type ชื่อเดียวกันแต่ shape/semantics ต่างกัน; monorepo อาจผ่านด้วย path alias ขณะที่ packed packages compile ไม่ผ่านหรือ cast แล้วพังใน runtime

### 2. Ownership ของ input/composition/clipboard ขัดกันในระดับความหมาย

- **location:** AD-1; AD-2; Structural Seed (`internal/editor-dom`)
- **trigger_condition:** AD-1 บอกว่า core เป็นเจ้าของ input, composition และ clipboard behavior แต่ Structural Seed ให้ DOM adapter เป็นเจ้าของ input/composition/clipboard โดยไม่แบ่งว่า core เป็นเจ้าของ semantic transition ส่วน adapter เป็นเจ้าของ browser-event translation ตรงไหน
- **guard_snippet:** **แก้ AD-1:** “Core owns semantic editing intents, composition state transitions, clipboard document transforms และ validation; DOM adapter owns event capture, browser capability detection, DOM↔model mapping และแปลง browser event เป็น typed intent เท่านั้น Adapter ห้ามตัดสิน semantic mutation หรือเขียน history boundary เอง” และเพิ่ม port names สำหรับแต่ละทิศทาง
- **potential_consequence:** ทั้งสองชั้นอาจ normalize composition, split history หรือ sanitize paste ซ้ำ/ไม่ทำเลย ทำให้ IME, undo และ clipboard ให้ผลต่างกันตาม adapter

### 3. Mutation path ครอบคลุม document แต่ไม่ครอบคลุม state transition อื่น

- **location:** AD-2; AD-3; Consistency Conventions — Mutation
- **trigger_condition:** “ทุก document mutation” ต้องผ่าน transaction แต่ selection, stored marks, composition state, history cursor, saved baseline และ plugin registry เป็น engine-owned state เช่นกัน โดย spine ไม่บอกว่าอะไรต้องผ่าน transaction, event หรือ lifecycle transition ชนิดใด
- **guard_snippet:** **เพิ่ม AD-19 — State transition taxonomy:** “กำหนด transition แยกเป็น document transaction, selection transaction, composition session, history transition, baseline acknowledgement และ lifecycle transition; ทุกชนิดมี validation, revision/event effect และ forbidden direct-write rule ที่ระบุชัด”
- **potential_consequence:** adapter หนึ่งแก้ selection/stored marks โดยตรง แต่อีก adapter dispatch command; snapshot, dirty state, toolbar และ undo จึงไม่เห็น state เดียวกันแม้ document เท่ากัน

### 4. Selection contract ไม่ระบุ coordinate system หรือ mapping semantics

- **location:** AD-1; AD-3; AD-17; Capability → Architecture Map CAP-7
- **trigger_condition:** Spine เรียกรวมว่า selection mapping, bookmark และ node location แต่ไม่กำหนด offset unit (UTF-16/code point/grapheme), position shape, affinity/bias, boundary behavior, node deletion behavior หรือ bookmark invalidation rules
- **guard_snippet:** **เพิ่ม AD-20 — Canonical positions:** “Model position ใช้ canonical coordinate system เดียว พร้อม offset unit, affinity, normalization และ mapping rules ต่อ operation ทุกชนิด; DOM/check/checker/bookmark ต้องใช้หรือแปลงผ่าน owner-provided functions เท่านั้น; เพิ่ม cross-package fixtures สำหรับ surrogate pairs, combining marks, Thai clusters และ node deletion/split/join”
- **potential_consequence:** caret, selection restore, stale issue navigation และ automatic fix เลื่อนไปคนละตัวอักษรหรือคนละ node โดยเฉพาะ emoji และภาษาไทย

### 5. Dispatch, revision, snapshot และ event ordering ยังไม่มี temporal contract

- **location:** AD-3; AD-17; Consistency Conventions — Mutation/Errors
- **trigger_condition:** `dispatch`, `subscribe` และ `getSnapshot` ถูกตั้งชื่อแต่ไม่มีข้อกำหนดว่า dispatch synchronous หรือ async, subscriber ถูกเรียกก่อน/หลัง return, selection-only change เพิ่ม revision หรือไม่, revision เริ่ม/overflow อย่างไร, event reentrant ได้หรือไม่ และ callback error มีผลต่อ commit หรือไม่
- **guard_snippet:** **แก้ AD-3:** ระบุ state-machine timeline เช่น “`dispatch` sync และ non-reentrant; validate/commit → increment monotonic document revision เมื่อ doc เปลี่ยน → publish immutable snapshot synchronously exactly once → notify transaction observers; selection มี `selectionVersion` แยก; observer exception ไม่ rollback commit และถูกส่งเข้า error port” หรือเลือก semantics อื่นแต่ต้อง normative และทดสอบร่วม
- **potential_consequence:** `useSyncExternalStore`, checker staleness, history grouping และ toolbar state race กัน; adapter อาจพลาด update หรืออ่าน snapshot คนละรุ่นกับ event

### 6. Saved-baseline acknowledgement เปิด stale-ack race

- **location:** AD-3; HTML contract companion — สัญญาการบันทึก
- **trigger_condition:** Host “ยืนยัน normalized HTML snapshot เป็น baseline ใหม่” ได้โดยไม่มี required revision, canonicalization identity หรือ compare-and-set rule หาก save revision 5 สำเร็จหลังผู้ใช้แก้ถึง revision 7 การ acknowledge แบบ HTML-only อาจทำ editor clean ผิด
- **guard_snippet:** **เพิ่มใน AD-3:** “Baseline acknowledgement ต้องรับ `{revision, canonicalHtmlHash, serializerContractVersion, policyFingerprint}` จาก snapshot ที่ส่งบันทึก และ update baseline เฉพาะเมื่อ identity ตรงกับ known emitted snapshot; stale acknowledgement เก็บเป็น persisted checkpoint ได้แต่ห้ามทำ current state clean”
- **potential_consequence:** UI รายงานว่าไม่มี unsaved changes และผู้ใช้ออกจากหน้าได้ทั้งที่ revision ล่าสุดยังไม่ถูกบันทึก

### 7. Plugin contract ไม่มี deterministic registration และ execution semantics

- **location:** AD-1; AD-9; AD-12; Capability Map CAP-3
- **trigger_condition:** Plugin API ถูกนับเป็น compatibility surface แต่ spine ไม่กำหนด ID namespace/normalization, duplicate detection scope, dependency/order, parse-rule precedence, normalization convergence, command sync/async policy, exception containment หรือ API-version negotiation
- **guard_snippet:** **เพิ่ม AD-21 — Deterministic plugin lifecycle:** “Plugin descriptor ต้องมี immutable namespaced ID และ contract version; editor validates dependencies/conflicts before readiness; command/parse/serialize/normalize precedence เป็น deterministic total order; normalization ต้อง converge ภายใน bounded passes; plugin callback ห้าม mutate/reenter และ exception คืน typed failure โดยไม่ partial commit”
- **potential_consequence:** plugin set เดียวกันสร้าง schema หรือ HTML ต่างกันตาม registration order; plugin exception ทำ transaction ครึ่งทางหรือทำ editor loop ไม่จบ

### 8. `RawHtmlNode` แบบ lossless ชนกับ parser/sanitizer/canonical boundary ที่ไม่ระบุ

- **location:** AD-5; AD-6; Consistency Conventions — HTML
- **trigger_condition:** Spine ต้องการ lossless raw subtree และ canonical serializer พร้อมกัน แต่ไม่ระบุว่า “lossless” เริ่มก่อนหรือหลัง entity decoding, newline normalization, parser repair, sanitizer attribute rewrite และ browser/server serialization; native DOM parser กับ parse5 มีสิทธิ์สร้าง lexical form ต่างกัน
- **guard_snippet:** **แก้ AD-5:** กำหนด normative raw-fragment pipeline และ equality guarantee: source bytes/Unicode string ที่ช่วงใดถูกเก็บ, security validation ทำก่อนหรือหลัง capture, wrapper boundary/namespace handling, และ browser/server ต้องคืน representation เดียวกันหรือ raw processing ต้องใช้ implementation กลางที่ไม่ round-trip ผ่าน DOM serializer
- **potential_consequence:** safe unsupported HTML เปลี่ยนเฉพาะใน browser หรือ server, signature/diff เพี้ยน และ Source → Visual → Source ไม่ผ่าน lossless acceptance

### 9. “ContentPolicy เป็น source of truth” ยังไม่รับประกัน sanitizer equivalence

- **location:** AD-6; fixtures/security
- **trigger_condition:** DOMPurify และ sanitize-html มี option model, URL parsing, namespace, mutation behavior และ malformed-markup recovery ต่างกัน การบอกให้ compile policy และใช้ fixtures ชุดเดียวกันไม่ระบุ normative expected result, policy defaults, compiler completeness หรือ parity criterion
- **guard_snippet:** **เพิ่ม AD-22 — Policy semantics and conformance:** “ประกาศ pure normative `evaluateContentPolicy` semantics, default-deny behavior, URL canonicalization และ policy fingerprint; sanitizer compiler ต้อง prove/fixture-test allow/reject/result-equivalence ต่อ normative corpus รวม malformed inputs; ความสามารถที่ backend ใด express ไม่ได้ต้องถูกปฏิเสธตั้งแต่ configuration”
- **potential_consequence:** HTML เดียวกันผ่าน browser แต่ถูกแก้หรือปฏิเสธบน server หรือแย่กว่านั้นคือผ่าน server boundary ด้วย semantic ที่ policy ไม่ได้ตั้งใจอนุญาต

### 10. `editor-content` ไม่มี dependency edge แต่ถูกคาดให้แชร์ token contract

- **location:** AD-4 dependency graph; AD-8; Structural Seed; Consistency Conventions — CSS
- **trigger_condition:** กราฟวาง `editor-content` เป็น isolated node ขณะที่ token registry, effective prefix และ stable classes ต้องสอดคล้องกับ core, HTML, sanitizer, React wrapper และ checks แต่ไม่ระบุว่า type/config contract อยู่ที่ใดและ package เหล่านี้รับ policy instance เดียวกันอย่างไร
- **guard_snippet:** **แก้ AD-4/AD-8:** ย้าย canonical token/prefix contract ไป owning package ที่ทุก consumer import ได้โดยไม่สร้าง cycle (เช่น `editor-core` contract-only export หรือ package contract เฉพาะ) และกำหนดว่า `editor-content` เป็น CSS artifact ที่สร้าง/ตรวจจาก registry schema version เดียวกัน ไม่ใช่เจ้าของ type อิสระ
- **potential_consequence:** serializer emit class ที่ stylesheet ไม่มี, sanitizer ลบ class ที่ core ยอมรับ หรือ checker resolve contrast จาก registry คนละชุด

### 11. การ bundle private adapters ไม่ป้องกัน duplicate runtime identity

- **location:** AD-4; AD-10; Structural Seed
- **trigger_condition:** AD-10 บังคับให้ bundle `editor-dom`/`editor-source` แต่ไม่ระบุ externalization ของ `editor-core`, `editor-html`, React และ singleton/type identity; bundler สามารถฝัง core/html สำเนาหนึ่งใน `editor-react` พร้อมรับ instance/plugin จาก core อีกสำเนาของ consumer โดยไม่เกิด unresolved private dependency
- **guard_snippet:** **เพิ่ม AD-23 — Runtime identity and bundle boundary:** “`editor-react` ต้อง externalize public runtime dependencies ตาม manifest ที่กำหนด, bundle เฉพาะ private implementation, ห้าม duplicate `editor-core`/React instance, และ packed-tarball test ต้องตรวจ dependency tree + instance interoperability กับ consumer-imported engine/plugin”
- **potential_consequence:** `instanceof`, symbol registries, plugin types, context และ engine handles ไม่เข้ากัน แม้ชื่อ package/version ดูถูกต้อง; bundle ใหญ่และ state แยกสองชุด

### 12. Client boundary ไม่ได้กำหนด conditional-export และ evaluation contract

- **location:** AD-7; Public imports convention
- **trigger_condition:** “browser entry point ต้องมี client boundary” และ “server/public rendering ห้ามโหลด editor runtime” ไม่กำหนด `exports` map, `react-server`/`browser`/`node` conditions, top-level side-effect rule หรือว่า type-only re-export จะหลีกเลี่ยง runtime evaluation อย่างไร
- **guard_snippet:** **แก้ AD-7:** ระบุ public subpaths และ conditions แบบ normative; server-safe entry ห้ามมี transitive DOM/React client import และห้ามอ่าน `window`/`document` ระดับ module; เพิ่ม SSR import test ที่ evaluate ทุก server export ใน Node และ Next.js React Server Component fixture จาก packed tarball
- **potential_consequence:** Next.js build หรือ SSR crash เพียงเพราะ import utility/type จาก root entry แม้ consumer ไม่ได้ render editor

### 13. Independent SemVer ไม่มีแนวคิด compatible release set

- **location:** AD-9; AD-12; AD-14; release diagram
- **trigger_condition:** แต่ละ package version แยกได้และ dependent bump เมื่อ range ไม่รองรับ แต่ไม่มี compatibility matrix, minimum/maximum peer ranges, tested resolution set หรือ install command ที่รับประกันว่า `latest` ของทุก package ทำงานร่วมกัน โดยเฉพาะ `editor-content` ซึ่งอาจไม่มี runtime dependency edge
- **guard_snippet:** **เพิ่ม AD-24 — Compatibility cohorts:** “ทุก release สร้าง machine-readable compatibility manifest ระบุ exact package set ที่ผ่าน full gate; `latest` ของ public packages ต้อง resolve เป็น cohort ที่ทดสอบร่วมกัน; peer/runtime ranges และ content-contract range ต้อง encode compatibility; smoke test ติดตั้งจาก registry-like resolver โดยไม่มี workspace/lockfile leakage”
- **potential_consequence:** ผู้ใช้ติดตั้ง latest ตามเอกสารแล้วได้ core, React, HTML และ CSS ที่แต่ละตัวถูกต้องตาม SemVer แต่ทำงานร่วมกันไม่ได้

### 14. Multi-package publish และ dist-tag promotion ไม่มี failure/recovery invariant

- **location:** AD-13; AD-14; release diagram
- **trigger_condition:** npm publish หลาย package, provenance, git tags และ GitHub Release ไม่เป็น atomic operation Spine ไม่บอก publish order, retry/idempotency, partial-publish handling, dist-tag promotion, tag immutability หรือใครตรวจว่าทุก package อยู่ครบก่อน `latest`
- **guard_snippet:** **เพิ่ม AD-25 — Recoverable release transaction:** “Publish immutable versions ไป staging tag ก่อน, verify provenance/tarball/compatibility cohort จาก registry, แล้ว promote dist-tags เฉพาะเมื่อทั้ง cohort ครบ; workflow ต้อง idempotent, resume partial publish ได้, ห้ามสร้าง git/GitHub release ที่อ้าง package ไม่ครบ และบันทึก signed release manifest”
- **potential_consequence:** release ล้มกลางทางแล้วบาง package อยู่บน `latest` แต่ dependency ยังไม่มี, git tag อ้าง artifact ไม่ครบ และ retry ชน immutable npm version

### 15. Canary/beta dependency closure ยังอาจไหลไปหา stable หรือ workspace artifact

- **location:** AD-12; AD-14; Consistency Conventions — Versions
- **trigger_condition:** ช่องทาง canary/snapshot/beta ถูกตั้งชื่อแต่ไม่กำหนด version format, dependency rewriting และ dist-tag resolution; packed smoke test อาจผ่านด้วย lockfile/workspace tarball ขณะที่ package ที่ publish ระบุ range ซึ่ง resolve ไป stable คนละรุ่น
- **guard_snippet:** **เพิ่มใน AD-14:** “ทุก prerelease cohort ต้อง rewrite internal dependencies เป็น exact prerelease versions ของ run เดียวกัน, ห้าม `workspace:*` ใน tarball, ติดตั้ง smoke fixture จาก empty lockfile/isolated registry และ promotion beta→latest ต้องใช้ artifact เดิมหรือพิสูจน์ reproducible equivalence”
- **potential_consequence:** canary ที่ทดสอบไม่ใช่ canary ที่ consumer ได้จริง; beta ใช้ core stable โดยไม่ตั้งใจ และข้อผิดพลาดปรากฏหลัง promote เท่านั้น

## Tightening set to adopt before parallel implementation

ลำดับขั้นต่ำที่ปิด counterexample ได้คือ:

1. เพิ่ม AD-18 (canonical cross-package contracts) พร้อม owner/consumer table
2. แก้ AD-1 และเพิ่ม AD-19/AD-20 เพื่อแบ่ง semantic ownership, state transition และ selection coordinates
3. แก้ AD-3 เพื่อกำหนด temporal contract กับ revision-bound baseline acknowledgement
4. เพิ่ม AD-21/AD-22 เพื่อทำ plugin และ security/HTML behavior ให้ deterministic ข้าม adapter
5. แก้ AD-4/AD-7/AD-8/AD-10 และเพิ่ม AD-23 เพื่อปิด token, exports, bundle และ runtime-identity boundaries
6. เพิ่ม AD-24/AD-25 และแก้ AD-14 เพื่อให้ release เป็น compatible, recoverable cohort

หลังเพิ่มกฎเหล่านี้ ต้องสร้าง contract fixtures จากสอง independent harnesses: harness หนึ่ง build core/HTML/content และอีก harness build React/DOM/checks โดยแลกกันเฉพาะ packed public artifacts ห้ามใช้ monorepo source alias หรือ shared lockfile การผ่าน harness นี้ควรเป็น release gate ไม่ใช่เพียง demo test
