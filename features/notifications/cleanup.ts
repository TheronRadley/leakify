/**
 * Scope-aware notification cleanup — pure module, no expo-notifications import.
 *
 * Why this exists: the OS schedule and Leakify's own bookkeeping
 * (`ScheduledNotification` records) are two different stores. Deleting local
 * data used to drop the bookkeeping first, which left OS reminders firing for
 * data that no longer existed. This module encodes the one rule that matters:
 *
 *   every recorded notification ID of the active scope is handed to the OS
 *   cancellation adapter BEFORE the bookkeeping for that scope is cleared.
 *
 * Cancellation is best-effort per ID (a reminder may already have fired or
 * never have existed), but the *attempt* is deterministic — that is what makes
 * deletion and demo-reset reproducible. Only the caller's scope is touched, so
 * other Leakify profiles on the same device keep their reminders.
 */
import type { ScheduledNotification } from '@/types';

/** Minimal OS surface needed for cleanup; implemented by the expo adapter. */
export interface NotificationCanceller {
  /** Cancel one scheduled notification by its OS id. Reject when it fails. */
  cancel(osNotificationId: string): Promise<void>;
}

export interface CleanupOptions {
  /**
   * Clears the persisted bookkeeping for the scope. Called only after every
   * cancellation attempt has finished, so a crash mid-cleanup never loses the
   * IDs we still needed to cancel.
   */
  clearBookkeeping: () => Promise<void>;
}

export interface CleanupOutcome {
  /** Distinct OS ids in the scope that we tried to cancel. */
  attempted: number;
  /** OS cancellations that the platform acknowledged. */
  canceled: number;
  /** OS ids whose cancellation failed (already fired / unknown / platform error). */
  failedOsIds: string[];
  /** True when the scope's bookkeeping was cleared. */
  cleared: boolean;
  /** True when nothing needed doing (no records recorded for the scope). */
  noop: boolean;
}

/**
 * Cancel every notification recorded for one scope, then clear that scope's
 * bookkeeping.
 *
 * Guarantees:
 * - Deduplicates OS ids (one cancel call per id, even if records repeat).
 * - Ignores empty/invalid ids and records already marked `canceled`.
 * - A failing cancellation never blocks the remaining ids, and never blocks
 *   clearing bookkeeping (otherwise a stale id could permanently wedge reset).
 * - If `clearBookkeeping` itself throws, `cleared` is false and the caller can
 *   retry safely: re-cancelling an already-cancelled id is a harmless no-op.
 */
export async function cancelScopeNotifications(
  records: readonly ScheduledNotification[],
  canceller: NotificationCanceller,
  options: CleanupOptions,
): Promise<CleanupOutcome> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const id = record?.osNotificationId;
    if (typeof id !== 'string' || id.length === 0) continue;
    if (record.status === 'canceled') continue;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0) {
    // Nothing was ever recorded for this scope — still clear bookkeeping so a
    // half-written list cannot survive a reset, but report it as a no-op.
    await options.clearBookkeeping();
    return { attempted: 0, canceled: 0, failedOsIds: [], cleared: true, noop: true };
  }

  let canceled = 0;
  const failedOsIds: string[] = [];
  for (const id of ids) {
    try {
      await canceller.cancel(id);
      canceled += 1;
    } catch {
      failedOsIds.push(id);
    }
  }

  await options.clearBookkeeping();
  return { attempted: ids.length, canceled, failedOsIds, cleared: true, noop: false };
}

/**
 * IDs the engine still expects to be live for a set of desired plans. Used by
 * tests/diagnostics to assert that a cleared scope really has nothing scheduled
 * for its own data.
 */
export function orphanedOsIds(records: readonly ScheduledNotification[], desiredKeys: ReadonlySet<string>): string[] {
  return records
    .filter((r) => r.status === 'scheduled' && !desiredKeys.has(r.key))
    .map((r) => r.osNotificationId);
}
