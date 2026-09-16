- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Enforce release-candidate provenance and first-publish npm scope/trusted-publisher gates.
  evidence: The scaffold documents the approval/OIDC boundary, but validating organization ownership, package-name availability, trusted-publisher mapping, and release-PR ancestry requires GitHub/npm repository configuration that is not present locally.
- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Implement atomic canary/beta/latest promotion and rollback automation.
  evidence: The repository documents the required channels and rollback behavior, but actual tag promotion and recovery need a release environment and published package cohort.
- source_spec: `/Users/adisak.t/Repo/texteditor/_bmad-output/implementation-artifacts/spec-1-establish-the-workspace-package-boundaries-and-release-contract.md`
  summary: Expand typed ESLint rules once editor TypeScript source exists.
  evidence: Story 1 contains only compileable stubs, so typed lint rules belong with the first behavior-bearing implementation story.
