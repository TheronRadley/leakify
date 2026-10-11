/**
 * Notification service: the only module that talks to expo-notifications.
 * Applies the pure engine's diff to the OS and persists bookkeeping so
 * re-syncs never duplicate reminders. All failure modes degrade gracefully
 * (web / Expo Go on Android / permission denied) and report status instead
 * of silently failing.
 */
import {
  computeDigestPlan,
  computeReminderPlans,
  diffScheduledNotifications,
  type DigestPlan,
  type ReminderPlan,
} from '@/features/notifications/engine';
import {
  cancelScopeNotifications,
  type CleanupOutcome,
  type NotificationCanceller,
} from '@/features/notifications/cleanup';
import type { ScheduledNotificationRepository } from '@/services/repository';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { NotificationSettings, ScheduledNotification, Subscription } from '@/types';

export type NotificationAvailability =
  | { available: true }
  | { available: false; reason: 'web' | 'unavailable' };

/** Local notifications are unavailable on web. */
export function checkAvailability(): NotificationAvailability {
  if (Platform.OS === 'web') return { available: false, reason: 'web' };
  return { available: true };
}

/** Configure foreground behavior once at app start. */
export function configureNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Current permission state without prompting. */
export async function getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (perms.granted) return 'granted';
    return perms.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/** Prompt for permission (call only with user context, e.g. onboarding/opt-in). */
export async function requestPermissions(): Promise<'granted' | 'denied'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Subscription reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const perms = await Notifications.requestPermissionsAsync();
    return perms.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export interface SyncResult {
  scheduled: number;
  canceled: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Reconcile desired reminders (from saved subscriptions + settings) with what
 * is actually scheduled on the OS. Idempotent: safe to call on every app
 * open and after every data mutation.
 */
export async function syncNotificationSchedule(
  subscriptions: Subscription[],
  settings: NotificationSettings,
  repository: ScheduledNotificationRepository,
): Promise<SyncResult> {
  if (checkAvailability().available !== true) {
    return { scheduled: 0, canceled: 0, skipped: true, reason: 'Notifications are not available on this platform.' };
  }
  const permission = await getPermissionStatus();
  if (permission !== 'granted') {
    return { scheduled: 0, canceled: 0, skipped: true, reason: 'Notification permission is not granted.' };
  }

  try {
    // The user's privacy choice decides what a lock screen can read.
    const engineOptions = { previewMode: settings.previewMode ?? 'generic' } as const;
    const plans: (ReminderPlan | DigestPlan)[] = computeReminderPlans(subscriptions, engineOptions);
    if (settings.weeklyDigestEnabled) {
      const digest = computeDigestPlan(subscriptions);
      if (digest) plans.push(digest);
    }

    const existing = await repository.list();
    const { toSchedule, toCancel } = diffScheduledNotifications(plans, existing);

    for (const record of toCancel) {
      try {
        await Notifications.cancelScheduledNotificationAsync(record.osNotificationId);
      } catch {
        // Already fired or gone on the OS — bookkeeping cleanup continues.
      }
    }

    const now = new Date().toISOString();
    const fresh: ScheduledNotification[] = [];
    for (const plan of toSchedule) {
      const triggerDate = new Date(plan.triggerAt);
      if (Number.isNaN(triggerDate.getTime()) || triggerDate.getTime() <= Date.now()) continue;
      try {
        const osNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: plan.title,
            body: plan.body,
            data: {
              subscriptionId: 'subscriptionId' in plan ? plan.subscriptionId : null,
              type: plan.type,
              occurrenceDate: 'occurrenceDate' in plan ? plan.occurrenceDate : null,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: Platform.OS === 'android' ? 'reminders' : undefined,
          },
        });
        fresh.push({
          key: plan.key,
          subscriptionId: 'subscriptionId' in plan ? plan.subscriptionId : null,
          type: plan.type,
          occurrenceDate: 'occurrenceDate' in plan ? plan.occurrenceDate : '',
          leadDays: 'leadDays' in plan ? plan.leadDays : 0,
          triggerAt: plan.triggerAt,
          osNotificationId,
          status: 'scheduled',
          createdAt: now,
        });
      } catch {
        // A single bad schedule must not abort the rest of the sync.
      }
    }

    const kept = existing.filter(
      (e) => e.status === 'scheduled' && !toCancel.some((c) => c.key === e.key),
    );
    await repository.saveAll([...kept, ...fresh]);
    return { scheduled: fresh.length, canceled: toCancel.length, skipped: false };
  } catch (err) {
    return {
      scheduled: 0,
      canceled: 0,
      skipped: true,
      reason: err instanceof Error ? err.message : 'Failed to sync notifications.',
    };
  }
}

/**
 * Adapter that cancels single notifications through expo-notifications.
 * Only per-id cancellation is used on purpose: `cancelAllScheduledNotificationsAsync()`
 * would also clear notifications that belong to other Leakify profiles on the
 * same device (or to unrelated app features), and it wipes nothing we can prove
 * was ours.
 */
export const expoNotificationCanceller: NotificationCanceller = {
  async cancel(osNotificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(osNotificationId);
  },
};

/**
 * Cancel every reminder recorded for one scope and clear that scope's
 * bookkeeping — used by account deletion and demo reset.
 *
 * Order is the contract: cancellation first, storage second (see
 * `cancelScopeNotifications`). On web there is no OS schedule, so only the
 * bookkeeping is cleared.
 */
export async function cancelScheduledForScope(
  repository: ScheduledNotificationRepository,
  canceller: NotificationCanceller = expoNotificationCanceller,
): Promise<CleanupOutcome> {
  const records = await repository.list();
  if (Platform.OS === 'web') {
    await repository.saveAll([]);
    return { attempted: 0, canceled: 0, failedOsIds: [], cleared: true, noop: records.length === 0 };
  }
  return cancelScopeNotifications(records, canceller, {
    clearBookkeeping: () => repository.saveAll([]),
  });
}
