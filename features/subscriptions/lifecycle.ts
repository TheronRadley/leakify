/**
 * Destructive lifecycle orchestration (demo reset, account wipe).
 *
 * Pure module on purpose: the ordering rule below is the part that must never
 * regress, and it needs to be testable without expo-notifications or a device.
 *
 * Rule: OS reminders recorded for the scope are cancelled *before* the scope's
 * data (and its notification bookkeeping) is deleted. The reverse order leaves
 * reminders scheduled against data that no longer exists, and a demo reset that
 * re-seeds without cancelling first duplicates every reminder.
 */
import type { CleanupOutcome } from '@/features/notifications/cleanup';

export interface WipeResult {
  /** Distinct OS reminders we asked the platform to cancel for this scope. */
  notificationsAttempted: number;
  /** Cancellations the platform rejected (already fired / unknown id). */
  notificationsFailed: number;
  /** True only when the repository reported every delete as successful. */
  dataDeleted: boolean;
  /** True when the reseed step ran (demo reset only). */
  reseeded: boolean;
  /** User-safe reason for a partial failure; never contains stored values. */
  error?: string;
}

export interface WipeDependencies {
  /** Cancel every reminder recorded for the active scope and clear bookkeeping. */
  cancelScheduled(): Promise<CleanupOutcome>;
  /** Delete the scope's data (local scopes and/or cloud rows). */
  deleteAccountData(): Promise<void>;
  /** Optional post-delete step, e.g. re-seeding the demo account. */
  reseed?(): Promise<void>;
}

const EMPTY_CLEANUP: CleanupOutcome = {
  attempted: 0,
  canceled: 0,
  failedOsIds: [],
  cleared: true,
  noop: true,
};

/**
 * Cancel → delete → (reseed). A cancellation failure never blocks deletion: the
 * user asked for their data to go, and a stale OS id is not a reason to keep it.
 * A deletion failure stops the reseed so we cannot re-seed on top of a half
 * deleted dataset.
 */
export async function runScopedWipe(deps: WipeDependencies): Promise<WipeResult> {
  let cleanup = EMPTY_CLEANUP;
  try {
    cleanup = await deps.cancelScheduled();
  } catch {
    // Cancellation is best-effort; the wipe must still proceed.
  }

  try {
    await deps.deleteAccountData();
  } catch (err) {
    return {
      notificationsAttempted: cleanup.attempted,
      notificationsFailed: cleanup.failedOsIds.length,
      dataDeleted: false,
      reseeded: false,
      error: err instanceof Error && err.message ? err.message : 'Could not delete everything. Please try again.',
    };
  }

  let reseeded = false;
  if (deps.reseed) {
    await deps.reseed();
    reseeded = true;
  }

  return {
    notificationsAttempted: cleanup.attempted,
    notificationsFailed: cleanup.failedOsIds.length,
    dataDeleted: true,
    reseeded,
  };
}
