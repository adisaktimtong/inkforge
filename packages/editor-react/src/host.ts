import type {
  ControllerToken,
  ControllerResult,
  EngineController,
  HostFence,
} from '@inkforge/editor-core';
import type { EngineContentCodec, ProfileIdentity } from '@inkforge/editor-html/engine';
export type { ProfileIdentity } from '@inkforge/editor-html/engine';
export { createStandaloneHostField } from './standalone-host.js';
export type { StandaloneHostField } from './standalone-host.js';

export interface ChildToken {
  readonly sessionId: string;
  readonly revision: number;
}
export type ParentToken =
  | Readonly<{ kind: 'builder'; sessionId: string; sequence: number }>
  | Readonly<{ kind: 'standalone'; hostValueGeneration: number }>;
interface HostSnapshotBase {
  readonly fieldBindingId: string;
  readonly bindingEpoch: number;
  readonly lifecycle: 'active' | 'suspended' | 'disposed';
  readonly interactionContextKey: string;
  readonly parent: ParentToken;
  readonly html: string;
  readonly profile: ProfileIdentity;
}
export type HostFieldSnapshot = Readonly<HostSnapshotBase> &
  (
    | Readonly<{ origin: 'echo'; acceptedRequestId: string; acceptedChildToken: ChildToken }>
    | Readonly<{
        origin: 'ownerLoad' | 'parentUndo' | 'parentRedo' | 'conflictResolution';
        acceptedRequestId?: never;
        acceptedChildToken?: never;
      }>
  );
export interface HostFieldEdit {
  readonly requestId: string;
  readonly capturedHostFenceRef: string;
  readonly child: ChildToken;
  readonly canonicalHtml: string;
  readonly historyGroupId?: string;
  readonly profile: ProfileIdentity;
}
export type HostFieldAck = Readonly<{
  requestId: string;
  fieldBindingId: string;
  bindingEpoch: number;
  acceptedChildToken: ChildToken;
  diagnostics: readonly string[];
}> &
  (
    | Readonly<{
        status: 'committed' | 'noChange';
        actualParentToken: ParentToken;
        exactAcceptedHtml: string;
      }>
    | Readonly<{
        status: 'rejected' | 'stale' | 'disposed';
        actualParentToken: ParentToken | null;
        exactAcceptedHtml?: never;
      }>
  );
export interface PublicHostFieldPort {
  getSnapshot(): HostFieldSnapshot;
  subscribe(listener: () => void): () => void;
  captureFence(): string;
  /** Original owner/auth/binding context, excluding the expected parent sequence advance. */
  isContextCurrent(reference: string): boolean;
  isFenceCurrent(reference: string): boolean;
  /** Optional on legacy custom ports. Hold an original context until a pending operation ends. */
  retainContextFence?(reference: string): (() => void) | null;
  submitFieldEdit(edit: HostFieldEdit): Promise<HostFieldAck>;
}
export interface FieldBindingStatus {
  readonly lifecycle: 'active' | 'suspended' | 'disposed';
  readonly delivery: 'synchronized' | 'pending' | 'rejected' | 'stale';
  readonly localDirty: boolean;
  readonly serverDirty: boolean;
  readonly composing: boolean;
  readonly diagnostics: readonly string[];
}
declare const preparedBrand: unique symbol;
export interface PreparedField {
  readonly [preparedBrand]: true;
  readonly fieldBindingId: string;
  readonly bindingEpoch: number;
  readonly child: ChildToken;
  readonly historyGroupId: string | null;
  readonly canonicalHtml: string;
  readonly profile: ProfileIdentity;
  readonly parent: ParentToken;
  readonly capturedHostFenceRef: string;
}
export type FieldPrepareResult =
  | Readonly<{ status: 'ready'; field: PreparedField }>
  | Readonly<{ status: 'blocked'; diagnostics: readonly string[] }>;
