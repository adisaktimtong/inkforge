# Current-Stack Review — Architecture Spine

Verified against primary project documentation and npm registry metadata on **2026-09-15 (Asia/Bangkok)**. The review covers every versioned dependency in the Stack table and the compatibility-critical platform claims in AD-5, AD-6, AD-7, AD-9, AD-11, AD-13, AD-14, and AD-15. It does not change `ARCHITECTURE-SPINE.md`.

## Verdict

**REVISION REQUIRED.** All exact package versions named in the Stack table are published, and the central pairings are valid: React 19.3.0 is accepted by Next.js 16.3.5, Vitest 5 accepts Vite 8, tsdown 0.23 accepts TypeScript 7, parse5 8 fits an ESM-only build, and Playwright supports the three named browser engines. However, the declared Node support range is wider than the selected runtime and tooling permit, and the release/provenance design omits prerequisites that determine whether the promised controls can work.

## Findings

### 1. HIGH — `support >=22` is not compatible with the selected stack

**Spine claim:** The Stack declares Node.js `build/release 24; support >=22` (`ARCHITECTURE-SPINE.md:179`), while AD-15 says Node packages support the Node 22 and 24 families (`ARCHITECTURE-SPINE.md:143-147`).

**Verified constraints:**

- Vite 8.3.0 and Vitest 5.0.0 require Node `>=22.12.0` on the 22.x line. Vitest 5 explicitly declares Vite `^6.4.0 || ^7.0.0 || ^8.0.0`. [Vite 8 requirements](https://vite.dev/blog/announcing-vite8), [Vitest 5 migration guide](https://main.vitest.dev/guide/migration/), [Vitest 5.0.0 registry metadata](https://registry.npmjs.org/vitest/5.0.0)
- `sanitize-html@2.17.7`, a runtime dependency of the server adapter, requires Node `>=22.12.0`. [npm registry](https://registry.npmjs.org/sanitize-html/2.17.7)
- `tsdown@0.23.0` requires Node `^22.18.0 || ^24.11.0 || >=26.0.0`. [npm registry](https://registry.npmjs.org/tsdown/0.23.0)
- `@changesets/cli@3.0.3` requires Node `^22.11 || ^24 || >=26`. [npm registry](https://registry.npmjs.org/%40changesets%2Fcli/3.0.3)
- npm Trusted Publishing requires Node `>=22.14.0` and npm CLI `>=11.5.1`. [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

**Impact:** A consumer on Node 22.0–22.11 can satisfy the spine's advertised range but cannot install the selected server sanitizer without an engine mismatch. A CI job labeled only `node-version: 22` is currently likely to resolve to a compatible patch, but the architecture is a release contract and should not depend on moving aliases to express its minimum.

**Required change:** Split the policy into explicit floors:

- public server/runtime support: Node `>=22.12` (or raise to `>=22.18` if one uniform floor is preferred);
- workspace build/test on Node `22.18+` and current Node 24 LTS;
- release publishing on Node 24 with npm CLI `>=11.5.1`.

Pin exact CI patch versions or centrally managed aliases in the scaffold. Node 22 and 24 are both LTS lines as of the review date; the latest releases are v22.23.2 and v24.21.0. [Node.js release status](https://nodejs.org/en/about/previous-releases), [Node distribution index](https://nodejs.org/dist/index.json)

### 2. HIGH — Provenance is promised without the repository-visibility prerequisite

**Spine claim:** AD-13 promises npm Trusted Publishing and provenance after GitHub Environment approval (`ARCHITECTURE-SPINE.md:131-135`).

**Verified constraints:** npm Trusted Publishing can authenticate publishes from GitHub-hosted Actions with OIDC, but automatic npm provenance requires **both a public package and a public source repository**. npm explicitly says provenance is not generated for a private repository even when the package is public. The workflow also needs `id-token: write`, a matching trusted-publisher configuration, Node `>=22.14.0`, npm `>=11.5.1`, and a GitHub-hosted runner. [npm Trusted Publishing requirements and limitations](https://docs.npmjs.com/trusted-publishers/)

GitHub Environment required reviewers are also plan/visibility dependent: on GitHub Free, Pro, and Team they are available only to public repositories. [GitHub deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

**Impact:** An in-house project kept in a private repository can use OIDC trusted publishing but cannot satisfy the stated provenance invariant. Depending on the GitHub plan, it may also be unable to implement the specified manual approval gate.

**Required change:** Record repository visibility and GitHub plan as release prerequisites. If the repository will remain private, change the invariant from “มี … provenance” to a conditional capability and define the compensating evidence/control. Also require GitHub-hosted runners, `id-token: write`, exact `repository.url`, an npm CLI floor, and an environment-name match in the release contract.

### 3. HIGH — Changesets CLI alone does not create the promised release PR, tags, or GitHub Release

**Spine claim:** AD-13 says “Changesets สร้าง release PR” and then publishes, tags, and creates a GitHub Release (`ARCHITECTURE-SPINE.md:135`), but the Stack inventories only `@changesets/cli@3.0.3` (`ARCHITECTURE-SPINE.md:189`).

**Verified behavior:** The CLI versions packages and publishes them; GitHub PR/tag/release automation is supplied by `changesets/action` or custom workflow code. The official v2 action documentation distinguishes `version` (create/update the release PR), `publish`, tag pushing, and GitHub Release creation. It also recommends separate sub-actions when using trusted publishing so permissions can be narrowed. [Changesets Action v2 documentation](https://github.com/changesets/action/blob/main/README.md)

**Impact:** The stack as listed is not sufficient to implement the adopted release flow. A scaffold can comply with every pinned package row and still have no component that creates the release PR or GitHub Release.

**Required change:** Add `changesets/action@v2` (preferably pinned by full commit SHA in workflows) or name the custom automation that owns each transition. Specify separate version and publish jobs so PR-writing permissions are not combined with npm OIDC publishing permissions, and state which step creates tags and GitHub Releases.

### 4. MEDIUM — A single sanitizer policy is a design goal, not a verified adapter equivalence

**Spine claim:** AD-6 says one `ContentPolicy` compiles to DOMPurify in the browser and sanitize-html on the server, with shared fixtures preventing policy drift (`ARCHITECTURE-SPINE.md:89-93`).

**Verified behavior:** Both chosen versions exist and are appropriate to their stated environments. They do not expose the same policy model or parser behavior, however. DOMPurify sanitizes through a browser DOM and offers DOM/Trusted Types-oriented controls; sanitize-html uses its own tag, attribute, scheme, transform, and style filtering options and warns that style URLs are only as safe as the caller's regular expressions. [DOMPurify security model](https://github.com/cure53/DOMPurify/wiki/Security-Goals-%26-Threat-Model), [sanitize-html options](https://github.com/apostrophecms/apostrophe/blob/main/packages/sanitize-html/README.md)

**Impact:** “Compile the same policy” is not automatically achievable for every future `ContentPolicy` feature. Passing a finite common fixture suite cannot prove semantic equivalence for all HTML, URL, namespace, CSS, and parser edge cases.

**Required change:** Define `ContentPolicy` as the explicit intersection of behavior supported by both adapters. Each compiler must reject an unrepresentable policy rather than approximate it. Add differential/property-based tests that compare normalized outcomes, plus adapter-specific security regression fixtures. Keep server sanitization authoritative, as the spine already requires.

### 5. LOW — The snapshot is valid but was not fully current by the end of 2026-09-15

Every exact version in the Stack table was published by the review cutoff. Two selected pins were no longer the npm `latest` dist-tag when checked: pnpm 12.4.2 superseded 12.4.1, and Vitest 5.0.1 superseded 5.0.0, both on 2026-09-15. [pnpm registry metadata](https://registry.npmjs.org/pnpm), [Vitest registry metadata](https://registry.npmjs.org/vitest)

This is not itself a compatibility defect because the spine intentionally exact-pins build/test tools through the lockfile. It does mean “Version snapshot ตรวจสอบเมื่อ 2026-09-15” should be treated as an existence/compatibility snapshot, not a claim that every entry is latest. Record a timestamp or the lockfile commit after scaffold to make later audits reproducible.

## Version and Compatibility Matrix

| Technology | Spine selection | Registry / primary-source check | Compatibility assessment |
| --- | --- | --- | --- |
| Node.js | build/release 24; support `>=22` | v22 and v24 are LTS; latest at cutoff v22.23.2 and v24.21.0. [Node releases](https://nodejs.org/en/about/previous-releases) | **Revise floor.** Runtime needs 22.12+; complete toolchain needs 22.18+; publishing also needs npm 11.5.1+. |
| TypeScript | 7.0.2 | Exact version published; Node `>=16.20`. [registry](https://registry.npmjs.org/typescript/7.0.2) | Compatible with Node policy and tsdown 0.23 peer range. |
| React | 19.3.0 | Exact version published. [registry](https://registry.npmjs.org/react/19.3.0) | Compatible with the declared peer range. |
| React DOM | 19.3.0 | Exact version published; peer React `^19.3.0`. [registry](https://registry.npmjs.org/react-dom/19.3.0) | Compatible with React 19.3.0 and Next 16.3.5. |
| React peer policy | `>=18.2 <20` | `useSyncExternalStore` is available from React 18. [React 18 guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide) | Valid for the named API. Test both 18.2 and 19.3 consumer fixtures before release. |
| Next.js | 16.3.5 | Exact version published; Node `>=20.9`; peers accept React/React DOM `^18.2.0` or `^19.0.0`. [registry](https://registry.npmjs.org/next/16.3.5) | Compatible with Node 24 demo and React 19.3.0. |
| Vite | 8.3.0 | Exact version published; Node `^20.19 || >=22.12`. [registry](https://registry.npmjs.org/vite/8.3.0) | Compatible with Node 24 and Vitest 5; contradicts unrestricted `>=22`. |
| pnpm | 12.4.1 | Exact version published; Node `>=18`; 12.4.2 was latest at cutoff. [registry](https://registry.npmjs.org/pnpm/12.4.1) | Compatible; one patch behind latest. |
| Turborepo (`turbo`) | 2.10.13 | Exact version published. [registry](https://registry.npmjs.org/turbo/2.10.13) | No conflicting engine or peer constraint exposed by registry metadata. |
| tsdown | 0.23.0 | Exact version published; Node `^22.18 || ^24.11 || >=26`; TypeScript peer includes `^7`. [registry](https://registry.npmjs.org/tsdown/0.23.0) | Compatible on current Node 22/24 patches. ESM output is the default; `.d.ts` and source maps require explicit configuration or qualifying package metadata. [format](https://tsdown.dev/options/output-format), [declarations](https://tsdown.dev/options/dts), [source maps](https://tsdown.dev/options/sourcemap) |
| Vitest | 5.0.0 | Exact version published; Node `^22.12 || ^24 || >=26`; Vite peer includes `^8`. [registry](https://registry.npmjs.org/vitest/5.0.0) | Compatible with Vite 8.3 and Node 24; contradicts unrestricted `>=22`; 5.0.1 was latest at cutoff. |
| Playwright Test | 1.63.0 | Exact version published; Node `>=20`. [registry](https://registry.npmjs.org/%40playwright%2Ftest/1.63.0) | Compatible. Chromium/Firefox/WebKit projects are supported by Playwright; exact browser binaries must be installed from the pinned Playwright release. |
| Changesets CLI | 3.0.3 | Exact version published; Node `^22.11 || ^24 || >=26`, npm `>=10.9`, pnpm `>=10`. [registry](https://registry.npmjs.org/%40changesets%2Fcli/3.0.3) | Compatible with pnpm 12 and Node 24; insufficient by itself for release PR/tag/GitHub Release automation. |
| parse5 | 8.0.1 | Exact version published; ESM package. [registry](https://registry.npmjs.org/parse5/8.0.1) | Compatible with ESM-only output. The project describes it as WHATWG HTML-compliant. [parse5 docs](https://parse5.js.org/) |
| DOMPurify | 3.4.15 | Exact version published with ESM and CJS exports. [registry](https://registry.npmjs.org/dompurify/3.4.15) | Appropriate for the browser adapter and named desktop browser families. Does not establish equivalence with sanitize-html. |
| sanitize-html | 2.17.7 | Exact version published; Node `>=22.12`. [registry](https://registry.npmjs.org/sanitize-html/2.17.7) | Appropriate for server sanitization; raises the public Node floor above `>=22`. |
| publint | 0.3.24 | Exact version published; Node `>=18`. [registry](https://registry.npmjs.org/publint/0.3.24) | Compatible. |
| Are the Types Wrong CLI | 0.18.5 | Exact version published; Node `>=20`. [registry](https://registry.npmjs.org/%40arethetypeswrong%2Fcli/0.18.5) | Compatible. |

## Verified Non-Versioned Claims

- Native `DOMParser`/`template` in browsers plus parse5 on the server is a reasonable dual-parser strategy because parse5 targets the WHATWG parsing model. Normalization and differential fixtures remain necessary; parser identity is not guaranteed. [WHATWG HTML parsing standard](https://html.spec.whatwg.org/multipage/parsing.html), [parse5 docs](https://parse5.js.org/)
- `useSyncExternalStore` is the correct React API for an external engine-owned store and supports the React 18 minimum. [React documentation](https://react.dev/reference/react/useSyncExternalStore)
- Vitest on Node for pure logic and Playwright for browser-owned selection, clipboard, composition, and accessibility behavior is a supported split. Vitest's Node environment is its default; emulated DOM environments do not replace the real-browser gate. [Vitest environments](https://vitest.dev/guide/environment), [Playwright browsers](https://playwright.dev/docs/browsers)
- `package.json#exports`, package `private: true`, SemVer, npm dist-tags (`beta`, `latest`), MIT licensing, and GitHub Actions are all current platform mechanisms. They are policies rather than compatibility guarantees and must be implemented and tested in the scaffold.

## Required Reconciliation Before Scaffold Is Treated as Release-Ready

1. Replace the broad Node range with explicit runtime, workspace, CI, and publishing floors.
2. Decide whether the source repository is public. Make provenance conditional or provide a compensating private-repository control.
3. Name and pin the GitHub release automation (`changesets/action@v2` or custom code), separating version-PR and OIDC publish permissions.
4. Define the portable subset of `ContentPolicy` and require adapter compilers to reject unsupported policy features.
5. Record an exact verification timestamp and lockfile commit; optionally refresh pnpm and Vitest after their same-day patch releases pass the gates.
