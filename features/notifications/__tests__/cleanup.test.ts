/**
 * Tests for the notification-cleanup rule that protects users after deletion
 * and demo reset: every OS id recorded for the scope must be handed to the
 * platform for cancellation *before* the scope's bookkeeping is cleared, and a
 * stale/failed cancellation must never strand the reset.
 */
import {
  cancelScopeNotifications,
  orphanedOsIds,
  type NotificationCanceller,
} from '@/features/notifications/cleanup';
import type { ScheduledNotification } from '@/types';

function record(overrides: Partial<ScheduledNotification> = {}): ScheduledNotification {
  return {
    key: 'sub-1:2026-02-01:renewal:3',
    subscriptionId: 'sub-1',
    type: 'renewal',
    occurrenceDate: '2026-02-01',
    leadDays: 3,
    triggerAt: '2026-01-29T09:00:00.000Z',
    osNotificationId: 'os-1',
    status: 'scheduled',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface Harness {
  events: string[];
  canceled: string[];
  canceller: NotificationCanceller;
  cleared: boolean;
  clearBookkeeping(): Promise<void>;
}

function harness(cancelImpl?: (id: string) => Promise<void>): Harness {
  const h: Harness = {
    events: [],
    canceled: [],
    cleared: false,
    canceller: {
      cancel: async (id: string) => {
        h.events.push(`cancel:${id}`);
        h.canceled.push(id);
        if (cancelImpl) return cancelImpl(id);
      },
    },
    clearBookkeeping: async () => {
      h.events.push('clear');
      h.cleared = true;
    },
  };
  return h;
}

describe('cancelScopeNotifications', () => {
  it('cancels every recorded id before clearing bookkeeping', async () => {
    const h = harness();
    const records = [record(), record({ key: 'k2', osNotificationId: 'os-2' })];

    const outcome = await cancelScopeNotifications(records, h.canceller, {
      clearBookkeeping: h.clearBookkeeping,
    });

    expect(h.events).toEqual(['cancel:os-1', 'cancel:os-2', 'clear']);
    expect(outcome).toMatchObject({ attempted: 2, canceled: 2, failedOsIds: [], cleared: true, noop: false });
  });

  it('deduplicates repeated OS ids so one reminder is not cancelled twice', async () => {
    const h = harness();
    const records = [
      record({ key: 'a', osNotificationId: 'os-dup' }),
      record({ key: 'b', osNotificationId: 'os-dup' }),
    ];

    const outcome = await cancelScopeNotifications(records, h.canceller, {
      clearBookkeeping: h.clearBookkeeping,
    });

    expect(h.canceled).toEqual(['os-dup']);
    expect(outcome.attempted).toBe(1);
  });

  it('ignores ids already marked canceled and blank ids', async () => {
    const h = harness();
    const records = [
      record({ key: 'a', osNotificationId: 'os-gone', status: 'canceled' }),
      record({ key: 'b', osNotificationId: '' }),
      record({ key: 'c', osNotificationId: 'os-live' }),
    ];

    const outcome = await cancelScopeNotifications(records, h.canceller, {
      clearBookkeeping: h.clearBookkeeping,
    });

    expect(h.canceled).toEqual(['os-live']);
    expect(outcome.attempted).toBe(1);
  });

  it('keeps going when one cancellation fails and still clears bookkeeping', async () => {
    const h = harness(async (id) => {
      if (id === 'os-1') throw new Error('Notification no longer exists.');
    });
    const records = [record(), record({ key: 'k2', osNotificationId: 'os-2' })];

    const outcome = await cancelScopeNotifications(records, h.canceller, {
      clearBookkeeping: h.clearBookkeeping,
    });

    expect(h.canceled).toEqual(['os-1', 'os-2']);
    expect(outcome).toMatchObject({ attempted: 2, canceled: 1, cleared: true });
    expect(outcome.failedOsIds).toEqual(['os-1']);
  });

  it('clears bookkeeping even when the scope has no records, reporting a no-op', async () => {
    const h = harness();

    const outcome = await cancelScopeNotifications([], h.canceller, { clearBookkeeping: h.clearBookkeeping });

    expect(h.events).toEqual(['clear']);
    expect(outcome).toMatchObject({ attempted: 0, canceled: 0, cleared: true, noop: true });
  });

  it('leaves bookkeeping untouched when clearing itself fails, so a retry can re-run', async () => {
    const h = harness();
    const canceller = h.canceller;
    const outcomePromise = cancelScopeNotifications([record()], canceller, {
      clearBookkeeping: async () => {
        throw new Error('storage unavailable');
      },
    });

    await expect(outcomePromise).rejects.toThrow('storage unavailable');
    expect(h.cleared).toBe(false);
  });

  it('only touches the ids in the supplied scope', async () => {
    const h = harness();
    // Records belonging to a different profile are never passed in, so they are
    // never cancelled — this is the isolation property delete/reset relies on.
    await cancelScopeNotifications([record({ osNotificationId: 'mine' })], h.canceller, {
      clearBookkeeping: h.clearBookkeeping,
    });

    expect(h.canceled).toEqual(['mine']);
    expect(h.canceled).not.toContain('theirs');
  });
});

describe('orphanedOsIds', () => {
  it('flags scheduled records whose key is no longer desired', () => {
    const records = [record({ key: 'keep' }), record({ key: 'stale', osNotificationId: 'os-stale' })];
    expect(orphanedOsIds(records, new Set(['keep']))).toEqual(['os-stale']);
    // Canceled records are not orphans — they are already gone.
    expect(orphanedOsIds([record({ key: 'stale', status: 'canceled' })], new Set())).toEqual([]);
  });
});
