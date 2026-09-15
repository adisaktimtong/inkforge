# Reconciliation Review — Specification Package vs Architecture Spine

## Verdict

**REVISION REQUIRED.** The spine establishes useful package boundaries, dependency direction, release controls, and a deterministic HTML pipeline, but it does not yet carry several behavioral invariants that the specification declares mandatory. Two omissions are especially risky for implementation: the lossless `RawHtmlNode` boundary is absent, and the sanitizer decision does not preserve the required distinction between rejecting invalid Source input and sanitizing untrusted HTML at the server boundary.

The companion files remain normative under `SPEC.md:12`, so these omissions are not merely reduced detail: the spine is labeled a build substrate and binds every capability, yet an implementer following it alone could produce a system that violates CAP-1, CAP-6, CAP-8, CAP-9, CAP-10, CAP-11, or CAP-12.

## Findings

### 1. BLOCKER — The lossless unsupported-HTML boundary did not land

**Source requirement:** Supported visual content parses to structured nodes, while safe unsupported subtrees become read-only, lossless `RawHtmlNode` values (`SPEC.md:22-24`, `SPEC.md:62-64`; `architecture.md:71-75`; `html-contract.md:89-93`; `source-editing.md:59-70`). Their internals must not be normalized, edited in Visual mode, or executed; they require an explicit DOM/selection boundary and can only be removed whole or edited through Source mode.

**Spine state:** The spine never names `RawHtmlNode`, its lossless serialization rule, its read-only editing boundary, or its selection/rendering constraints. AD-5 only commits to a normalized AST and canonical serializer (`ARCHITECTURE-SPINE.md:83-87`), and the structural seed merely names an HTML adapter (`ARCHITECTURE-SPINE.md:184-203`).

**Why this matters:** An implementation can reasonably normalize, discard, or expose unsupported safe markup for partial editing while still satisfying every written spine rule. That directly breaks the principal migration safety guarantee in CAP-1 and CAP-11.

**Required reconciliation:** Add an adopted invariant defining `RawHtmlNode` ownership, preservation granularity, read-only visual behavior, non-execution, DOM/selection isolation, whole-node deletion, and exact raw-fragment re-emission. Bind it to CAP-1 and CAP-11 and assign it to `editor-core`, `editor-html`, `internal/editor-dom`, and `internal/editor-source`.

### 2. BLOCKER — Sanitization in AD-6 conflicts with Source-mode rejection semantics

**Source requirement:** Source Apply must validate syntax and policy before committing; forbidden content produces located diagnostics, preserves the working copy, and creates no transaction, history entry, document change, or cursor relocation (`SPEC.md:84-86`; `source-editing.md:9-21`, `source-editing.md:23-57`). Separately, the CMS server must sanitize untrusted HTML before save or render (`SPEC.md:77`; `html-contract.md:106-108`).

**Spine state:** AD-6 says the browser policy compiles to DOMPurify and the server policy to sanitize-html (`ARCHITECTURE-SPINE.md:89-93`) but does not define a non-mutating validation path or phase ordering. Those sanitizer adapters ordinarily transform/remove input, which is different from rejecting the user's Source Apply and retaining its working copy. The generic error convention (`ARCHITECTURE-SPINE.md:151-157`) does not restore this distinction.

**Why this matters:** A conforming implementation may silently strip forbidden markup and commit the remainder, violating atomic rejection and hiding the exact problem from the author. It may also conflate editor validation with the mandatory server security boundary.

**Required reconciliation:** Split policy evaluation into explicit operations: `validateSource` returns diagnostics without mutation; `parseValidatedSource` runs only after success; `sanitizeForPersistenceOrRender` remains a server boundary. State that Source Apply never commits sanitized partial output and that browser sanitization is not the server security boundary.

### 3. HIGH — Source-mode authorization and lifecycle invariants did not land

**Source requirement:** Only authorized authors may open or apply Source mode; Source mode edits a separate working copy; Cancel leaves document, dirty state, and history unchanged; successful Apply is one undoable transaction (`SPEC.md:62-64`; `source-editing.md:3-21`, `source-editing.md:72-80`).

**Spine state:** CAP-11 maps only to `internal/editor-source` and `editor-html` under AD-5, AD-6, and AD-10 (`ARCHITECTURE-SPINE.md:222-236`). None of those decisions defines an authorization port, working-copy ownership, Cancel semantics, or the single history boundary. AD-2 guarantees atomic document transactions generally but does not state that a Source Apply is exactly one undoable history step.

