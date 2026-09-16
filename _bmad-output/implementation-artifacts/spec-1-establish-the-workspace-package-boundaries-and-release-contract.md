---
title: 'Establish the workspace, package boundaries, and release contract'
type: 'feature'
created: '2026-09-15'
status: 'done'
route: 'full'
review_loop_iteration: 0
baseline_commit: '76f7d1b05195bac6e384131d9d3b2e622e6f0b4d'
context:
  - '_bmad-output/specs/spec-editor-engine/SPEC.md'
  - '_bmad-output/specs/spec-editor-engine/architecture-spine/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repository มีเพียงเอกสารสเปก จึงยังไม่มี workspace ที่สร้าง ทดสอบ หรือจัด release editor package ได้อย่างปลอดภัย ทั้ง package boundary และ release contract ต้องถูกวางให้ถูกตั้งแต่ต้นเพื่อไม่ให้ internal implementation กลายเป็น public npm API โดยไม่ได้ตั้งใจ

**Approach:** Scaffold pnpm/Turborepo monorepo สำหรับ public editor packages, internal adapters และ React/Next demos พร้อม strict TypeScript, package exports, Changesets และ CI/release workflow templates ที่ตรวจสอบได้ โดยยังไม่สร้าง editor behavior.

## Boundaries & Constraints

**Always:** ใช้ Node `>=22.18.0` และ pnpm `12.4.2`; ใช้ ESLint + Prettier เป็น deterministic lint/format gate; public packages ใช้ logical names ชั่วคราวจนเลือก npm scope ก่อน first publish; build เป็น ESM-only ผ่าน tsdown พร้อม declaration และ source map; public API เปิดเฉพาะ `package.json#exports`; version เป็นอิสระผ่าน Changesets; `editor-react` ใช้ React/React DOM peer range `>=18.2 <20` และ externalize `editor-core`; Next.js อยู่ใน private demo; public package ต้องมี MIT license และทดสอบ packed artifact โดยไม่มี unresolved private runtime dependency.

**Never:** ห้าม implement document engine, DOM editing, parser/sanitizer, source mode, React editor UI, checkers หรือ image upload ใน story นี้; ห้าม publish `internal/editor-dom`, `internal/editor-source` หรือ `apps/*`; ห้ามใส่ npm token/credential หรือสั่ง publish จริง; ห้ามเลือก npm organization scope หรือ final package names ก่อน first-publication gate.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Workspace install | Fresh clone with supported Node and pnpm | `pnpm install --frozen-lockfile` resolves every workspace and root script recognizes all workspaces | Unsupported Node is rejected by `engines`; lockfile drift fails the command |
| Public packing | A selected public workspace is packed | Tarball contains only declared ESM/types/assets and resolves public dependencies/peers | Validation fails on invalid exports, types, or private unresolved runtime dependency |
| Internal boundary | Consumer imports package through packed tarball | Internal DOM/source modules cannot be resolved as npm packages or public deep imports | Build/pack validation reports the prohibited export/dependency |
| Release preparation | A Changeset exists for changed public package only | Version workflow prepares a release PR; unchanged packages stay unbumped unless their range is incompatible | Publish workflow remains blocked without environment approval and trusted-publisher prerequisites |

</frozen-after-approval>

## Code Map

- `_bmad-output/specs/spec-editor-engine/architecture-spine/ARCHITECTURE-SPINE.md` -- binding AD-7 through AD-15, AD-26 through AD-29, stack snapshot, topology and release contracts.
- `_bmad-output/specs/spec-editor-engine/SPEC.md` -- product constraints and CAP-4/CAP-5 boundary context.
- `_bmad-output/specs/spec-editor-engine/stories.yaml` -- Story 1 scope and its package-publication guardrail.
- Repository root -- currently has no package manager, source, CI, license or application files; create scaffold without modifying specification artifacts.

## Tasks & Acceptance

