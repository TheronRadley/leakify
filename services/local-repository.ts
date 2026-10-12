/**
 * Local / demo mode repositories. Subscriptions are validated on write and
 * all reads are scoped to a single user (or the demo scope) — the same
 * authorization shape Supabase RLS enforces in cloud mode.
 */
import { todayISO, toISODate, addInterval, parseISODate } from '@/lib/dates';
import { DEFAULT_CURRENCY } from '@/lib/constants';
import { isSafeExternalUrl } from '@/lib/links';
import {
  readStored,
  readStoredOrNull,
  removeKey,
  storageKeys,
  writeJSON,
} from '@/services/local-storage';
import {
  RepositoryError,
  type AccountDeletionResult,
  type BillingEventRepository,
  type NotificationSettingsRepository,
  type ProfileRepository,
  type ScheduledNotificationRepository,
  type SubscriptionInput,
  type SubscriptionPatch,
  type SubscriptionRepository,
} from '@/services/repository';
import type {
  BillingEvent,
  NotificationSettings,
  Profile,
  ScheduledNotification,
  Subscription,
  SubscriptionStatus,
} from '@/types';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function assertValidInput(input: Partial<SubscriptionInput>): void {
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new RepositoryError('validation', 'Subscription name is required.');
  }
  if (input.amountCents !== undefined && (!Number.isInteger(input.amountCents) || input.amountCents <= 0)) {
    throw new RepositoryError('validation', 'Amount must be a positive number.');
  }
  if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) {
    throw new RepositoryError('validation', 'Currency must be a 3-letter ISO code.');
  }
  if (input.cancellationUrl !== undefined && input.cancellationUrl !== null) {
    const value = input.cancellationUrl.trim();
    if (value.length > 0 && !isSafeExternalUrl(value)) {
      throw new RepositoryError(
        'validation',
        'Cancellation links must be https:// addresses. See the link policy in lib/links.ts.',
      );
    }
  }
}

export class LocalSubscriptionRepository implements SubscriptionRepository {
  constructor(protected readonly scope: string) {}

  protected get key(): string {
    return storageKeys.subscriptions(this.scope);
  }

  protected async readAll(): Promise<Subscription[]> {
    // Validated on read: a payload that cannot be parsed surfaces as a
    // StorageCorruptionError instead of masquerading as "no subscriptions".
    return readStored('subscriptions', this.key, []);
  }

  protected async writeAll(subs: Subscription[]): Promise<void> {
    await writeJSON(this.key, subs);
  }

  async list(): Promise<Subscription[]> {
    const subs = await this.readAll();
    return subs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async get(id: string): Promise<Subscription | null> {
    const subs = await this.readAll();
    return subs.find((s) => s.id === id) ?? null;
  }

  async create(input: SubscriptionInput): Promise<Subscription> {
    assertValidInput(input);
    const now = new Date().toISOString();
    const subscription: Subscription = {
      ...input,
      id: generateId(),
      userId: this.scope,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      canceledAt: input.status === 'canceled' ? now : null,
      priceHistory: [],
    };
    const subs = await this.readAll();
    await this.writeAll([...subs, subscription]);
    return subscription;
  }

  async update(id: string, patch: SubscriptionPatch): Promise<Subscription> {
    assertValidInput(patch);
    const subs = await this.readAll();
    const index = subs.findIndex((s) => s.id === id);
    if (index < 0) throw new RepositoryError('not_found', 'Subscription not found.');
    const current = subs[index];

    // Track price history when the user records a new amount.
    let priceHistory = current.priceHistory;
    if (
      patch.amountCents !== undefined &&
      (patch.amountCents !== current.amountCents || patch.currency !== current.currency)
    ) {
      priceHistory = [
        ...priceHistory,
        {
          amountCents: current.amountCents,
          currency: current.currency,
          effectiveFrom: current.updatedAt.slice(0, 10),
        },
      ];
    }

    const statusChanged = patch.status !== undefined && patch.status !== current.status;
    const updated: Subscription = {
      ...current,
      ...patch,
      priceHistory,
      canceledAt: statusChanged
        ? patch.status === 'canceled'
          ? new Date().toISOString()
          : null
        : current.canceledAt,
      updatedAt: new Date().toISOString(),
    };
    subs[index] = updated;
    await this.writeAll(subs);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const subs = await this.readAll();
    await this.writeAll(subs.filter((s) => s.id !== id));
  }

  async setStatus(id: string, status: SubscriptionStatus, _atISO?: string): Promise<Subscription> {
    return this.update(id, { status });
  }

  async recordPayment(id: string, actualDateISO: string, actualAmountCents: number): Promise<Subscription> {
    const sub = await this.get(id);
    if (!sub) throw new RepositoryError('not_found', 'Subscription not found.');
    if (!sub.nextBillingDate) throw new RepositoryError('validation', 'No next billing date to roll forward.');

    // Roll forward one full interval from the recorded next billing date.
    const anchor = parseISODate(sub.nextBillingDate);
    if (!anchor) throw new RepositoryError('validation', 'Saved billing date is invalid.');
    const next = toISODate(addInterval(anchor, sub.interval, 1));

    // Persist the billing event as history (never fabricate past records).
    const eventsKey = storageKeys.billingEvents(this.scope);
    const events = await readStored('billingEvents', eventsKey, []);
    const now = new Date().toISOString();
    events.push({
      id: generateId(),
      subscriptionId: sub.id,
      userId: sub.userId,
      expectedDate: sub.nextBillingDate,
      amountCents: sub.amountCents,
      currency: sub.currency,
      type: sub.status === 'trialing' ? 'trial_end' : 'renewal',
      status: 'charged',
      actualDate: actualDateISO,
      actualAmountCents,
      createdAt: now,
    });
    await writeJSON(eventsKey, events);

    const becomingActive = sub.status === 'trialing' ? { status: 'active' as const } : {};
    return this.update(id, { nextBillingDate: next, ...becomingActive });
  }
}

export class LocalBillingEventRepository implements BillingEventRepository {
  constructor(private readonly scope: string) {}

