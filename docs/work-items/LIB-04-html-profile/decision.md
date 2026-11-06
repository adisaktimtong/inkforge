---
document_id: LIB-04-html-profile-decision
artifact_type: decision
sdlc_stage: Design
status: draft
mode: designOnly
owner_repository: adisaktimtong/inkforge
work_item: LIB-04-html-profile
usage: plannedWorkItem
---

# HP-DEC-01 — Strict CMS profile and canonical Save identity

Date 2026-11-06 UTC Scope: agent design selection under continued system-design assignment, not a new user approval/runtime adoption Source [Canonical Spec](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/25-inkforge-html-profile-and-parity.md); existing [Authoring Contract](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/08-authoring-and-rendering-contract.md)/[Link Contract](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/architecture/13-links-and-reference-resolution.md)/[LIB-05](https://github.com/adisaktimtong/enterpises_cms/blob/codex/cloud-environment-setup/docs/work-items/LIB-05-nested-editor/spec.md)

## Concrete reconciliation

Pinned Inkforge AD-5/6/html-contract describe a broader library with RawHtml/source/legacy style and semantic parity Current CMS v1 only allows declared tags/token classes and no Source/media/RawHtml Current parser truncates/normalizes before strict host verdict; LinkNode/serializer cannot yet retain target/rel/content.css is placeholder Go framework will be supplied separately

## Options

| Option | Effect |
| --- | --- |
| Reuse existing parseHtml output as trusted CMS HTML | Small adapter but silent wrapper/style/target loss and incomplete strict checks; rejected |
| Make every library consumer use strict CMS default | Breaks independent library/general profiles; rejected |
| Opt-in strict audited profile + canonical writer + framework-neutral Go domain boundary | Selected design; preserves source/API compatibility while making missing capabilities visible |

## Selected details and impact

- Separate sanitizer verdict/normalized safe AST equality from final canonical writer byte identity Same safety semantics can have different internal parser bytes; stored Save bytes must exactly match checkpoint or server rejects before write
- Keep html/contentProfile literals and old 22 fixtures unchanged No persisted format migration or client authority added
- Detail strict v1 default class placement to exact registered span tokens; typo token group conflict rejects; new block placement needs explicit profile compatibility review Existing candidates are not deployed CSS
- Accept only declared aliases/escaping/case/void/list/empty/whitespace normalization Lossy/unsupported attributes, extra rel semantics and malformed semantic repairs reject with original retained General-library RawHtml/source support does not auto-enable CMS v1
- Preserve optional target/rel/token semantics through typed public model extension before enabling capability; no private import/regex rewrite or permissive custom scheme wildcard
- Source/ADOPTED design does not prove parser/theme implementation Browser/server entries currently share parser; actual independent standards adapters/parity still required
- Honor user-confirmed shared Go framework as deferred boundary Domain input/output/verdict fixtures can be designed now; framework handlers/middleware/Go signatures not invented and no framework acceptance claimed

No upstream Inkforge source/design modified in this task Framework/publish/deploy/JS service/server autosave/browser sensitive draft storage not introduced User instruction supports design work; selection of these technical details is attributed to the agent, not fabricated user approval
