# Closure Review — Revised Architecture Spine

## Verdict

**NOT YET CLOSED — no remaining critical findings, seven high findings remain.** The revision resolves the prior architectural blockers around token-registry reachability, `RawHtmlNode`, Source rejection, saved-snapshot ordering, and recoverable package promotion. It does not yet close all prior high findings from the rubric and specification reconciliation reviews.

Mechanical validation remains clean: `lint_spine.py` reports zero findings.

## Closure matrix

| Prior finding | Closure | Revised evidence |
| --- | --- | --- |
| Token registry unreachable from core | **Closed** | AD-4 now permits `editor-content → editor-core` and AD-18 makes `editor-core` owner/exporter of the token-registry interface (`ARCHITECTURE-SPINE.md:60-82`, `ARCHITECTURE-SPINE.md:162-166`). |
| Lossless/read-only `RawHtmlNode` absent | **Closed** | AD-5 exempts safe unsupported content from canonical normalization; AD-23 defines opaque lossless storage, inert read-only Visual rendering, Source-only editing, and unsafe rejection (`ARCHITECTURE-SPINE.md:84-94`, `ARCHITECTURE-SPINE.md:192-196`). |
| Source Apply could sanitize/partially commit | **Closed** | AD-6 now requires whole-operation rejection without silent sanitation; AD-16 requires authorization, isolated working copy, full validation before one undoable transaction, and no document/history mutation on failure (`ARCHITECTURE-SPINE.md:90-94`, `ARCHITECTURE-SPINE.md:150-154`). A smaller failure-lifecycle gap remains below. |
| CAP-9 clean baseline/out-of-order save behavior absent | **Closed** | AD-3 introduces a host-confirmed normalized baseline; AD-19 requires revision plus normalized-HTML digest and rejects mismatched acknowledgments (`ARCHITECTURE-SPINE.md:54-58`, `ARCHITECTURE-SPINE.md:168-172`). |
| Checker results not revision-bound | **Partially closed** | AD-17 adds rule identity, location, source revision, stale-result handling, and revision-safe optional fixes, but omits required result statuses and coverage rules (`ARCHITECTURE-SPINE.md:156-160`). |
| Persisted HTML/CSS rollout and package recovery absent | **Closed** | AD-9 adds compatibility cohorts, AD-21 defines website-first support and rollback compatibility, and AD-22 defines staged promotion plus last-known-good recovery (`ARCHITECTURE-SPINE.md:108-112`, `ARCHITECTURE-SPINE.md:180-190`). |
| Cross-package type ownership implicit | **Closed** | AD-18 assigns single owners for core contracts, HTML AST, diagnostics, and `ContentPolicy` and forbids duplicate shapes (`ARCHITECTURE-SPINE.md:162-166`). |
| Browser mutation ownership implicit | **Closed** | AD-20 makes `internal/editor-dom` the sole browser mutation path and defines composition buffering/commit ownership (`ARCHITECTURE-SPINE.md:174-178`). |
| Named technology freshness | **Closed** | pnpm and Vitest pins were updated; the Changesets action/CLI pairing and Node floor were made explicit (`ARCHITECTURE-SPINE.md:132-148`, `ARCHITECTURE-SPINE.md:210-231`). |
| Operational envelope absent | **Partially closed** | Cohort rollout and npm recovery landed, but host security-boundary placement and incident ownership remain unspecified. |

## Remaining high findings

### H1 — Token/class compatibility is reachable but still underspecified

**Evidence:** AD-18 gives core ownership of the token-registry interface and AD-4 makes it reachable (`ARCHITECTURE-SPINE.md:60-82`, `ARCHITECTURE-SPINE.md:162-166`). AD-21 adds cohorts, website-first support, aliases, and rollback (`ARCHITECTURE-SPINE.md:180-184`). However, no adopted rule carries the required token-ID grammar, rejection before transaction, `classPrefix` default and immutability, equality across parser/serializer/wrapper/content CSS/sanitizer, wrapper scoping, prohibition on raw CSS values, or sanitizer verification against the actual registry rather than prefix alone (`../SPEC.md:79-83`; `../html-contract.md:33-75`, `../html-contract.md:106-108`; `../customization.md:7-27`). The structural-seed comment still calls `editor-content` the owner of the “token registry contract” (`ARCHITECTURE-SPINE.md:233-245`), which conflicts in wording with AD-18's core ownership.

**Consequence:** Workstreams can share a type yet disagree on which tokens/classes are valid, allowing parser, serializer, CSS, and sanitizer drift.

**Closure required:** Add one adopted token/class invariant covering validation, prefix semantics, registry-only sanitization, wrapper scoping, and owner terminology.

### H2 — Source failure does not explicitly preserve the working copy or cursor

