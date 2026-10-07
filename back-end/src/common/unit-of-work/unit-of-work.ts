import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

/**
 * Runs a synchronous operation across several in-memory repositories so that
 * either every write lands or none does.
 *
 * Before an operation starts, each participating repository's state (records,
 * counters, idempotency sets) is deep-copied. If the operation throws, every
 * participant is restored and the error is rethrown unchanged.
 *
 * Rules for callers:
 *  - Validate first, then write. Do not await inside `work`; it must be
 *    synchronous, or the snapshot would not cover what happens after the await.
 *  - Send notifications and other side effects after `run` returns, so a
 *    notification failure can never undo a settled payment.
 *
 * This gives consistency within one process. It adds no restart durability.
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * @param participants Repository classes the operation may write to. They
   *   are resolved across all modules, so callers need not import their modules.
   */
  run<T>(participants: Type<object>[], work: () => T): T {
    const stores = participants.map((type) =>
      this.moduleRef.get(type, { strict: false }),
    );
    return runAtomically(stores, work);
  }
}

/** The framework-free core of {@link UnitOfWork}, usable with plain objects. */
export function runAtomically<T>(stores: object[], work: () => T): T {
  const saved = stores.map((store) => ({ store, state: snapshot(store) }));
  try {
    const result = work();
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      throw new Error(
        'UnitOfWork operations must be synchronous; do not return a promise.',
      );
    }
    return result;
  } catch (error) {
    for (const { store, state } of saved.reverse()) Object.assign(store, state);
    throw error;
  }
}

/** Deep copy of a repository's own fields. Repositories hold plain data only. */
function snapshot(store: object): Record<string, unknown> {
  return structuredClone({ ...store });
}
