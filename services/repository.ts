/**
 * Repository interfaces — the only data-access boundary the app talks to.
 * `LocalSubscriptionRepository` backs demo / local mode (AsyncStorage) and
 * `SupabaseSubscriptionRepository` backs authenticated cloud mode. Both honor
 * the same data contract, so screens never branch on backend.
 */
import type {
  BillingEvent,
  NotificationSettings,
  Profile,
  ScheduledNotification,
  Subscription,
  SubscriptionStatus,
} from '@/types';

/** Fields the UI supplies when creating / editing a subscription. */
export type SubscriptionInput = Omit<
  Subscription,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'canceledAt' | 'priceHistory'
>;

export interface SubscriptionPatch extends Partial<SubscriptionInput> {
  archivedAt?: string | null;
  priceHistory?: Subscription['priceHistory'];
}

export interface SubscriptionRepository {
  list(): Promise<Subscription[]>;
  get(id: string): Promise<Subscription | null>;
  create(input: SubscriptionInput): Promise<Subscription>;
  update(id: string, patch: SubscriptionPatch): Promise<Subscription>;
  remove(id: string): Promise<void>;
  setStatus(id: string, status: SubscriptionStatus, atISO?: string): Promise<Subscription>;
  /** Record a payment and roll the next billing date forward one interval. */
  recordPayment(id: string, actualDateISO: string, actualAmountCents: number): Promise<Subscription>;
}

export interface BillingEventRepository {
  listForSubscription(subscriptionId: string): Promise<BillingEvent[]>;
  listAll(): Promise<BillingEvent[]>;
}

/**
 * Outcome of "delete all my data".
 *
 * Row deletion and account destruction are reported separately on purpose:
 * only the account owner's data can be removed from the client, while killing
 * the auth user itself needs a server-side function. The UI must be able to
 * tell the difference so it never claims a full account deletion it did not
 * perform (Apple 5.1.1(v) / Play account-deletion requirements).
 */
export interface AccountDeletionResult {
  /** Subscriptions, billing events, notification records, preferences and profile are gone. */
  rowsDeleted: boolean;
  /** The authentication account was destroyed as well. True in local/demo mode: no account exists. */
  accountDeleted: boolean;
  /** User-safe explanation when `accountDeleted` is false. */
  warning?: string;
}

export interface ProfileRepository {
  get(): Promise<Profile | null>;
  upsert(patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile>;
  deleteAccountData(): Promise<AccountDeletionResult>;
}

export interface NotificationSettingsRepository {
  get(): Promise<NotificationSettings>;
  update(patch: Partial<NotificationSettings>): Promise<NotificationSettings>;
}

export interface ScheduledNotificationRepository {
  list(): Promise<ScheduledNotification[]>;
  saveAll(records: ScheduledNotification[]): Promise<void>;
}

/** Data-layer error with a user-safe message. Never leaks secrets or PII. */
export class RepositoryError extends Error {
  readonly code: 'not_found' | 'validation' | 'network' | 'unauthorized' | 'unknown';

  constructor(code: RepositoryError['code'], message: string) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export function toUserMessage(err: unknown): string {
  if (err instanceof RepositoryError) return err.message;
  // Corrupt / newer-version local storage: the message is written for a user
  // and must not be replaced by a generic "something went wrong" (audit R-01).
  if (
    err instanceof Error &&
    (err.name === 'StorageCorruptionError' || err.name === 'StorageVersionError')
  ) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
