# Good-Spine Rubric Review — Architecture Spine

## Gate verdict

**REVISION REQUIRED.** The spine is mechanically sound and makes several strong platform decisions, but it is not yet a sufficient build substrate: important cross-package divergence points remain unspecified, one dependency rule conflicts with the declared token-registry placement, capability coverage is incomplete, and the consumer deployment/operations envelope is only partially defined.

## Mechanical preflight

`lint_spine.py` completed successfully with zero findings against the architecture-spine workspace. The document has valid frontmatter, unique AD identifiers, complete Binds/Prevents/Rule fields, and pinned Stack entries. The failures below are semantic, not mechanical.

## Checklist walk

| Good-spine criterion | Result | Evidence |
| --- | --- | --- |
| Fixes every real divergence point for the level below | **Fail** | Package topology is fixed, but unsupported HTML ownership, Source-session state, dirty-baseline protocol, checker result lifecycle, token contract, and plugin/model interfaces remain open. |
| Every AD is enforceable and prevents its stated divergence | **Partial** | AD-1/2/3/5/6/7/9/10/11/13/14/15 are mostly testable; AD-4 is internally incomplete, while AD-8 and AD-12 use broad outcome language without executable boundaries. |
| Nothing in Deferred can let two units diverge | **Pass with caution** | Each product-sensitive item has a close-before-story/publish boundary and media defaults to deny. Final package naming still needs a scaffold-safe placeholder convention. |
| Named technology is verified-current | **Pass** | All pinned npm versions existed on 2026-09-15; Node 22 and 24 were supported LTS lines. Two pins trailed latest patch releases but remained current release lines. |
| Ratifies rather than contradicts brownfield code | **N/A / Pass** | Repository inspection found no implementation, package manifests, workspace config, or CI outside `_bmad-output`; this is a pre-scaffold greenfield repository. |
| Covers the driving specification's capabilities | **Fail** | All CAP IDs are mapped, but several mandatory behaviors are not carried by an AD or normative interface. |
| Does not weaken an inherited parent spine | **N/A** | No parent spine or inherited AD set is declared. |
| Every owned dimension is decided, deferred, or open | **Fail** | Runtime/package support and release publication are covered; host deployment, content rollout/rollback, security-boundary placement, and operational response remain silent. |

## Findings

### 1. CRITICAL — AD-4 makes the token registry unreachable from the validating core

**Rubric dimension:** Real divergence points; enforceable ADs.

**Evidence:** AD-2 requires every document mutation to be validated by core (`ARCHITECTURE-SPINE.md:48-52`). AD-4 then restricts dependencies to its graph (`ARCHITECTURE-SPINE.md:60-81`). The structural seed describes `editor-content` as owning the “token registry contract” (`ARCHITECTURE-SPINE.md:184-203`), but the dependency graph gives `editor-content` no incoming or outgoing contract edge except an optional CSS edge from React. The spec requires core commands to validate consumer token IDs before transactions (`../customization.md:27`) and the model to retain validated token IDs (`../architecture.md:69-79`).

**Divergence enabled:** Core can invent a duplicate registry type, React can validate before dispatch, or HTML can become the authority. Each choice produces different validation and dependency behavior; at least one violates AD-2 or AD-4.

**Disposition:** **Autofix.** Decide ownership of the runtime token-registry type and add the legal dependency/port to AD-4. A clean option is a core-owned registry interface implemented/configured by consumers, while `editor-content` owns CSS artifacts and optional helpers rather than the authoritative runtime contract.

### 2. CRITICAL — Mandatory lossless `RawHtmlNode` behavior is absent from the spine

**Rubric dimension:** Real divergence points; spec coverage.

**Evidence:** CAP-1 and CAP-11 require safe unsupported HTML to survive as lossless, read-only `RawHtmlNode` content (`../SPEC.md:22-24`, `../SPEC.md:62-64`; `../source-editing.md:59-79`). The spine binds both capabilities and chooses a normalized AST/canonical serializer in AD-5 (`ARCHITECTURE-SPINE.md:83-87`), but never defines the raw-fragment exception, node ownership, exact re-emission, selection isolation, non-execution, or whole-node editing rule.

**Divergence enabled:** HTML, core, DOM, and Source units can independently normalize, discard, sandbox, or partially edit unsupported markup while still claiming compliance with AD-5.

**Disposition:** **Autofix.** Add an adopted cross-package invariant for raw-fragment capture, core representation, DOM boundary, Visual-mode immutability, safe rendering, and byte-preserving fragment serialization.

### 3. CRITICAL — AD-6 does not separate policy validation from destructive sanitization