  async listForSubscription(subscriptionId: string): Promise<BillingEvent[]> {
    const events = await readStored('billingEvents', storageKeys.billingEvents(this.scope), []);
    return events
      .filter((e) => e.subscriptionId === subscriptionId)
      .sort((a, b) => b.expectedDate.localeCompare(a.expectedDate));
  }

  async listAll(): Promise<BillingEvent[]> {
    const events = await readStored('billingEvents', storageKeys.billingEvents(this.scope), []);
    return events.sort((a, b) => b.expectedDate.localeCompare(a.expectedDate));
  }
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  renewalLeadDays: [3, 1, 0],
  trialLeadDays: [1],
  weeklyDigestEnabled: false,
  genericLockScreenText: false,
  permissionStatus: 'unknown',
};

export class LocalNotificationSettingsRepository implements NotificationSettingsRepository {
  constructor(private readonly scope: string) {}

  async get(): Promise<NotificationSettings> {
    const stored = await readStoredOrNull('notificationSettings', storageKeys.notificationSettings(this.scope));
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(stored ?? {}) };
  }

  async update(patch: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const next = { ...(await this.get()), ...patch };
    await writeJSON(storageKeys.notificationSettings(this.scope), next);
    return next;
  }
}

export class LocalScheduledNotificationRepository implements ScheduledNotificationRepository {
  constructor(private readonly scope: string) {}

  async list(): Promise<ScheduledNotification[]> {
    return readStored('scheduledNotifications', storageKeys.scheduledNotifications(this.scope), []);
  }

  async saveAll(records: ScheduledNotification[]): Promise<void> {
    await writeJSON(storageKeys.scheduledNotifications(this.scope), records);
  }
}

const DEMO_PROFILE: Omit<Profile, 'createdAt' | 'updatedAt'> = {
  id: 'demo-user',
  displayName: 'Demo Explorer',
  preferredCurrency: DEFAULT_CURRENCY,
  locale: 'en-US',
  timezone: 'UTC',
  themePreference: 'system',
};

export class LocalProfileRepository implements ProfileRepository {
  constructor(private readonly scope: string) {}

  async get(): Promise<Profile | null> {
    const stored = await readStoredOrNull('profile', storageKeys.profile(this.scope));
    if (stored) return stored;
    if (this.scope === 'demo') {
      const now = new Date().toISOString();
      return { ...DEMO_PROFILE, createdAt: now, updatedAt: now };
    }
    return null;
  }

  async upsert(patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile> {
    const existing = await this.get();
    const now = new Date().toISOString();
    const base: Profile =
      existing ?? {
        id: this.scope,
        displayName: 'Leakify User',
        preferredCurrency: DEFAULT_CURRENCY,
        locale: 'en-US',
        timezone: 'UTC',
        themePreference: 'system',
        createdAt: now,
        updatedAt: now,
      };
    const next: Profile = { ...base, ...patch, updatedAt: now };
    await writeJSON(storageKeys.profile(this.scope), next);
    return next;
  }

  /**
   * Wipes every storage key this scope owns. There is no account to destroy in
   * local / demo mode, so `accountDeleted` is true by definition — nothing
   * identifying survives on the device once these keys are gone.
   */
  async deleteAccountData(): Promise<AccountDeletionResult> {
    await removeKey(storageKeys.subscriptions(this.scope));
    await removeKey(storageKeys.profile(this.scope));
    await removeKey(storageKeys.notificationSettings(this.scope));
    await removeKey(storageKeys.scheduledNotifications(this.scope));
    await removeKey(storageKeys.billingEvents(this.scope));
    return { rowsDeleted: true, accountDeleted: true };
  }
}

export { DEFAULT_NOTIFICATION_SETTINGS, generateId };
export { todayISO };