**Evidence:** AD-16 correctly isolates Source edits and protects document/history on failure (`ARCHITECTURE-SPINE.md:150-154`), but it does not require the invalid working copy to remain available for correction or forbid cursor relocation. Both are explicit in the source contract (`../source-editing.md:39-44`).

**Consequence:** An adapter may close Source mode, discard the user's invalid edits, or relocate selection while still satisfying AD-16.

**Closure required:** Extend AD-16 so failed Apply preserves the working copy and Source session and changes neither selection nor dirty baseline.

### H3 — CAP-10/CAP-12 checker contract remains incomplete

**Evidence:** AD-17 supplies rule ID, standard reference, severity, node location, source revision, stale handling, and command fixes (`ARCHITECTURE-SPINE.md:156-160`). It omits `checker`, `message`, and the required `failed | manual-review | not-evaluated` status; it also does not bind the minimum accessibility/SEO rules, RawHtml non-passing behavior, page-metadata exclusion, or contrast across every theme/responsive variant (`../content-checks.md:9-65`).

**Consequence:** A revision-safe checker can still report false passes, omit required coverage, or conflate accessibility with SEO.

**Closure required:** Adopt the complete issue/status contract and minimum deterministic rule/coverage semantics, or explicitly make the relevant companion sections normative under AD-17.

### H4 — CAP-8 still lacks an enforceable accessible image workflow

**Evidence:** The capability map now says the host owns transport and URL/alt enter a validated command (`ARCHITECTURE-SPINE.md:271-285`), while the wire contract remains deferred (`ARCHITECTURE-SPINE.md:287-296`). No AD requires the editor to invoke the handler, atomically insert the returned asset, permit later alt/decorative editing, apply URL policy, or serialize the canonical `<figure><img><figcaption?>` mapping required by the spec (`../SPEC.md:50-52`; `../html-contract.md:23-24`). A map-cell annotation is not a stable port or lifecycle rule.

**Consequence:** CAP-8 work can start with incompatible handler/result shapes or omit accessibility and round-trip behavior.

**Closure required:** Keep transport/auth details deferred, but adopt the stable host callback, typed asset result, URL validation, insertion, alt/decorative editing, and serializer boundary before the CAP-8 story.

### H5 — Minimum model/plugin/canonical HTML seams remain unratified

**Evidence:** AD-18 now assigns type ownership (`ARCHITECTURE-SPINE.md:162-166`), but it does not select the MVP node/mark set, plugin registration surface and collision behavior, or canonical HTML mapping. AD-5 says output is canonical without defining the canonical forms (`ARCHITECTURE-SPINE.md:84-88`). Those load-bearing interfaces remain only in companions (`../architecture.md:69-126`; `../html-contract.md:9-45`).

**Consequence:** Core, plugin, and HTML units can conform to ownership rules while producing incompatible schemas and serialization.

**Closure required:** Bind precise companion sections normatively to AD-5/AD-18 or carry their minimum interfaces into adopted rules.

### H6 — AD-8 and AD-12 remain too broad to enforce

**Evidence:** AD-8 still promises “accessible primitives” without WCAG 2.2 AA, required keyboard/focus/error/disabled states, or a conformance gate (`ARCHITECTURE-SPINE.md:102-106`). AD-12 still names broad demo scenarios without executable assertions or fixture identities (`ARCHITECTURE-SPINE.md:126-130`). The revision added no dependency-boundary enforcement mechanism for AD-4 either.

**Consequence:** Teams can satisfy the words with materially different behavior, and CI lacks a deterministic failure condition.

**Closure required:** Attach named automated checks and fixture journeys to AD-4, AD-8, and AD-12.

### H7 — Host security placement and incident operations remain silent

**Evidence:** AD-6 calls server sanitization the security boundary and AD-21 requires sanitizer support before serializer rollout (`ARCHITECTURE-SPINE.md:90-94`, `ARCHITECTURE-SPINE.md:180-184`). Neither rule states whether sanitization is mandatory before persistence, before render, or both, nor which host owns the invocation. AD-22 handles broken npm cohorts but not a security advisory/compromise response, emergency dist-tag movement, affected-content re-sanitization, or compatibility-fixture rollback. Demo environment ownership is also undecided.

**Consequence:** Package release can be correct while a consuming CMS omits the real security boundary or lacks an incident response path.

**Closure required:** Add an operational handoff defining mandatory server-sanitizer call sites, host ownership, security response/forward-fix responsibilities, content remediation, and whether demos are CI-only or deployed.

## Closure recommendation

The revised spine is materially stronger and its original critical blockers are resolved. Approval should remain withheld until H1, H3, H4, H5, and H7 are adopted or normatively bound; H2 and H6 should be closed in the same pass because they are small, explicit additions with direct acceptance-test consequences.