**Why this matters:** The adapter can expose Source mode to every user, bind edits directly to document state, or fragment Apply across history while remaining spine-compliant.

**Required reconciliation:** Add a Source-session invariant covering permission checks at open and apply, isolated working copy, retained copy on validation failure, no-op Cancel, one-transaction Apply, one history step, and unchanged selection/history/dirty state on failure.

### 4. HIGH — CAP-9 dirty-state acknowledgment protocol is absent

**Source requirement:** Equivalent document states serialize deterministically, and dirty state returns to clean only after the host confirms a saved snapshot (`SPEC.md:54-56`). The page form owns save timing, transport errors, and dirty confirmation (`html-contract.md:110-120`).

**Spine state:** AD-3 gives the engine a revision and immutable snapshots (`ARCHITECTURE-SPINE.md:54-58`), and AD-5 supplies deterministic serialization (`ARCHITECTURE-SPINE.md:83-87`), but no adopted rule defines a saved baseline, host acknowledgment API, revision/snapshot matching, or behavior when an older save completes after newer edits. CAP-9 is mapped only to AD-2, AD-3, AD-5, and AD-6 (`ARCHITECTURE-SPINE.md:222-227`).

**Why this matters:** Implementations may clear dirty on serialization, save start, or any save completion. An out-of-order response could incorrectly mark newer unsaved edits clean.

**Required reconciliation:** Define a host-owned save acknowledgment carrying the exact revision or canonical snapshot identity. The engine may advance the clean baseline only for the acknowledged snapshot and must remain dirty when later revisions exist.

### 5. HIGH — Accessibility and SEO checker contracts are reduced to placement and testing

**Source requirement:** Issues carry checker, rule ID, message, node ID, level, status, optional standard reference, and optional command fix; results become stale or are replaced after document change; uncheckable rules and opaque raw HTML report `manual-review` or `not-evaluated`; contrast covers every declared theme/responsive variant (`SPEC.md:58-68`; `content-checks.md:9-65`). WCAG references and the separation of content SEO from page metadata are mandatory.

**Spine state:** AD-8 mentions accessible primitives, AD-11 requires browser tests, AD-12 requires a checker demo, and the package map assigns CAP-10/CAP-12 to `editor-checks` and `editor-react` (`ARCHITECTURE-SPINE.md:101-105`, `ARCHITECTURE-SPINE.md:119-129`, `ARCHITECTURE-SPINE.md:222-235`). No invariant carries the issue schema, snapshot identity/staleness, minimum rules, status semantics, command-only fixes, responsive/theme contrast evaluation, or page-metadata exclusion.

**Why this matters:** A checker returning booleans without navigable node identity, stale-result protection, WCAG traceability, or honest unevaluated states would satisfy the spine but fail CAP-10 and CAP-12.

**Required reconciliation:** Add an adopted checker contract and bind it to CAP-10/CAP-12. Include snapshot/revision identity, required result fields and statuses, minimum rule families, deterministic execution, stale handling, command-only fixes, and `not-evaluated` propagation for raw or unresolved token content.

### 6. HIGH — Token, `classPrefix`, alias, and deployment invariants did not land

**Source requirement:** Presentation values are consumer-registered tokens; IDs match `[a-z0-9-]+`; the model stores only IDs; serialization emits stable namespaced classes; `classPrefix` defaults to `rte-`, is immutable per instance, and must match parser, serializer, wrapper, content CSS, and sanitizer. A website must deploy support before CMS emission, and deprecated aliases remain until migration (`SPEC.md:79-83`; `architecture.md:71-74`, `architecture.md:163-167`; `html-contract.md:33-75`; `customization.md:7-27`). Sanitization must verify the actual registry, not merely a prefix (`html-contract.md:106-108`).

**Spine state:** The spine says only that persisted presentation uses stable token classes and namespaces (`ARCHITECTURE-SPINE.md:151-159`) and puts a token-registry contract in `editor-content` (`ARCHITECTURE-SPINE.md:184-203`). It does not preserve the prefix default/immutability, cross-component equality, token-ID grammar, registry validation, no-raw-CSS rule, wrapper scoping, alias lifetime, or website-first rollout sequence. Legacy mapping is deferred (`ARCHITECTURE-SPINE.md:238-245`) but the enduring invariants are not adopted.

**Why this matters:** Parser, serializer, stylesheet, wrapper, and sanitizer can drift; prefix-only sanitizer rules can admit unregistered classes; token rollout can produce persisted HTML the public site cannot render.

