import type { EngineContentCodec } from '@inkforge/editor-html/engine';
import type {
  HostFieldAck,
  HostFieldEdit,
  HostFieldSnapshot,
  PublicHostFieldPort,
} from './host.js';

export interface StandaloneHostField extends PublicHostFieldPort {
  replace(
    html: string,
    origin: 'ownerLoad' | 'parentUndo' | 'parentRedo' | 'conflictResolution',
  ): boolean;
  suspend(): void;
  resume(interactionContextKey: string): void;
  dispose(): void;
}
/** RAM-only host delivery. This host never persists data or acknowledges an engine Save checkpoint. */
export function createStandaloneHostField(
  options: Readonly<{
    fieldBindingId: string;
    interactionContextKey: string;
    html: string;
    codec: EngineContentCodec;
    /** Current host-owned authorization/context guard, evaluated before the actual mutation. */
    isAuthorized: () => boolean;
    maxRequestRecords?: number;
  }>,
): StandaloneHostField {
  const { codec } = options,
    limit = options.maxRequestRecords ?? 64;
  if (
    !options.fieldBindingId ||
    !options.interactionContextKey ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1024 ||
    codec.decode(options.html).status !== 'accepted'
  )
    throw Error('INVALID_STANDALONE_HOST');
  let snapshot: HostFieldSnapshot = Object.freeze({
    fieldBindingId: options.fieldBindingId,
    bindingEpoch: 1,
    lifecycle: 'active',
    interactionContextKey: options.interactionContextKey,
    parent: Object.freeze({ kind: 'standalone', hostValueGeneration: 0 }),
    html: options.html,
    profile: codec.profile,
    origin: 'ownerLoad',
  });
  let fenceCounter = 0;
  const listeners = new Set<() => void>(),
    fences = new Map<string, HostFieldSnapshot>();
  const records = new Map<string, { payload: string; ack: HostFieldAck }>();
  const authorized = () => {
    try {
      return options.isAuthorized() === true;
    } catch {
      return false;
    }
  };
  function emit() {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* Observation does not roll back an accepted value. */
      }
    }
  }
  const result = (
    edit: HostFieldEdit,
    status: HostFieldAck['status'],
    diagnostics: string[],
  ): HostFieldAck =>
    Object.freeze({
      requestId: edit.requestId,
      fieldBindingId: snapshot.fieldBindingId,
      bindingEpoch: snapshot.bindingEpoch,
      acceptedChildToken: Object.freeze({ ...edit.child }),
      diagnostics: Object.freeze(diagnostics),
      status,
      actualParentToken: snapshot.parent,
      ...(status === 'committed' || status === 'noChange'
        ? { exactAcceptedHtml: edit.canonicalHtml }
        : {}),
    }) as HostFieldAck;
  const port: StandaloneHostField = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    captureFence() {
      const id = `standalone:${options.fieldBindingId}:${++fenceCounter}`;
      fences.set(id, snapshot);
      while (fences.size > limit) fences.delete(fences.keys().next().value!);
      return id;
    },
    isContextCurrent(reference) {
      const captured = fences.get(reference);
      return (
        !!captured &&
        snapshot.lifecycle === 'active' &&
        authorized() &&
        captured.bindingEpoch === snapshot.bindingEpoch &&
        captured.interactionContextKey === snapshot.interactionContextKey
      );
    },
    isFenceCurrent(reference) {
      const captured = fences.get(reference);
      return (
        !!captured &&
        port.isContextCurrent(reference) &&
        JSON.stringify(captured.parent) === JSON.stringify(snapshot.parent)
      );
    },
    async submitFieldEdit(edit) {
      const payload = JSON.stringify(edit),
        prior = records.get(edit.requestId);
      if (snapshot.lifecycle === 'disposed') return result(edit, 'disposed', ['DISPOSED']);
      if (prior)
        return prior.payload === payload
          ? prior.ack
          : result(edit, 'rejected', ['REQUEST_ID_REUSED']);
      let ack: HostFieldAck;
      if (!port.isFenceCurrent(edit.capturedHostFenceRef))
        ack = result(edit, 'stale', ['STALE_HOST_FENCE']);
      else if (
        !edit.requestId ||
        !edit.child?.sessionId ||
        !Number.isSafeInteger(edit.child.revision) ||
        edit.child.revision < 0 ||
        JSON.stringify(edit.profile) !== JSON.stringify(codec.profile) ||
        codec.decode(edit.canonicalHtml).status !== 'accepted'
      )
        ack = result(edit, 'rejected', ['INVALID_FIELD_WITNESS']);
      else if (!port.isFenceCurrent(edit.capturedHostFenceRef))
        ack = result(edit, 'stale', ['STALE_HOST_FENCE']);
      else {
        const changed = edit.canonicalHtml !== snapshot.html;
        const parent = Object.freeze({
          kind: 'standalone' as const,
          hostValueGeneration:
            (snapshot.parent.kind === 'standalone' ? snapshot.parent.hostValueGeneration : 0) +
            (changed ? 1 : 0),
        });
        snapshot = Object.freeze({
          ...snapshot,
          parent,
          html: edit.canonicalHtml,
          origin: 'echo',
          acceptedRequestId: edit.requestId,
          acceptedChildToken: Object.freeze({ ...edit.child }),
        });
        ack = result(edit, changed ? 'committed' : 'noChange', []);
        records.set(edit.requestId, { payload, ack });
        while (records.size > limit) records.delete(records.keys().next().value!);
        emit();
        return ack;
      }
      records.set(edit.requestId, { payload, ack });
      while (records.size > limit) records.delete(records.keys().next().value!);
      return ack;
    },
    replace(html, origin) {
      if (
        snapshot.lifecycle !== 'active' ||
        !authorized() ||
        codec.decode(html).status !== 'accepted'
      )
        return false;
      const { acceptedRequestId: _r, acceptedChildToken: _c, ...base } = snapshot;
      snapshot = Object.freeze({
        ...base,
        html,
        origin,
        parent: Object.freeze({
          kind: 'standalone',
          hostValueGeneration:
            (snapshot.parent.kind === 'standalone' ? snapshot.parent.hostValueGeneration : 0) + 1,
        }),
      });
      fences.clear();
      emit();
      return true;
    },
    suspend() {
      if (snapshot.lifecycle !== 'active') return;
      snapshot = Object.freeze({ ...snapshot, lifecycle: 'suspended' });
      fences.clear();
      emit();
    },
    resume(interactionContextKey) {
      if (snapshot.lifecycle !== 'suspended' || !interactionContextKey || !authorized()) return;
      snapshot = Object.freeze({
        ...snapshot,
        lifecycle: 'active',
        interactionContextKey,
        bindingEpoch: snapshot.bindingEpoch + 1,
      });
      records.clear();
      fences.clear();
      emit();
    },
    dispose() {
      if (snapshot.lifecycle === 'disposed') return;
      snapshot = Object.freeze({ ...snapshot, lifecycle: 'disposed', html: '' });
      fences.clear();
      records.clear();
      emit();
      listeners.clear();
    },
  };
  return Object.freeze(port);
}
