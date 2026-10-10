/**
 * Repository factory. Picks local vs Supabase implementations based on the
 * active data mode. When Supabase is not configured the app silently runs
 * fully local — nothing is ever sent anywhere.
 */
import {
  LocalBillingEventRepository,
  LocalNotificationSettingsRepository,
  LocalProfileRepository,
  LocalScheduledNotificationRepository,
  LocalSubscriptionRepository,
} from '@/services/local-repository';
import type {
  BillingEventRepository,
  NotificationSettingsRepository,
  ProfileRepository,
  ScheduledNotificationRepository,
  SubscriptionRepository,
} from '@/services/repository';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import {
  SupabaseBillingEventRepository,
  SupabaseNotificationSettingsRepository,
  SupabaseProfileRepository,
  SupabaseSubscriptionRepository,
} from '@/services/supabase-repository';
import type { DataMode } from '@/types';

export interface RepositoryBundle {
  subscriptions: SubscriptionRepository;
  billingEvents: BillingEventRepository;
  profile: ProfileRepository;
  notificationSettings: NotificationSettingsRepository;
  scheduledNotifications: ScheduledNotificationRepository;
}

class LocalScheduledRepoAdapter implements ScheduledNotificationRepository {
  private inner: LocalScheduledNotificationRepository;
  constructor(scope: string) {
    this.inner = new LocalScheduledNotificationRepository(scope);
  }
  list() {
    return this.inner.list();
  }
  saveAll(records: Parameters<LocalScheduledNotificationRepository['saveAll']>[0]) {
    return this.inner.saveAll(records);
  }
}

export function createRepositories(mode: DataMode, scope: string): RepositoryBundle {
  if (mode === 'supabase' && isSupabaseConfigured) {
    const db = getSupabase();
    return {
      subscriptions: new SupabaseSubscriptionRepository(db, scope),
      billingEvents: new SupabaseBillingEventRepository(db, scope),
      profile: new SupabaseProfileRepository(db, scope),
      notificationSettings: new SupabaseNotificationSettingsRepository(db, scope),
      scheduledNotifications: new LocalScheduledRepoAdapter(scope),
    };
  }
  return {
    subscriptions: new LocalSubscriptionRepository(scope),
    billingEvents: new LocalBillingEventRepository(scope),
    profile: new LocalProfileRepository(scope),
    notificationSettings: new LocalNotificationSettingsRepository(scope),
    scheduledNotifications: new LocalScheduledNotificationRepository(scope),
  };
}