**Rubric dimension:** Enforceable ADs; spec coverage; operational envelope.

**Evidence:** AD-6 compiles one `ContentPolicy` to DOMPurify and sanitize-html and calls server sanitization the security boundary (`ARCHITECTURE-SPINE.md:89-93`). Source Apply, however, must reject forbidden input with located diagnostics, preserve the working copy, and make no partial document/history change (`../source-editing.md:9-57`). Server sanitization before persistence or render is a separate requirement (`../SPEC.md:77`; `../html-contract.md:106-108`).

**Divergence enabled:** One unit may use sanitization as validation and silently strip Source input, another may reject it, and host applications may sanitize on save, render, both, or neither.

**Disposition:** **Discuss, then autofix.** Ratify three distinct operations and their owners: non-mutating Source validation, parsing only validated input, and server-side sanitization at an explicit persistence/render boundary. Shared policy data and fixtures may remain common.

### 4. HIGH — Several AD rules are too broad to enforce as written

**Rubric dimension:** Enforceable ADs.

**Evidence:** AD-8 promises “accessible primitives” without binding the WCAG 2.2 AA requirement, required UI states, keyboard/focus behavior, or an automated conformance gate (`ARCHITECTURE-SPINE.md:101-105`). AD-12 says demos cover broad scenario labels such as `authoring/plugin/source/check` without naming assertions or fixture contracts (`ARCHITECTURE-SPINE.md:125-129`). AD-4 prohibits off-graph dependencies, but no boundary-check mechanism is selected; pack smoke only detects unresolved publication dependencies, not all source-level cycles (`ARCHITECTURE-SPINE.md:60-81`, `ARCHITECTURE-SPINE.md:107-117`).

**Divergence enabled:** Teams can implement incompatible interpretations and all claim the prose is satisfied; CI has no deterministic oracle for some stated prevents.

**Disposition:** **Autofix.** Attach an enforcement clause to each: dependency-boundary lint/graph test for AD-4, WCAG/keyboard/focus test matrix for AD-8, and named executable journeys plus fixture assertions for AD-12.

### 5. HIGH — Capability mapping gives false coverage for CAP-8 through CAP-12

**Rubric dimension:** Source/spec coverage.

**Evidence:** The capability map assigns every CAP to packages/ADs (`ARCHITECTURE-SPINE.md:222-236`), but mapping is not behavioral coverage:

- CAP-8 lacks the stable host upload callback, typed asset result, URL-policy check, accessible alt/decorative editing, and canonical image output; only transport/auth is legitimately deferred (`ARCHITECTURE-SPINE.md:233`, `ARCHITECTURE-SPINE.md:241`; `../SPEC.md:50-52`).
- CAP-9 has revision and deterministic serialization but no host acknowledgment of the exact saved snapshot or protection from out-of-order save completion (`ARCHITECTURE-SPINE.md:54-58`, `ARCHITECTURE-SPINE.md:83-87`; `../SPEC.md:54-56`).
- CAP-10/CAP-12 lack the issue schema, snapshot staleness, required rule families, WCAG references, `manual-review`/`not-evaluated`, responsive/theme contrast matrix, and command-only fixes (`ARCHITECTURE-SPINE.md:234`; `../content-checks.md:9-65`).
- CAP-11 lacks authorized open/apply, isolated working copy, no-op Cancel, retained invalid copy, and exactly one undoable Apply step (`ARCHITECTURE-SPINE.md:235`; `../source-editing.md:9-44`, `../source-editing.md:72-80`).

**Divergence enabled:** Implementations can pass the architecture map while failing capability acceptance and interoperability across core, React, HTML, Source, and checks.

**Disposition:** **Autofix.** Add adopted interface/lifecycle decisions for these behaviors or explicitly designate precise companion sections as normative interfaces governed by named ADs. A bare `companions:` list is insufficient.

### 6. HIGH — The consumer deployment and operations envelope is incomplete

**Rubric dimension:** Owned dimensions; operational/environmental envelope.

**Evidence:** AD-13/14 define CI-to-npm publication, approvals, channels, tags, and provenance (`ARCHITECTURE-SPINE.md:131-141`); AD-15 defines supported Node/browser families (`ARCHITECTURE-SPINE.md:143-147`). The spine does not decide or defer:

- where server sanitization executes relative to CMS persistence and public render;
- how `editor-content` versions are pinned across CMS preview and website deployments;
- how website-first token rollout is verified before CMS emission;
- rollback behavior when published JS, persisted HTML contract, and content CSS versions differ;
- ownership of security advisory response, package deprecation/yank policy, and fixture-driven compatibility rollback;
- whether demos are CI-only or deployed environments, and who owns any deployment.

