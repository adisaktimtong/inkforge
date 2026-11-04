- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Enforce release-candidate provenance and first-publish npm scope/trusted-publisher gates.
  evidence: The scaffold documents the approval/OIDC boundary, but validating organization ownership, package-name availability, trusted-publisher mapping, and release-PR ancestry requires GitHub/npm repository configuration that is not present locally.
- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Implement atomic canary/beta/latest promotion and rollback automation.
  evidence: The repository documents the required channels and rollback behavior, but actual tag promotion and recovery need a release environment and published package cohort.
- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Expand typed ESLint rules once editor TypeScript source exists.
  evidence: Story 1 contains only compileable stubs, so typed lint rules belong with the first behavior-bearing implementation story.
- source_spec: `spec-basic-editor-toolbar.md`
  summary: Provide transactional undo/redo for toolbar heading and list changes when building the core history engine.
  evidence: These supported transformations currently use DOM operations for consistent multi-block results across browsers, so native undo does not reverse them. This shares the existing MVP adapter's normalization/paste history limitation; no custom history engine or undo UI is part of this increment. Future engine acceptance must cover block/list changes followed by typing and undo/redo across both operations.