export type FieldDeliveryResult =
  | Readonly<{ status: 'delivered'; ack: HostFieldAck }>
  | Readonly<{ status: 'blocked'; diagnostics: readonly string[] }>;
export interface StagedFieldDelivery {
  readonly edit: HostFieldEdit;
  readonly checkpointId: string;
  isCurrent(): boolean;
  withReadBarrier<T>(
    read: () => T & (T extends PromiseLike<unknown> ? never : unknown),
  ): Readonly<{ status: 'captured'; value: T }> | Extract<ControllerResult, { status: 'rejected' }>;
  accept(ack: HostFieldAck): FieldDeliveryResult;
  cancel(): void;
  /** A server receipt owner may acknowledge this exact issued checkpoint after delivery.
   * Later child edits remain intact. This never substitutes a field-delivery ack for Save. */
  acknowledgeSavedCheckpoint(): ControllerResult;
  releaseCheckpoint(): void;
}
export type FieldStageResult =
  | Readonly<{ status: 'staged'; stage: StagedFieldDelivery }>
  | Readonly<{ status: 'blocked'; diagnostics: readonly string[] }>;
export interface EngineFieldBinding {
  getStatus(): FieldBindingStatus;
  subscribe(listener: () => void): () => void;
  captureHostFence(): HostFence;
  prepareField(): FieldPrepareResult;
  isPreparedCurrent(field: PreparedField): boolean;
  flush(options?: Readonly<{ groupHistory?: boolean }>): Promise<FieldDeliveryResult>;
  stagePreparedField(field: PreparedField): FieldStageResult;
  acceptExternalValue(
    options?: Readonly<{ discardLocal?: boolean }>,
  ): Readonly<{ status: 'accepted' | 'rejected'; diagnostics: readonly string[] }>;
  /** Terminal host ownership cleanup, separate from a borrowed React surface unmount. */
  dispose(): void;
}
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => [k, stable(x)]),
        )
      : v;
const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const child = (e: EngineController): ChildToken => ({
  sessionId: e.getSnapshot().sessionId,
  revision: e.getSnapshot().revision,
});
const blocked = (...diagnostics: string[]) => freeze({ status: 'blocked' as const, diagnostics });
const parentNumber = (t: ParentToken) =>
  t.kind === 'builder' ? t.sequence : t.hostValueGeneration;
function parentStep(before: ParentToken, after: ParentToken, status: string): boolean {
  return (
    before.kind === after.kind &&
    (before.kind !== 'builder' ||
      (after.kind === 'builder' && before.sessionId === after.sessionId)) &&
    Number.isSafeInteger(parentNumber(after)) &&
    parentNumber(after) === parentNumber(before) + (status === 'committed' ? 1 : 0)
  );
}

