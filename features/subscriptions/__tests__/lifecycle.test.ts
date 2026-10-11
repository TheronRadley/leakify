/**
 * Lifecycle ordering tests: cancellation must be handed to the platform before
 * any storage bookkeeping is destroyed, failures must be visible, and a demo
 * reset must never re-seed on top of a half-deleted scope.
 *
 * These run against the real local repositories (AsyncStorage is mocked) so the
 * ordering claim covers actual storage code, not just fakes.
 */
import {
  cancelScopeNotifications,
  type NotificationCanceller,
} from '@/features/notifications/cleanup';
import { runScopedWipe } from '@/features/subscriptions/lifecycle';
import {
  LocalProfileRepository,
  LocalScheduledNotificationRepository,
  LocalSubscriptionRepository,
} from '@/services/local-repository';
import { storageKeys } from '@/services/local-storage';
import type { ScheduledNotification } from '@/types';

const mockMemory = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => void mockMemory.set(key, value),
  removeItem: async (key: string) => void mockMemory.delete(key),
  getAllKeys: async () => [...mockMemory.keys()],
  multiRemove: async (keys: string[]) => keys.forEach((k) => mockMemory.delete(k)),
}));

beforeEach(() => mockMemory.clear());

function scheduled(overrides: Partial<ScheduledNotification> = {}): ScheduledNotification {
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

describe('runScopedWipe — local scope', () => {
  it('cancels recorded reminders before the bookkeeping key is deleted', async () => {
    const scope = 'local-user';
    const schedRepo = new LocalScheduledNotificationRepository(scope);
    const profileRepo = new LocalProfileRepository(scope);
    await schedRepo.saveAll([scheduled(), scheduled({ key: 'k2', osNotificationId: 'os-2' })]);

    const order: string[] = [];
    const canceller: NotificationCanceller = {
      cancel: async (id) => void order.push(`cancel:${id}`),
    };

    const result = await runScopedWipe({
      cancelScheduled: async () => {
        const records = await schedRepo.list();
        order.push('list');
        return cancelScopeNotifications(records, canceller, {
          clearBookkeeping: async () => {
            order.push('clear');
            await schedRepo.saveAll([]);
          },
        });
      },
      deleteAccountData: async () => {
        order.push('deleteAccountData');
        await profileRepo.deleteAccountData();
      },
    });

    expect(order).toEqual(['list', 'cancel:os-1', 'cancel:os-2', 'clear', 'deleteAccountData']);
    expect(result).toMatchObject({ notificationsAttempted: 2, notificationsFailed: 0, dataDeleted: true });

    // Nothing survives for the wiped scope: bookkeeping and data are both gone.
    await expect(schedRepo.list()).resolves.toEqual([]);
    await expect(mockMemory.has(storageKeys.scheduledNotifications(scope))).toBe(false);
  });

  it('still deletes data when the platform rejects a stale notification id', async () => {
    const scope = 'local-user';
    const schedRepo = new LocalScheduledNotificationRepository(scope);
    await schedRepo.saveAll([scheduled({ osNotificationId: 'stale-id' })]);

    const result = await runScopedWipe({
      cancelScheduled: async () =>
        cancelScopeNotifications(await schedRepo.list(), {
          cancel: async () => {
            throw new Error('already fired');
          },
        }, { clearBookkeeping: () => schedRepo.saveAll([]) }),
      deleteAccountData: async () => new LocalProfileRepository(scope).deleteAccountData(),
    });

    expect(result).toMatchObject({ notificationsAttempted: 1, notificationsFailed: 1, dataDeleted: true });
  });

  it('reports a partial deletion instead of claiming success', async () => {
    const scope = 'local-user';
    const schedRepo = new LocalScheduledNotificationRepository(scope);
    const subs = new LocalSubscriptionRepository(scope);
    await subs.create({
      name: 'Spotify',
      provider: null,
      category: 'music',
      amountCents: 999,
      currency: 'USD',
      interval: { every: 1, unit: 'month' },
      startDate: '2026-01-01',
      nextBillingDate: '2026-02-01',
      trialEndDate: null,
      status: 'active',
      paymentMethodLabel: null,
      cancellationUrl: null,
      cancellationNotes: null,
      notes: null,
      reminders: { enabled: true, renewalLeadDays: [3], trialLeadDays: [1] },
      flaggedUnused: false,
      isCancelCandidate: false,
    });
    await schedRepo.saveAll([scheduled()]);
    let canceled = 0;

    const result = await runScopedWipe({
      cancelScheduled: async () =>
        cancelScopeNotifications(await schedRepo.list(), {
          cancel: async () => {
            canceled += 1;
          },
        }, { clearBookkeeping: () => schedRepo.saveAll([]) }),
      deleteAccountData: async () => {
        throw new Error('Network error. Check your connection and try again.');
      },
    });

    expect(canceled).toBe(1);
    expect(result.dataDeleted).toBe(false);
    expect(result.error).toContain('Network error');
    // The user's data must survive a failed delete so they can retry; only the
    // (idempotent) notification bookkeeping is gone.
    await expect(subs.list()).resolves.toHaveLength(1);
  });

  it('does not reseed when deletion failed', async () => {
    const reseed = jest.fn(async () => {});
    const result = await runScopedWipe({
      cancelScheduled: async () => ({ attempted: 0, canceled: 0, failedOsIds: [], cleared: true, noop: true }),
      deleteAccountData: async () => {
        throw new Error('boom');
      },
      reseed,
    });

    expect(reseed).not.toHaveBeenCalled();
    expect(result.reseeded).toBe(false);
  });

  it('demo reset cancels, deletes then re-seeds so reminders are not duplicated', async () => {
    const scope = 'demo';
    const schedRepo = new LocalScheduledNotificationRepository(scope);
    const subs = new LocalSubscriptionRepository(scope);
    await subs.create({
      name: 'Netflix',
      provider: 'Netflix',
      category: 'streaming',
      amountCents: 1549,
      currency: 'USD',
      interval: { every: 1, unit: 'month' },
      startDate: '2026-01-01',
      nextBillingDate: '2026-02-01',
      trialEndDate: null,
      status: 'active',
      paymentMethodLabel: null,
      cancellationUrl: null,
      cancellationNotes: null,
      notes: null,
      reminders: { enabled: true, renewalLeadDays: [3], trialLeadDays: [1] },
      flaggedUnused: false,
      isCancelCandidate: false,
    });
    await schedRepo.saveAll([scheduled()]);

    const order: string[] = [];
    const result = await runScopedWipe({
      cancelScheduled: async () => {
        order.push('cancel');
        return cancelScopeNotifications(await schedRepo.list(), {
          cancel: async () => {},
        }, { clearBookkeeping: () => schedRepo.saveAll([]) });
      },
      deleteAccountData: async () => {
        order.push('delete');
        await new LocalProfileRepository(scope).deleteAccountData();
      },
      reseed: async () => {
        order.push('reseed');
        // Seeding happens after the wipe, so a fresh schedule starts from empty.
      },
    });

    expect(order).toEqual(['cancel', 'delete', 'reseed']);
    expect(result.reseeded).toBe(true);
    await expect(subs.list()).resolves.toEqual([]);
  });
});
