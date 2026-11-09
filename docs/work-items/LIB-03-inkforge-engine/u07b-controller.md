---
document_id: IF-U07B-CONTROLLER
artifact_type: decision
sdlc_stage: Build
status: inReview
mode: implementation
owner_repository: adisaktimtong/inkforge
work_item: LIB-03-inkforge-engine/U07-B
usage: currentImplementationDecision
related_stages:
- Design
- Test
---

# U07-B — Pure granular engine controller

The user's next “ต่อ” assigns the engine command/selection/bookmark prerequisite after U07-A. This delivery implements a bounded pure Core controller through public `createEngine` / `EngineController` at `@inkforge/editor-core`. [Actual evidence](u07b-evidence.md) qualifies this implementation. The [complete LIB-03 plan](plan.md) remains partial; DOM/React engine binding, full command catalogue, plugins and exact host acknowledgments are not marked done.

## Intent and specification

Keep the original DocumentNode constructors, legacy createEditorEngine/replaceDocument prototype and React HTMLDivElement API unchanged. A new controller owns its model operations, runtime node index, selection, semantic history, composition protocol and saved model witness. It does not delegate editing to DOM, HTML strings, execCommand, React, CMS or a Go framework. The index.ts addition is an export only; engine.ts and existing constructor bodies stay byte-identical to the pre-slice working tree.

Runtime IDs are sidecar data in an immutable NodeView index, never fields persisted into the public AST/HTML/cms.richText. Text edits preserve IDs. Split keeps the left ID and allocates a right ID; inverse operations restore the original logical IDs, and the allocator never rewinds. Fresh external loads allocate a new session/IDs even for equal content. Model imports reject cycles, shared node aliases, accessors, unsupported nesting, unknown fields and invalid UTF-16. No Unicode normalization occurs.

Positions use nodeId/UTF-16 offset or direct-child boundary plus explicit affinity; mid-surrogate offsets and atomic-node interior carets reject. Selection keeps anchor/head direction. Operation maps include normalization, text split/join and structural child moves/removals. User setSelection advances selectionEpoch without a content revision; mapped changes/bookmark restore do not invent a new user intent. StateVersion tracks publications independently. Snapshot references are stable on noChange/rejection and deeply frozen for subscribers.

## Public commands and atomic pipeline

Implemented: insertText, deleteRange, deleteBackward/deleteForward (grapheme/word), setMark/clearMark/setStoredMarks, setBlockType, insertHardBreak, splitBlock, joinBlocks, undo/redo, begin/commit/cancelComposition. Text-block range replacement, nested-link block split, explicit paragraph/heading changes and adjacent compatible joins preserve supported descendants. Existing model links/lists can be imported and indexed; editing commands do not silently flatten list structures.

Commands compile into private granular forward/inverse operations, run bounded normalization and schema/host validation, check all original fences again, then publish one atomic candidate. Rejection changes no public model/selection/history/snapshot. Same-model replacements retain node identity. Subscriber errors cannot roll back an accepted edit; reentrant mutation rejects. Unsupported commands/units/schema fits reject explicitly. There is no replaceDocument fallback in this controller.

Grapheme/word deletion requires an explicit immutable segmentation port with locale/runtime-data fingerprint. Results must cover the input in strictly ordered legal UTF-16 boundaries; missing/throwing/async/malformed providers fail closed. Core does not instantiate Intl.Segmenter or silently fall back to code-unit deletion. The test host supplies the recorded Intl implementation. Core's line/layout-dependent deletion, validated slice insertion, list transforms, setLink/removeLink and plugin registry remain downstream.

## Tokens, bookmarks and original fences

DispatchContext expects a nominal, privately issued ControllerToken from the actual controller snapshot. Its diagnostic fields are engineInstanceId/sessionId/revision/selectionEpoch. Copied tokens and tokens from a different controller reject, including when a host accidentally duplicates instanceId strings. The host supplies instanceId for stable diagnostic names; metadata is not authorization.

captureBookmark returns an immutable opaque bookmark retaining the original selection/token and fence callback/reference. Exact revision/selection/session checks, private issuance and a bounded ledger reject old/released/copied/foreign bookmarks. restoreBookmark never increments selectionEpoch. A fresh context ticket cannot replace the original captured fence, which is checked again at restore/dispatch. Readonly/composition/external load changes invalidate armed tools. releaseBookmark is explicit and idempotent; callbacks cannot restamp a discarded tool.

HostFence is a synchronous original-reference policy port, not a CMS permission implementation. It neither creates an owner/session nor substitutes for LIB-05 exact field acknowledgment. No new engineBinding or PublicHostFieldPort implementation is exposed through the legacy React editor; its unsupported bridge guard stays active.

## History, checkpoints and composition

History stores semantic forward/inverse operation groups, selection and stored marks, not DOM or whole-document replacement snapshots. The injected monotonic clock groups compatible adjacent typing/deletion within an inclusive 1000ms default. Selection/formatting/save boundaries close groups; per-group operation limits guarantee undo remains executable. New accepted content truncates redo; rejected/noChange/selection changes preserve the redo branch. Entry/encoded-byte bounds evict old whole groups or reject oversized candidates before commit.

Dirty compares current canonical model content with the acknowledged model witness and pending composition. Checkpoints are nominal, exact, finite and explicitly released/acknowledged. Accepting checkpoint B while current C preserves C's dirty state; undo to B can become clean. Older/forged/released/foreign-session/fence-stale witnesses reject. This is not a canonical HTML/profile witness, a parent FieldAck or a server Save receipt. Unsaved external loads preserve the previous baseline; a persisted load changes it only through an explicit host origin.

Composition keeps the committed model unchanged until one final transaction. Save/bookmark/edit/history actions cannot finalize it implicitly. Rejected final content stays pending; explicit cancel/dispose is separate. The exact token returned at beginComposition must be retained for commit/cancel: even reusing the same compositionId cannot let an old callback target a later composition. This is the pure state protocol, not a native DOM/OS IME implementation.

Dispose is terminal/idempotent, drops owned protected model/history/selection/ledgers and suppresses revival. Existing caller-held immutable snapshots retain their normal caller ownership. Unsubscribing from a borrowed controller does not dispose it.

## Implementation / acceptance plan

1. Add independent types/model/index/operation/command modules without editing legacy engine/constructor bodies.
2. Verify granular operations, mapping/ID lineage, exact fences, selection epochs, semantic history/baselines, finite limits, composition schedules and terminal disposal against independent assertions/oracles.
3. Pack the real package, execute the same tests from public imports with React/UI absent, check strict emitted declarations and actual negative compilation, and rerun the existing physical Next/legacy editor cohort without replacing its prototype dependency.
4. Record exact source/package/tool/runtime/log identities and keep complete LIB-03/U07/CMS certification unaccepted.

## Next dependency slice

U07-C implements the single DOM adapter and its native selection/input/composition reconciliation, then the React/Common UI toolbar/controller binding and exact standalone/Builder host field/fence acknowledgment. It must preserve the original armed bookmark token across native focus changes and use the actual public controller. Remaining list/link/slice/layout commands and plugin/budget/performance/native-IME/manual-AT qualification remain explicit gates. Shared Go-framework wiring and live Tenant/Domain/Azure values stay deferred. No commit/push, package registry publication or deployment is included.