/** Own this outside React. Surface unmount must not destroy an authorized draft or in-flight ack. */
export function createEngineFieldBinding(
  options: Readonly<{
    controller: EngineController;
    hostField: PublicHostFieldPort;
    codec: EngineContentCodec;
    surfaceStatus: () => Readonly<{ pending: boolean; phase: string }> | null;
    maxEchoRecords?: number;
  }>,
): EngineFieldBinding {
  const { controller: e, hostField: host, codec } = options;
  const limit = options.maxEchoRecords ?? 32;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) throw Error('INVALID_ECHO_LIMIT');
  const initial = freeze(copy(host.getSnapshot()));
  const initialWitness = codec.encode(e.getSnapshot().document);
  if (
    initial.lifecycle !== 'active' ||
    !equal(initial.profile, codec.profile) ||
    initialWitness.status !== 'accepted' ||
    initialWitness.canonicalHtml !== initial.html
  )
    throw Error('HOST_INITIAL_WITNESS_MISMATCH');
  let disposed = false,
    busy = false,
    sequence = 0,
    delivery: FieldBindingStatus['delivery'] = 'synchronized',
    diagnostics: readonly string[] = [];
  let acceptedHtml = initial.html,
    acceptedChild = child(e),
    baseline = initial;
  const listeners = new Set<() => void>(),
    prepared = new WeakMap<PreparedField, ControllerToken>();
  const echoes = new Map<string, Readonly<{ edit: HostFieldEdit; parent: ParentToken }>>();
  const contextHolds = new Set<() => void>();
  function holdContext(reference: string): (() => void) | null {
    const raw = host.retainContextFence?.(reference);
    if (host.retainContextFence && !raw) return null;
    let active = true;
    const release = () => {
      if (!active) return;
      active = false;
      contextHolds.delete(release);
      raw?.();
    };
    contextHolds.add(release);
    return release;
  }
  let pending: Readonly<{ edit: HostFieldEdit; base: HostFieldSnapshot }> | null = null;
  let status: FieldBindingStatus;
  const safeSurface = () => {
    try {
      return options.surfaceStatus();
    } catch {
      return null;
    }
  };
  const contextCurrent = (h: HostFieldSnapshot) =>
    h.fieldBindingId === baseline.fieldBindingId &&
    h.bindingEpoch === baseline.bindingEpoch &&
    h.interactionContextKey === baseline.interactionContextKey &&
    equal(h.profile, codec.profile);
  function publish() {
    const h = host.getSnapshot(),
      s = e.getSnapshot(),
      witness = codec.encode(s.document),
      surface = safeSurface();
    const localDirty =
      !disposed &&
      (s.composing ||
        !!surface?.pending ||
        pending !== null ||
        witness.status !== 'accepted' ||
        witness.canonicalHtml !== acceptedHtml);
    const next = freeze({
      lifecycle: disposed ? ('disposed' as const) : h.lifecycle,
      delivery,
      localDirty,
      serverDirty: s.dirty,
      composing: s.composing,
      diagnostics: [...diagnostics],
    });
    if (!equal(status, next)) {
      status = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          /* Observers cannot interrupt ownership cleanup. */
        }
      }
    }
  }
  function problem(code: string, state: FieldBindingStatus['delivery'] = 'stale') {
    diagnostics = [code];
    delivery = state;
    publish();
  }
  function observeUnchangedField(h: HostFieldSnapshot): boolean {
    if (
      pending ||
      h.origin === 'echo' ||
      !contextCurrent(h) ||
      h.html !== acceptedHtml ||
      h.parent.kind !== baseline.parent.kind ||
      parentNumber(h.parent) < parentNumber(baseline.parent)
    )
      return false;
    if (
      h.parent.kind === 'builder' &&
      baseline.parent.kind === 'builder' &&
      h.parent.sessionId !== baseline.parent.sessionId
    )
      return false;
    // A new parent observation is not an old operation ticket. Existing issued fences remain stale.
    baseline = freeze({ ...baseline, parent: copy(h.parent) });
    if (
      delivery === 'stale' &&
      ['EXTERNAL_VALUE_REQUIRES_REVIEW', 'PARENT_ADVANCED_AFTER_ACK'].includes(diagnostics[0] ?? '')
    ) {
      delivery = 'synchronized';
      diagnostics = [];
    }
    return true;
  }
  function isEcho(h: HostFieldSnapshot): boolean {
    if (h.origin !== 'echo' || !contextCurrent(h)) return false;
    const known = echoes.get(h.acceptedRequestId);
    const request =
      known?.edit ?? (pending?.edit.requestId === h.acceptedRequestId ? pending.edit : null);
    return (
      !!request &&
      equal(request.child, h.acceptedChildToken) &&
      request.canonicalHtml === h.html &&
      equal(request.profile, h.profile) &&
      (known
        ? equal(known.parent, h.parent)
        : (!!pending && parentStep(pending.base.parent, h.parent, 'committed')) ||
          (!!pending && parentStep(pending.base.parent, h.parent, 'noChange')))
    );
  }
  const offEngine = e.subscribe(() => {
    if (e.getSnapshot().disposed) binding.dispose();
    else publish();
  });
  const offHost = host.subscribe(() => {
    const h = host.getSnapshot();
    if (h.lifecycle === 'disposed') {
      binding.dispose();
      return;
    }
    if (!contextCurrent(h)) problem('HOST_CONTEXT_CHANGED');
    else if (h.origin === 'echo' && !isEcho(h)) problem('UNRECOGNIZED_HOST_ECHO');
    else if (h.origin !== 'echo' && !equal(h.parent, baseline.parent)) {
      if (observeUnchangedField(h)) publish();
      else problem('EXTERNAL_VALUE_REQUIRES_REVIEW');
    } else publish();
  });
  function prepare(): FieldPrepareResult {
    if (disposed || e.getSnapshot().disposed) return blocked('DISPOSED');
    const h = host.getSnapshot(),
      s = e.getSnapshot(),
      surface = safeSurface();
    if (h.lifecycle !== 'active') return blocked('HOST_SUSPENDED');
    if (!contextCurrent(h)) return blocked('HOST_CONTEXT_CHANGED');
    if (pending) return blocked('DELIVERY_PENDING');
    if (s.composing) return blocked('COMPOSITION_ACTIVE');
    if (!surface) return blocked('SURFACE_STATUS_UNAVAILABLE');
    if (surface.pending || !['ready', 'readOnly'].includes(surface.phase))
      return blocked('SURFACE_DRAFT_PENDING');
    if (!equal(h.parent, baseline.parent) && !isEcho(h))
      return blocked('EXTERNAL_VALUE_REQUIRES_REVIEW');
    const witness = codec.encode(s.document);
    if (witness.status === 'rejected') return blocked(...witness.diagnostics);
    const reference = host.captureFence();
    if (!host.isFenceCurrent(reference)) return blocked('STALE_HOST_FENCE');
    const field = freeze({
      fieldBindingId: h.fieldBindingId,
      bindingEpoch: h.bindingEpoch,
      child: child(e),
      historyGroupId: s.historyGroupId,
      canonicalHtml: witness.canonicalHtml,
      profile: codec.profile,
      parent: copy(h.parent),
      capturedHostFenceRef: reference,
    }) as PreparedField;
    prepared.set(field, s.token);
    return { status: 'ready', field };
  }
  function settle(
    edit: HostFieldEdit,
    base: HostFieldSnapshot,
    ack: HostFieldAck,
  ): FieldDeliveryResult {
    if (disposed) return blocked('DISPOSED');
    if (!pending || pending.edit !== edit) return blocked('STALE_DELIVERY');
    const current = host.getSnapshot();
    if (
      !contextCurrent(current) ||
      current.lifecycle !== 'active' ||
      !host.isContextCurrent(edit.capturedHostFenceRef)
    ) {
      problem('HOST_CONTEXT_CHANGED');
      return blocked('HOST_CONTEXT_CHANGED');
    }
    if (child(e).sessionId !== edit.child.sessionId) {
      problem('STALE_CHILD_SESSION');
      return blocked('STALE_CHILD_SESSION');
    }
    if (
      ack.requestId !== edit.requestId ||
      ack.fieldBindingId !== base.fieldBindingId ||
      ack.bindingEpoch !== base.bindingEpoch ||
      !equal(ack.acceptedChildToken, edit.child) ||
      !Array.isArray(ack.diagnostics) ||
      ack.diagnostics.some((d) => typeof d !== 'string')
    ) {
      problem('INVALID_FIELD_ACK', 'rejected');
      return blocked('INVALID_FIELD_ACK');
    }
    if (ack.status !== 'committed' && ack.status !== 'noChange') {
      problem(
        ack.diagnostics[0] ?? 'FIELD_EDIT_REJECTED',
        ack.status === 'stale' ? 'stale' : 'rejected',
      );
      return blocked(...(ack.diagnostics.length ? ack.diagnostics : ['FIELD_EDIT_REJECTED']));
    }
    if (
      ack.exactAcceptedHtml !== edit.canonicalHtml ||
      !parentStep(base.parent, ack.actualParentToken, ack.status)
    ) {
      problem('FIELD_ACK_WITNESS_MISMATCH', 'rejected');
      return blocked('FIELD_ACK_WITNESS_MISMATCH');
    }
    if (
      current.parent.kind !== ack.actualParentToken.kind ||
      (current.parent.kind === 'builder' &&
        ack.actualParentToken.kind === 'builder' &&
        current.parent.sessionId !== ack.actualParentToken.sessionId) ||
      parentNumber(current.parent) < parentNumber(ack.actualParentToken)
    ) {
      problem('FIELD_ACK_PARENT_MISMATCH', 'rejected');
      return blocked('FIELD_ACK_PARENT_MISMATCH');
    }
    if (
      acceptedChild.sessionId !== edit.child.sessionId ||
      edit.child.revision < acceptedChild.revision
    ) {
      problem('OLD_FIELD_ACK');
      return blocked('OLD_FIELD_ACK');
    }
    echoes.set(edit.requestId, { edit, parent: ack.actualParentToken });
    while (echoes.size > limit) echoes.delete(echoes.keys().next().value!);
    acceptedHtml = edit.canonicalHtml;
    acceptedChild = edit.child;
    baseline = freeze({ ...base, parent: copy(ack.actualParentToken), html: acceptedHtml });
    delivery =
      equal(current.parent, ack.actualParentToken) && current.html === acceptedHtml
        ? 'synchronized'
        : 'stale';
    diagnostics = delivery === 'stale' ? ['PARENT_ADVANCED_AFTER_ACK'] : [];
    return freeze({ status: 'delivered', ack });
  }
  const binding: EngineFieldBinding = {
    getStatus: () => {
      publish();
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    captureHostFence() {
      const reference = host.captureFence();
      return Object.freeze({
        reference,
        isCurrent: (r: string) =>
          !disposed && contextCurrent(host.getSnapshot()) && host.isFenceCurrent(r),
      });
    },
    prepareField: prepare,
    isPreparedCurrent(field) {
      const token = prepared.get(field),
        s = e.getSnapshot(),
        h = host.getSnapshot(),
        surface = safeSurface();
      return (
        !disposed &&
        !!token &&
        token === s.token &&
        !s.composing &&
        !s.disposed &&
        !pending &&
        !!surface &&
        !surface.pending &&
        ['ready', 'readOnly'].includes(surface.phase) &&
        h.lifecycle === 'active' &&
        contextCurrent(h) &&
        host.isFenceCurrent(field.capturedHostFenceRef) &&
        equal(h.parent, field.parent)
      );
    },
    stagePreparedField(field) {
      if (busy || pending) return blocked('DELIVERY_PENDING');
      if (!binding.isPreparedCurrent(field)) return blocked('STALE_PREPARATION');
      const expected = prepared.get(field)!,
        base = freeze(copy(host.getSnapshot()));
      const contextFence: HostFence = {
        reference: field.capturedHostFenceRef,
        isCurrent: (r) =>
          !disposed && contextCurrent(host.getSnapshot()) && host.isContextCurrent(r),
      };
      const releaseContext = holdContext(field.capturedHostFenceRef);
      if (!releaseContext) return blocked('CONTEXT_RETENTION_UNAVAILABLE');
      const captured = e.captureCheckpoint({ expected, fence: contextFence });
      if (captured.status === 'rejected') {
        releaseContext();
        return blocked(...captured.diagnostics.map((d) => d.code));
      }
      const checkpoint = captured.checkpoint;
      const edit = freeze({
        requestId: `${field.fieldBindingId}:${field.bindingEpoch}:${e.getSnapshot().engineInstanceId}:${++sequence}`,
        capturedHostFenceRef: field.capturedHostFenceRef,
        child: field.child,
        canonicalHtml: field.canonicalHtml,
        profile: field.profile,
      });
      const previousDelivery = delivery,
        previousDiagnostics = diagnostics;
      let ended = false,
        delivered = false,
        saved = false,
        released = false;
      prepared.delete(field);
      pending = { edit, base };
      busy = true;
      delivery = 'pending';
      diagnostics = [];
      publish();
      const localCurrent = () =>
        !disposed &&
        !e.getSnapshot().disposed &&
        e.getSnapshot().token === expected &&
        !e.getSnapshot().composing &&
        contextCurrent(host.getSnapshot()) &&
        host.getSnapshot().lifecycle === 'active' &&
        host.isContextCurrent(edit.capturedHostFenceRef) &&
        (() => {
          const s = safeSurface();
          return !!s && !s.pending && ['ready', 'readOnly'].includes(s.phase);
        })();
      const finish = () => {
        if (pending?.edit === edit) {
          pending = null;
          busy = false;
          if (!disposed) observeUnchangedField(host.getSnapshot());
          publish();
        }
      };
      const stage: StagedFieldDelivery = {
        edit,
        checkpointId: checkpoint.id,
        isCurrent: () =>
          !ended &&
          pending?.edit === edit &&
          localCurrent() &&
          host.isFenceCurrent(edit.capturedHostFenceRef) &&
          equal(host.getSnapshot().parent, field.parent),
        withReadBarrier(read) {
          if (!stage.isCurrent())
            return { status: 'rejected', diagnostics: [{ code: 'STALE_PREPARATION' }] };
          return e.withReadBarrier({ expected, fence: contextFence }, () => {
            if (!stage.isCurrent()) throw Error('STALE_PREPARATION');
            const value = read();
            if (!localCurrent()) throw Error('STALE_CAPTURE_CONTEXT');
            return value;
          });
        },
        accept(ack) {
          if (ended) return blocked('STAGED_DELIVERY_ENDED');
          ended = true;
          try {
            const result = settle(edit, base, freeze(copy(ack)));
            delivered = result.status === 'delivered';
            return result;
          } catch {
            problem('INVALID_FIELD_ACK', 'rejected');
            return blocked('INVALID_FIELD_ACK');
          } finally {
            finish();
          }
        },
        cancel() {
          if (ended) return;
          ended = true;
          if (pending?.edit === edit) {
            delivery = previousDelivery;
            diagnostics = previousDiagnostics;
          }
          finish();
          stage.releaseCheckpoint();
        },
        acknowledgeSavedCheckpoint() {
          if (
            !delivered ||
            released ||
            disposed ||
            e.getSnapshot().disposed ||
            e.getSnapshot().token.sessionId !== checkpoint.token.sessionId ||
            !contextFence.isCurrent(contextFence.reference)
          )
            return { status: 'rejected', diagnostics: [{ code: 'SAVE_CHECKPOINT_UNAVAILABLE' }] };
          if (saved) return { status: 'noChange', snapshot: e.getSnapshot() };
          const result = e.acknowledgeCheckpoint(checkpoint, {
            expected: e.getSnapshot().token,
            fence: contextFence,
          });
          if (result.status !== 'rejected') saved = true;
          return result;
        },
        releaseCheckpoint() {
          if (released) return;
          released = true;
          e.releaseCheckpoint(checkpoint);
          releaseContext();
        },
      };
      return freeze({ status: 'staged', stage: Object.freeze(stage) });
    },
    async flush({ groupHistory = false } = {}) {
      if (typeof groupHistory !== 'boolean') return blocked('INVALID_HISTORY_MODE');
      if (busy || pending) return blocked('DELIVERY_PENDING');
      const result = prepare();
      if (result.status === 'blocked') return result;
      if (!binding.isPreparedCurrent(result.field)) return blocked('STALE_PREPARATION');
      const f = result.field,
        base = freeze(copy(host.getSnapshot()));
      const releaseContext = holdContext(f.capturedHostFenceRef);
      if (!releaseContext) return blocked('CONTEXT_RETENTION_UNAVAILABLE');
      if (!binding.isPreparedCurrent(f)) {
        releaseContext();
        return blocked('STALE_PREPARATION');
      }
      const historyGroupId = groupHistory ? f.historyGroupId : null;
      const edit = freeze({
        requestId: `${f.fieldBindingId}:${f.bindingEpoch}:${e.getSnapshot().engineInstanceId}:${++sequence}`,
        capturedHostFenceRef: f.capturedHostFenceRef,
        child: f.child,
        canonicalHtml: f.canonicalHtml,
        ...(historyGroupId ? { historyGroupId } : {}),
        profile: f.profile,
      });
      pending = { edit, base };
      busy = true;
      delivery = 'pending';
      diagnostics = [];
      publish();
      try {
        const ack = freeze(copy(await host.submitFieldEdit(edit)));
        return settle(edit, base, ack);
      } catch {
        problem('HOST_SUBMISSION_FAILED', 'rejected');
        return blocked('HOST_SUBMISSION_FAILED');
      } finally {
        releaseContext();
        pending = null;
        busy = false;
        if (!disposed) observeUnchangedField(host.getSnapshot());
        publish();
      }
    },
    acceptExternalValue({ discardLocal = false } = {}) {
      const reject = (...d: string[]) => freeze({ status: 'rejected' as const, diagnostics: d });
      if (disposed) return reject('DISPOSED');
      const h = host.getSnapshot(),
        s = e.getSnapshot(),
        surface = safeSurface();
      if (!contextCurrent(h) || h.lifecycle !== 'active') return reject('HOST_CONTEXT_CHANGED');
      if (h.origin === 'echo')
        return isEcho(h)
          ? freeze({ status: 'accepted', diagnostics: [] })
          : reject('UNRECOGNIZED_HOST_ECHO');
      if (pending || s.composing || !surface || surface.pending)
        return reject('LOCAL_CANDIDATE_PENDING');
      publish();
      if (status.localDirty && !discardLocal) return reject('LOCAL_CANDIDATE_REQUIRES_REVIEW');
      const decoded = codec.decode(h.html);
      if (decoded.status === 'rejected') return reject(...decoded.diagnostics);
      const reference = host.captureFence();
      const outcome = e.loadExternal(decoded.document, 'unsaved', {
        expected: s.token,
        fence: { reference, isCurrent: (r) => host.isFenceCurrent(r) },
      });
      if (outcome.status === 'rejected') return reject(...outcome.diagnostics.map((d) => d.code));
      baseline = freeze(copy(h));
      acceptedHtml = h.html;
      acceptedChild = child(e);
      echoes.clear();
      delivery = 'synchronized';
      diagnostics = [];
      publish();
      return freeze({ status: 'accepted', diagnostics: [] });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      pending = null;
      acceptedHtml = '';
      echoes.clear();
      diagnostics = [];
      delivery = 'stale';
      baseline = freeze({ ...baseline, html: '', lifecycle: 'disposed' });
      offEngine();
      offHost();
      for (const release of [...contextHolds]) release();
      if (!e.getSnapshot().disposed) {
        const result = e.dispose();
        // An owner may revoke from the controller's own Save/dispatch observer.
        // Drain terminal cleanup once the synchronous controller lock has exited.
        if (result.status === 'rejected')
          void Promise.resolve().then(() => {
            if (!e.getSnapshot().disposed) e.dispose();
          });
      }
      publish();
      listeners.clear();
    },
  };
  publish();
  return Object.freeze(binding);
}
