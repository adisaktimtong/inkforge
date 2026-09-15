# Current-Stack Closure Review

Checked on **2026-09-15 (Asia/Bangkok)** against `review-current-stack.md`, the revised `ARCHITECTURE-SPINE.md`, npm registry metadata, and primary project documentation. This review verifies only the five previously reported current-stack areas and does not modify the spine.

## Verdict

**PASS WITH FOLLOW-UP.** All prior **HIGH** findings are closed. The revised Node floor satisfies every selected runtime and tool, the Changesets CLI/action generation split is coherent, the public-repository prerequisite makes npm provenance achievable, and the updated package versions are real and compatible. Two medium hardening details remain for scaffold implementation: sanitizer compilers should reject policy features that cannot be represented identically, and the release workflow should pin an npm CLI version that satisfies Trusted Publishing rather than relying only on the moving Node 24 alias.

## Closure Matrix

| Prior finding | Revised evidence | Verification | Status |
| --- | --- | --- | --- |
| Node `>=22` was too broad | AD-15 and Stack now require Node `>=22.18.0`; release runs on GitHub-hosted Node 24. | Node 22.18 meets tsdown's highest 22.x floor and exceeds the Vite, Vitest, sanitize-html, and Changesets CLI floors. Current Node 24 also meets them. [Node releases](https://nodejs.org/en/about/previous-releases), [tsdown 0.23.0](https://registry.npmjs.org/tsdown/0.23.0), [Vitest 5.0.1](https://registry.npmjs.org/vitest/5.0.1), [sanitize-html 2.17.7](https://registry.npmjs.org/sanitize-html/2.17.7) | **CLOSED** |
| Provenance lacked visibility and workflow prerequisites | AD-13 now requires a public repository, npm trusted-publisher mapping, GitHub-hosted Node 24, OIDC publishing, and GitHub Environment approval. | npm provenance is available for a public package published from a public repository through Trusted Publishing. Public repositories also have GitHub Environment reviewer support independent of the private-repository plan restriction. [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [GitHub environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) | **CLOSED** |
| Changesets CLI alone could not create release PRs/tags/releases | AD-13 separates a version workflow using `changesets/action@v1` plus Changesets CLI 2.x from a separately privileged publish workflow. Stack pins CLI 2.31.1 and action v1.9.0. | `changesets/action@v1.9.0` exists and its official README says it creates/updates version PRs. The v1 action is the stable line paired with Changesets CLI 2.x; v2 is the line for Changesets CLI 3.x. The spine correctly limits v1 to the version PR path and assigns publish/tag/release work to the separate workflow. [v1.9.0 source](https://github.com/changesets/action/tree/v1.9.0), [v1.9.0 README](https://github.com/changesets/action/blob/v1.9.0/README.md), [CLI 2.31.1](https://registry.npmjs.org/%40changesets%2Fcli/2.31.1) | **CLOSED** |
| Sanitizer equivalence was assumed | AD-6 now starts from a restricted profile, forbids the highest-risk namespaces/features by default, makes the server sanitizer authoritative, and compares policy verdict plus normalized safe AST instead of bytes. | This materially removes the earlier false byte-equivalence assumption and defines an appropriate differential test oracle. DOMPurify and sanitize-html still expose different policy languages, so representability needs one more implementation rule. [DOMPurify security model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model), [sanitize-html options](https://github.com/apostrophecms/apostrophe/blob/main/packages/sanitize-html/README.md) | **SUBSTANTIALLY CLOSED; MEDIUM FOLLOW-UP** |
| Snapshot was valid but pnpm/Vitest lagged a patch | Stack now selects pnpm 12.4.2 and Vitest 5.0.1. | Both exact versions are published. Vitest 5.0.1 accepts Vite 8 and requires Node 22.12+/24+, so it is compatible with Vite 8.3.0 and Node 22.18+. [pnpm 12.4.2](https://registry.npmjs.org/pnpm/12.4.2), [Vitest 5.0.1](https://registry.npmjs.org/vitest/5.0.1) | **CLOSED** |

## Compatibility Recheck

| Changed selection | Reality check | Result |
| --- | --- | --- |
| Node `>=22.18.0` | Satisfies Vite 8.3.0 (`>=22.12`), Vitest 5.0.1 (`>=22.12`), sanitize-html 2.17.7 (`>=22.12`), and tsdown 0.23.0 (`>=22.18`). | Compatible |
| pnpm 12.4.2 | Published; engine Node `>=18`. | Compatible |
| Vitest 5.0.1 | Published; peer Vite `^6.4.0 || ^7.0.0 || ^8.0.0`; engine Node `^22.12.0 || ^24.0.0 || >=26.0.0`. | Compatible with Vite 8.3.0 and the revised Node floor |
| Changesets CLI 2.31.1 | Published; stable CLI 2 line. | Compatible with the selected v1 Changesets action strategy |
| `changesets/action@v1.9.0` | Git tag exists; action metadata uses the Node 24 action runtime and supports version-PR creation. | Compatible; pin its commit SHA in the workflow for supply-chain immutability |

All unchanged pins from the prior review remain published and compatible: TypeScript 7.0.2, React/React DOM 19.3.0, Next.js 16.3.5, Vite 8.3.0, Turborepo 2.10.13, tsdown 0.23.0, Playwright Test 1.63.0, parse5 8.0.1, DOMPurify 3.4.15, sanitize-html 2.17.7, publint 0.3.24, and Are the Types Wrong CLI 0.18.5.

## Remaining Follow-Ups

### MEDIUM — Reject sanitizer policies that either adapter cannot represent

AD-6 now defines a safe initial profile and meaningful cross-adapter comparisons, which is enough to close the earlier architecture-level equivalence objection. It still does not explicitly require the DOMPurify and sanitize-html policy compilers to fail when a future `ContentPolicy` feature cannot be represented by both adapters.

**Scaffold requirement:** Make the portable policy schema the intersection of both adapters. Compilation must return a typed error for unsupported semantics rather than silently omit, weaken, or approximate them. Keep the revised verdict/normalized-AST differential fixtures and add adapter-specific security regressions.

### MEDIUM — Pin the npm CLI used for Trusted Publishing

AD-13 names GitHub-hosted Node 24, but npm Trusted Publishing requires npm CLI `>=11.5.1` in addition to Node `>=22.14.0`. A current Node 24 image satisfies this, but `node-version: 24` is a moving alias and does not document the npm executable actually used by the publish step.

**Scaffold requirement:** Install and verify an exact npm 11 version at or above 11.5.1 in the publish job, assert `node --version` and `npm --version` before publish, grant `id-token: write`, and pin third-party actions by full commit SHA. These are workflow-hardening details, not blockers to the revised architecture decision.

## Closure Decision

No **CRITICAL** or **HIGH** current-stack findings remain. The spine is ready to proceed to scaffold with the two medium requirements above carried into workflow and sanitizer-adapter implementation acceptance criteria.
