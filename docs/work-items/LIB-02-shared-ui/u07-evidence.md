---
document_id: IF-U07A-EVIDENCE
artifact_type: evidence
sdlc_stage: Test
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-02-shared-ui/U07-A
usage: scopedRuntimeEvidence
related_stages:
- Build
---

# Inkforge — U07-A actual evidence

[Implementation scope](u07-presentation.md) and [machine-readable owner artifact/source evidence](../../../contracts/u07-presentation-evidence.json) identify the uncommitted candidate. Full U07/combined CMS acceptance remains notRun; the root target design is not globally marked implemented.

The real packed integration runs from Common UI with sibling owner checkouts:

```sh
UI_NPM_OFFLINE=1 node scripts/test-owner-adapters.mjs
```

The command belongs to ui-component, not this repository. It builds five physical packages, installs them into isolated locked consumers and checks single React identity, public declarations, strict Next build, optional dependency absence and native browser schedules. The owner JSON records exact artifacts, source digests, runtime/tooling, logs and accepted limits. Twelve Node and thirteen Chromium cases plus nine actual negative public type rejections cover the presentation cohort. Builder's separate typecheck/77 regressions are recorded with their own scope.

Core files and preexisting prototypes outside the explicit adapter patch are preserved by SHA-256 comparison. In particular, passing legacy HTML/formatting/undo in this fixture does not accept Inkforge's existing prototype as LIB-03. CDP composition drives native browser events; native OS IME/manual AT and browser-family certification remain notRun. The legacy inline-style fixture makes no production-CSP claim. Existing UI production nonce/CSP evidence stays unchanged. No release, push or CMS save receipt is inferred.
