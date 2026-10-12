/**
 * Regression coverage for the notification/data-deletion ordering (audit N-01).
 *
 * The bug this pins down: `deleteAccountData` removed the scheduled-notification
 * bookkeeping, so the next sync saw an empty list, cancelled nothing, and the
 * OS kept firing reminders for subscriptions that no longer existed — with
 * their names and amounts. The fix is ordering, so the tests assert ordering.
 */
import {
  deleteAllAccountData,
  getDataState,
  initializeStore,
  resetDemoData,
} from '@/features/subscriptions/store';
import { cancelAllScheduled } from '@/features/notifications/service';
import type { NotificationSettings } from '@/types';

interface CallLog {
  entries: string[];
  reset: () => void;
}

// The factory runs before the test body, so the log lives on globalThis and is
// created by the mock itself.
const log = (): CallLog => (globalThis as unknown as { __storeCallLog: CallLog }).__storeCallLog;

jest.mock('@/features/notifications/service', () => {
  const g = globalThis as unknown as { __storeCallLog?: CallLog };
  if (!g.__storeCallLog) g.__storeCallLog = { entries: [], reset() { this.entries = []; } };
  return {
    cancelAllScheduled: jest.fn(async (repository: unknown) => {
      g.__storeCallLog!.entries.push(`cancelAllScheduled:${(repository as { tag?: string })?.tag}`);
    }),
  };
});

const DEFAULT_SETTINGS: NotificationSettings = {
  renewalLeadDays: [3, 1, 0],
  trialLeadDays: [1],
  weeklyDigestEnabled: false,
  genericLockScreenText: false,
  permissionStatus: 'unknown',
};

jest.mock('@/services', () => {
  const g = globalThis as unknown as {
    __storeCallLog?: CallLog;
    __deletionResult?: unknown;
  };
  if (!g.__storeCallLog) g.__storeCallLog = { entries: [], reset() { this.entries = []; } };
  const push = (name: string) => g.__storeCallLog!.entries.push(name);

  const defaults: NotificationSettings = {
    renewalLeadDays: [3, 1, 0],
    trialLeadDays: [1],
    weeklyDigestEnabled: false,
    genericLockScreenText: false,
    permissionStatus: 'unknown',
  };

  return {
    createRepositories: (_mode: string, scope: string) => ({
      subscriptions: {
        list: async () => [],
        get: async () => null,
        create: async (input: object) => ({ id: 'demo-1', ...input }),
        update: async (id: string, patch: object) => ({ id, ...patch }),
        remove: async () => undefined,
        setStatus: async () => ({}),
        recordPayment: async () => ({}),
      },
      billingEvents: {
        listForSubscription: async () => [],
        listAll: async () => [],
      },
      profile: {
        get: async () => null,
        upsert: async () => ({}),
        deleteAccountData: async () => {
          push('profile.deleteAccountData');
          return g.__deletionResult ?? { rowsDeleted: true, accountDeleted: true };
        },
      },
      notificationSettings: {
        get: async () => defaults,
        update: async (patch: object) => ({ ...defaults, ...patch }),
      },
      scheduledNotifications: {
        tag: scope,
        list: async () => [],
        saveAll: async () => push('scheduledNotifications.saveAll'),
      },
    }),
  };
});

beforeEach(async () => {
  jest.clearAllMocks();
  log().reset();
  (globalThis as unknown as { __deletionResult?: unknown }).__deletionResult = undefined;
  await initializeStore('demo', 'demo', { seedDemo: false });
  log().reset();
});

describe('deleteAllAccountData', () => {
  it('cancels OS notifications BEFORE the bookkeeping is deleted', async () => {
    await deleteAllAccountData();

    const entries = log().entries;
    expect(entries).toContain('cancelAllScheduled:demo');
    expect(entries).toContain('profile.deleteAccountData');
    expect(entries.indexOf('cancelAllScheduled:demo')).toBeLessThan(
      entries.indexOf('profile.deleteAccountData'),
    );
  });

  it('cancels through the scope’s own scheduled-notification repository', async () => {
    await initializeStore('local', 'local-user');
    log().reset();

    await deleteAllAccountData();

    expect(cancelAllScheduled).toHaveBeenCalledTimes(1);
    expect(log().entries[0]).toBe('cancelAllScheduled:local-user');
  });

  it('returns the repository’s deletion result so the UI can report honestly', async () => {
    (globalThis as unknown as { __deletionResult?: unknown }).__deletionResult = {
      rowsDeleted: true,
      accountDeleted: false,
      warning: 'The sign-in account could not be removed.',
    };

    await expect(deleteAllAccountData()).resolves.toEqual({
      rowsDeleted: true,
      accountDeleted: false,
      warning: 'The sign-in account could not be removed.',
    });
  });

  it('clears in-memory state so deleted rows cannot linger on screen', async () => {
    await deleteAllAccountData();

    const state = getDataState();
    expect(state.subscriptions).toEqual([]);
    expect(state.profile).toBeNull();
    expect(state.notificationSettings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('resetDemoData', () => {
  it('cancels stale reminders before re-seeding, so a reset cannot duplicate them', async () => {
    await resetDemoData();

    const entries = log().entries;
    expect(entries).toContain('cancelAllScheduled:demo');
    expect(entries.indexOf('cancelAllScheduled:demo')).toBeLessThan(
      entries.indexOf('profile.deleteAccountData'),
    );
  });

  it('is a no-op outside demo mode', async () => {
    await initializeStore('local', 'local-user');
    log().reset();

    await resetDemoData();

    expect(log().entries).toEqual([]);
    expect(cancelAllScheduled).not.toHaveBeenCalled();
  });
});
