# Final Adversarial Closure Review — Architecture Spine

## Verdict

**FAIL** — the revision closes the package-owner, token-authority, node-ID lifetime, raw-HTML, runtime-export, cohort-resolution, prerelease-pinning, and rollback holes from the previous closure pass. Four remaining semantics can still make independently built units obey every AD literally yet disagree in user-visible or security-sensitive behavior.

No remaining issue requires reversing AD-18–AD-29. The fixes are narrow tightenings to AD-6, AD-18, AD-19, and AD-20.

## Replay of prior high-divergence attacks

| Attack | Result | Evidence |
| --- | --- | --- |
| Competing token-registry owners | Closed | AD-24 makes `editor-core` registry snapshot authoritative; Structural Seed now says `editor-content` is not runtime authority |
| Text/container offset units | Closed | AD-19 fixes UTF-16 code units versus child indices |
| Node-ID lifecycle across import and transactions | Closed | AD-19 defines lineage uniqueness, transaction survival, fresh import IDs, and non-serialization |
| Revision/snapshot/save acknowledgement ordering | Closed | AD-19 requires one monotonic revision per commit, synchronous ordered publication, and revision+digest matching |
| React/plugin direct DOM mutation | Closed | AD-20 makes DOM adapter the sole browser-event receiver and forbids editable-subtree mutation elsewhere |
| Clipboard insertion bypassing core | Closed | AD-20 requires `insertSlice` command for document insertion |
| Lexical versus semantic raw-HTML preservation | Closed | AD-23 explicitly chooses canonical semantic preservation and topmost opaque subtree classification |
| Duplicate core runtime and server/browser graph leakage | Closed | AD-27 externalizes core, separates HTML subpaths, and requires packed graph tests |
| CSS/token configuration mismatch | Closed | AD-24 requires one immutable registry/prefix fingerprint across core, HTML, wrapper, sanitizer, and CSS |
| Stable mixed-cohort promotion/rollback | Closed | AD-22 requires range-compatible intermediate tag states and last-known-good rollback |
| Prerelease dependency drift | Closed | AD-22 requires exact internal cohort versions for prereleases |
| Security boundary omitted by host | Closed | AD-29 requires server sanitization on save and immediately before render |
| Affinity behavior at operation boundaries | Open | AD-19 names `forward|backward` but does not define their mapping semantics |
| Interrupted composition classification | Open | AD-20 defines end/cancel but not blur, disposal, DOM loss, or missing `compositionend` |
| Browser/server policy evaluation equivalence | Open | AD-6 compares results but does not define authoritative policy semantics |
| Overlapping plugin-rule precedence and convergence | Open | AD-18 freezes a registry and rejects duplicates, but valid overlapping rules can still execute differently |

## Remaining critical/high findings

### 1. `affinity` is typed but not semantically defined

- **location:** AD-19
- **trigger_condition:** Core and DOM both use `{nodeId, offset, affinity: forward|backward}`, but one maps `forward` to the inserted content’s trailing edge while the other treats it as attachment to the following logical position; both satisfy the declared shape and operation mapping rule
- **guard_snippet:** Tighten AD-19 with normative stickiness semantics for insert-at-position, delete-across-position, split, join, wrap, unwrap, and node deletion; provide shared expected position maps for collapsed/ranged selections and bookmarks
- **potential_consequence:** Caret, restored bookmark, checker focus, and follow-up typing land on different sides of edits despite both units using the canonical type

### 2. Interrupted IME sessions still have two compliant outcomes

- **location:** AD-20
- **trigger_condition:** `compositionend` commits and cancellation discards, but the AD does not classify blur, editor disposal, editable subtree replacement, page visibility change, browser mutation loss, or a browser that never emits `compositionend`; one adapter may flush and another may classify the same interruption as cancellation
- **guard_snippet:** Add a normative composition transition table mapping start/update/end/cancel/blur/dispose/reconcile failure to commit, discard, or restore actions, including revision, selection, and history effects; make the table a shared Playwright/Thai IME fixture
- **potential_consequence:** Valid composed text can disappear, duplicate, or form different undo groups depending on browser and adapter implementation

### 3. `ContentPolicy` has an owner but no authoritative evaluator semantics

- **location:** AD-6; AD-18; AD-29
- **trigger_condition:** Browser and server compilers can interpret URL canonicalization, encoded/whitespace-obfuscated schemes, duplicate attributes, namespaces, malformed markup, and unsupported sanitizer options differently; comparing verdict and normalized AST in a finite fixture set does not determine which interpretation is correct outside those fixtures
- **guard_snippet:** Tighten AD-6 so `editor-html` owns a normative policy evaluator/canonicalization algorithm and compiler capability check; configuration that either sanitizer cannot enforce must fail at policy construction, and fixtures must assert authoritative expected verdict/AST rather than only adapter agreement
- **potential_consequence:** The server security boundary can accept content the browser rejects, reject previously accepted persisted content, or allow an encoded active-content bypass while all declared fixtures pass

### 4. Valid overlapping plugin rules have no deterministic winner

- **location:** AD-18
- **trigger_condition:** Immutable registration and duplicate-name rejection do not settle two differently named parse rules matching the same element, two normalizers applicable to the same node, command/normalizer re-entry, or whether registration order is part of the compatibility contract
- **guard_snippet:** Tighten AD-18 with a deterministic total order for parse/serialize/normalize rules, explicit tie rejection, bounded normalization-to-fixpoint behavior, and non-reentrant/exception-contained plugin execution; add permutation tests proving the same registry produces the same result
- **potential_consequence:** Core and HTML adapters can parse or normalize the same plugin document differently, break semantic round-trip, or loop indefinitely while still accepting the same nominal plugin registry

## Final decision

The spine is one tightening pass away from closure. Fixing findings 1–4 removes the remaining demonstrated paths for independently built units to diverge at the architecture-contract level; lower-level edge behavior can then move safely into implementation specs and executable fixtures.