**Required reconciliation:** Add one token/class contract spanning `editor-core`, `editor-html`, `editor-content`, `editor-react`, and the server integration, including deployment and migration ordering.

### 7. HIGH — The minimum document, plugin, and HTML mapping contracts did not land

**Source requirement:** The MVP schema has named block nodes and marks, validates parent/child and mark legality, and supports deterministic command/transaction/history behavior (`architecture.md:69-100`). Plugins publicly register nodes, marks, commands, keymaps, parse/serialize rules, normalization, and transaction observation; names must be unique and collisions fail editor creation (`architecture.md:108-126`). The canonical HTML mapping is explicit (`html-contract.md:9-45`).

**Spine state:** AD-1 says the team owns these mechanisms and AD-2 requires validated atomic transactions (`ARCHITECTURE-SPINE.md:42-52`), but the spine contains neither a minimum schema surface, plugin registration contract/collision rule, nor canonical node/mark mapping. AD-5's phrase “canonical serializer” does not select the canonical representation.

**Why this matters:** Independently built core, HTML, and plugin packages can choose incompatible node shapes, extension hooks, and canonical tags while each follows the spine's dependency graph.

**Required reconciliation:** Carry the minimum model/schema and plugin port into adopted interface-level rules, and either embed the canonical HTML table or make `html-contract.md` an explicit normative interface owned by AD-5.

### 8. MEDIUM — Selection bookmark and modal failure semantics did not land

**Source requirement:** Consumer UI captures selection before focus leaves, bookmarks are bound to an editor instance and mapped through intervening transactions, failed restore returns `false` without placing the cursor incorrectly, and dispatch occurs after successful restoration (`architecture.md:144-159`; `customization.md:50-88`). CAP-6 also requires configurable typography, colors, spacing, focus, disabled, error state, and public class prefix (`SPEC.md:42-44`).

**Spine state:** AD-8 says only that React provides hooks, context, accessible primitives, optional CSS, and consumer-owned modals (`ARCHITECTURE-SPINE.md:101-105`). AD-3 owns selection but does not expose bookmark lifetime/mapping/failure rules (`ARCHITECTURE-SPINE.md:54-58`).

**Why this matters:** A toolbar may restore to a stale or wrong cursor and still dispatch, while UI customization omits required interactive states.

**Required reconciliation:** Add the bookmark API and validity rules to the public adapter contract, require callers to branch on restoration failure, and enumerate the theming/state surfaces CAP-6 promises.

### 9. MEDIUM — CAP-8 is mapped but its accessible image workflow is unspecified

**Source requirement:** The host supplies the upload handler; the editor inserts the returned asset URL, allows alt-text editing, and exports the contracted figure/image HTML (`SPEC.md:50-52`; `architecture.md:128-154`; `html-contract.md:23-24`).

**Spine state:** CAP-8 is assigned to a core command port and React integration (`ARCHITECTURE-SPINE.md:222-234`), while the wire contract is deferred (`ARCHITECTURE-SPINE.md:238-242`). No invariant retains host ownership of upload, result-to-command flow, alt/decorative semantics, URL-policy validation, or canonical image serialization.

**Why this matters:** Deferring transport details can unintentionally defer the entire capability, or yield an image command that cannot satisfy accessibility and HTML round-trip requirements.

**Required reconciliation:** Keep transport/auth details deferred, but adopt the stable boundary now: host callback, typed asset result, policy-validated URL, atomic insertion, editable alt/decorative state, and canonical serializer mapping.

## Reconciliation Summary

| Spec area | Spine coverage | Result |
| --- | --- | --- |
| Package boundaries, dependency direction, releases | Explicit ADs and structural seed | Landed |
| Deterministic canonical HTML pipeline | AD-5 | Partially landed; mappings and raw preservation missing |
| Browser/server security | AD-6 | Partially landed; validation versus sanitization conflicts |
| Source mode | Package placement and demo only | Not load-bearing |
| Dirty/save state | Revision only | Not landed |
| Content checks | Package placement and testing only | Not landed |
| Tokens and content CSS | Generic namespace/version statements | Partially landed |
| Plugin/model contracts | Ownership statement only | Partially landed |
| Modal selection customization | Consumer-owned modal only | Not landed |
| Image upload | Deferred wire contract and package map | Not landed |

The spine should not duplicate every acceptance criterion, but each cross-package invariant above needs either an adopted decision in the spine or an unambiguous normative interface reference. At present, `companions:` is metadata, not enough to prevent incompatible implementations across the package boundaries the spine creates.