**Execution:**
- [x] Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml`, strict shared TypeScript configuration, and `.gitignore` -- establish deterministic Node/pnpm workspace commands for build, typecheck, unit test, browser test, package validation and demos.
- [x] `packages/{editor-core,editor-html,editor-checks,editor-react,editor-content}/` -- create public ESM package manifests, empty typed entry points, tsdown configurations and explicit exports without shipping behavior or implementation internals.
- [x] `internal/{editor-dom,editor-source}/` and `apps/{react-playground,next-demo}/` -- create private adapter/demo manifests and minimal compile/buildable stubs; demo dependencies are private and Next remains demo-only.
- [x] `fixtures/{html,security,consumers}/`, `tests/{browser,ime-manual}/` -- reserve executable-contract locations with versioned Thai IME checklist and browser-test configuration, without claiming feature coverage before later stories.
- [x] `.changeset/config.json`, `.github/workflows/{ci,release-pr,publish}.yml`, `README.md`, `LICENSE` -- configure independent-version release PRs, documented approval/OIDC publish gate, channels/rollback expectations, setup guidance and MIT distribution terms.
- [x] Root validation scripts and package-validation fixtures -- run type/build/unit placeholders, demo builds, Chromium smoke entry, `publint`, Are-the-Types-Wrong and packed-tarball dependency/export checks deterministically.

**Acceptance Criteria:**
- Given a clean clone on Node 22.18+ or 24, when dependencies are installed and root validation runs, then every workspace typechecks/builds and no package manager or TypeScript configuration is missing.
- Given a consumer is limited to declared package exports, when it installs a packed public tarball, then it can resolve its supported public entry point and cannot resolve private adapters or undeclared deep paths.
- Given a PR workflow, when it runs, then it checks install, typecheck, unit tests, both demo builds and Chromium browser tests; given a release candidate, when it runs, then Node 22/24, all three browser families and packed consumer smoke tests are required before approval.
- Given a public release, when versioning or publishing is attempted, then Changesets creates the release PR separately from an approval-gated Node 24 OIDC publish workflow and documents canary, beta, latest, compatibility cohort and rollback behavior.

## Implementation Notes

- Scaffolded the pnpm 12.4.2/Turborepo workspace, public ESM package shells, private adapters and executable Vite/Next demos without editor behavior.
- Added Node contract tests for workspace, export, privacy and release gates; added Chromium smoke test and Thai IME manual checklist.
- Local Corepack's pnpm shim was corrupt, so verification used a temporary PATH-first pnpm 12.4.2 executable. Repository configuration and CI continue to use the declared pnpm version.

## Spec Change Log

## Review Triage Log

- patch — CI/release setup order, browser installation order, packed subpath coverage, and root contract-test inclusion were corrected; frozen install, format, unit, build, package, and Chromium checks pass.
- defer — Full release-candidate provenance/approval linkage, first-publish npm-scope enforcement, and atomic dist-tag promotion/rollback require repository/org configuration and a dedicated release-hardening story; no publish credentials or external npm state exists in this workspace.
- defer — ESLint TypeScript rule depth is intentionally limited in the initial scaffold; add typed rule configuration with the first implementation story when source code exists.

## Design Notes

The scaffold intentionally uses logical package names as workspace names. Choosing an npm scope changes package identity and trusted-publisher setup, so it remains a first-publication gate rather than an implementation-time placeholder that could leak into released artifacts. Internal adapters are workspace-private and must be bundled into future public consumers rather than referenced at runtime.

## Verification

**Commands:**
- `pnpm install --frozen-lockfile` -- expected: supported Node resolves the committed lockfile without mutation.
- `pnpm typecheck && pnpm test && pnpm build` -- expected: all initial workspaces compile, test and build deterministically.
- `pnpm --filter react-playground build && pnpm --filter next-demo build` -- expected: both executable demo shells build.
- `pnpm test:browser --project=chromium` -- expected: Playwright Chromium smoke suite passes.
- `pnpm check:packages` -- expected: public tarballs pass export/type/package checks and expose no unresolved internal runtime dependencies.