The underlying spec makes coordinated CSS/HTML deployment load-bearing (`../SPEC.md:80-86`; `../architecture.md:161-167`; `../html-contract.md:47-75`).

**Divergence enabled:** CMS and website teams can deploy incompatible class contracts or omit the server boundary, creating unstyled persisted content or a security gap that package release success does not detect.

**Disposition:** **Discuss.** Decide what this feature-altitude spine owns versus requires from a parent/host architecture. Add an environment/operations section with explicit owner, gates, rollback compatibility window, and out-of-scope handoffs.

### 7. MEDIUM — Public model, plugin, and canonical HTML seams remain implicit

**Rubric dimension:** Real divergence points; spec coverage.

**Evidence:** AD-1 establishes ownership but not the minimum schema or extension interface (`ARCHITECTURE-SPINE.md:42-46`); AD-5 requires canonical output without selecting canonical node/mark mappings (`ARCHITECTURE-SPINE.md:83-87`); AD-9 names plugin API and HTML as compatibility surfaces without defining their stable boundaries (`ARCHITECTURE-SPINE.md:107-111`). The companions specify the MVP nodes/marks, schema validation, plugin registrations and collision behavior, and canonical HTML table (`../architecture.md:69-126`; `../html-contract.md:9-45`).

**Divergence enabled:** Core, HTML, and plugin workstreams can pick incompatible type ownership, collision semantics, and serialized forms before the public API is reconciled.

**Disposition:** **Autofix.** Add interface-level ADs or normative companion anchors for the minimum model, plugin registration/collision rules, and canonical HTML mapping.

### 8. MEDIUM — Deferred items are mostly safe, but package naming needs a scaffold convention

**Rubric dimension:** Deferred safety.

**Evidence:** Image transport, legacy mapping, block backgrounds, media policy, and mobile editing all name a decision boundary before their dependent work, and media defaults to deny (`ARCHITECTURE-SPINE.md:238-245`). Final npm scope/names are deferred until publication (`ARCHITECTURE-SPINE.md:240`), while package manifests, exports, consumer tarball fixtures, dependency ranges, and Changesets must exist earlier (`ARCHITECTURE-SPINE.md:107-141`, `ARCHITECTURE-SPINE.md:184-209`).

**Divergence enabled:** Scaffolded manifests and clean-consumer fixtures can independently choose scoped names, unscoped logical names, or placeholders, producing churn and mismatched import assertions.

**Disposition:** **Defer safely.** Keep final ownership/name deferred, but prescribe one temporary workspace naming convention and a single rename checkpoint before canary/public publication.

### 9. LOW — Technology choices are valid, with minor patch drift

**Rubric dimension:** Named technology is verified-current.

**Evidence:** Registry checks on 2026-09-15 confirmed every exact Stack version exists. The listed TypeScript 7.0.2, React 19.3.0, Next 16.3.5, Vite 8.3.0, Turborepo 2.10.13, tsdown 0.23.0, Playwright 1.63.0, Changesets 3.0.3, parse5 8.0.1, DOMPurify 3.4.15, sanitize-html 2.17.7, publint 0.3.24, and ATTW 0.18.5 matched npm's current version. pnpm 12.4.1 and Vitest 5.0.0 existed but npm exposed 12.4.2 and 5.0.1 respectively. Node's official release table listed both Node 22 and 24 as LTS on that date: <https://nodejs.org/en/about/previous-releases>.

**Impact:** No architectural defect. Patch drift is expected between snapshot and scaffold, and the spine already says the source and lockfile own versions after scaffold (`ARCHITECTURE-SPINE.md:161-180`).

**Disposition:** **Ignore** for the gate; resolve exact patch pins during scaffold and commit them in the lockfile.

## Passes worth preserving

- AD-1 through AD-3 make kernel ownership, mutation flow, state ownership, and framework independence clear enough to guide implementation.
- AD-5 selects a shared normalized AST and deterministic owned serializer across browser/server parsing.
- AD-7, AD-10, and the structural seed create a coherent package/publication boundary for React and internal adapters.
- AD-9 and AD-13 through AD-15 provide unusually concrete versioning, release-channel, provenance, runtime-support, and major-change rules.
- AD-11 correctly assigns browser-owned behavior to Playwright and a cross-browser release gate.
- The Deferred section generally supplies close-before-use boundaries rather than leaving decisions indefinitely open.

## Recommended gate exit

Do not approve the spine as build-ready until Findings 1–6 are resolved. Findings 7–8 can be closed by precise normative references and a temporary naming convention. Finding 9 requires no spine change.
