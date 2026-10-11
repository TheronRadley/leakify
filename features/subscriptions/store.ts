/**
 * App data store — a tiny observable store exposed through useSyncExternalStore.
 * Write-through semantics (no optimistic updates): every mutation awaits the
 * repository, then replaces state, so UI never shows unconfirmed data and no
 * rollback machinery is needed.
 */
import { useSyncExternalStore } from 'react';
import { buildDemoSubscriptions, DEMO_PRICE_HISTORY } from '@/features/subscriptions/demo';
import { buildPromotionPlan, type PromotionOutcome } from '@/features/subscriptions/mode-transition';
import { runScopedWipe, type WipeResult } from '@/features/subscriptions/lifecycle';
import { cancelScheduledForScope } from '@/features/notifications/service';
import { createRepositories, type RepositoryBundle } from '@/services';
import { isSupabaseConfigured } from '@/services/supabase';
import { toUserMessage } from '@/services/repository';
import type { DataMode, NotificationSettings, Profile, Subscription, SubscriptionStatus } from '@/types';
import type { SubscriptionInput, SubscriptionPatch } from '@/services/repository';

export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DataState {
  status: StoreStatus;
  mode: DataMode;
  scope: string | null;
  subscriptions: Subscription[];
  profile: Profile | null;
  notificationSettings: NotificationSettings;
  error: string | null;
  /** True while the store contains seeded demo data. */
  isDemo: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  previewMode: 'generic',
  renewalLeadDays: [3, 1, 0],
  trialLeadDays: [1],
  weeklyDigestEnabled: false,
  permissionStatus: 'unknown',
};

let state: DataState = {
  status: 'idle',
  mode: 'local',
  scope: null,
  subscriptions: [],
  profile: null,
  notificationSettings: DEFAULT_SETTINGS,
  error: null,
  isDemo: false,
};

let repos: RepositoryBundle | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<DataState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DataState {
  return state;
}

export function useDataStore(): DataState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getDataState(): DataState {
  return state;
}

/** (Re)initialize the store for a new scope (demo / signed-in user id). */
export async function initializeStore(mode: DataMode, scope: string, opts?: { seedDemo?: boolean }): Promise<void> {
  repos = createRepositories(mode, scope);
  setState({ status: 'loading', mode, scope, error: null, isDemo: opts?.seedDemo === true });

  try {
    if (opts?.seedDemo) {
      const existing = await repos.subscriptions.list();
      if (existing.length === 0) {
        for (const input of buildDemoSubscriptions()) {
          const created = await repos.subscriptions.create(input);
          const history = DEMO_PRICE_HISTORY[created.name];
          if (history?.length) {
            await repos.subscriptions.update(created.id, { priceHistory: history });
          }
        }
      }
    }
    const [subscriptions, profile, notificationSettings] = await Promise.all([
      repos.subscriptions.list(),
      repos.profile.get(),
      repos.notificationSettings.get(),
    ]);
    setState({ status: 'ready', subscriptions, profile, notificationSettings });
  } catch (err) {
    setState({ status: 'error', error: toUserMessage(err) });
  }
}

/** The on-device (non-demo) scope, and the seeded demo scope. */
export const LOCAL_USER_SCOPE = 'local-user';
export const DEMO_SCOPE = 'demo';

/**
 * What exists in the store the user is *not* currently reading. Counts are read
 * from the repositories (never inferred), and the cloud count is only queried for
 * a signed-in user with a configured project — otherwise it reports 0 rather than
 * pretending.
 */
export async function readModeCounts(signedInUserId: string | null): Promise<{
  localOnlyCount: number;
  cloudOnlyCount: number;
  /** Local records the account does not already hold — i.e. what a copy would add. */
  promotableCount: number;
}> {
  let localRecords: Subscription[] = [];
  let cloudRecords: Subscription[] = [];
  try {
    localRecords = await createRepositories('local', LOCAL_USER_SCOPE).subscriptions.list();
  } catch {
    localRecords = [];
  }
  if (signedInUserId && isSupabaseConfigured) {
    try {
      cloudRecords = await createRepositories('supabase', signedInUserId).subscriptions.list();
    } catch {
      cloudRecords = [];
    }
  }
  const plan = buildPromotionPlan<Subscription>(localRecords, cloudRecords);
  return {
    localOnlyCount: localRecords.length,
    cloudOnlyCount: cloudRecords.length,
    promotableCount: plan.create.length,
  };
}

/** Everything except the fields `create` assigns itself (see SubscriptionInput). */
function toSubscriptionInput(record: Subscription): Omit<
  Subscription,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'canceledAt' | 'priceHistory'
> {
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    archivedAt: _archivedAt,
    canceledAt: _canceledAt,
    priceHistory: _priceHistory,
    ...rest
  } = record;
  return rest;
}

/**
 * Copy on-device records into the active cloud account — explicitly requested, one
 * direction only, and non-destructive: the local list is left exactly as it was, so
 * a user who regrets it has lost nothing. Records the account already holds (same
 * name, amount, currency, interval and next date) are skipped rather than
 * duplicated. Prices history travels with the record because the detail screen
 * shows it.
 */
export async function promoteLocalDataToCloud(): Promise<PromotionOutcome> {
  if (state.mode !== 'supabase') {
    return { created: 0, skipped: 0, failed: 0, error: 'Cloud mode is not active.' };
  }
  if (!repos) return { created: 0, skipped: 0, failed: 0, error: 'Store is not initialized.' };

  let localRecords: Subscription[];
  try {
    const local = createRepositories('local', LOCAL_USER_SCOPE);
    localRecords = await local.subscriptions.list();
  } catch (err) {
    return { created: 0, skipped: 0, failed: 0, error: toUserMessage(err) };
  }

  // Both sides are `Subscription`s, so the plan hands back the original local
  // records (not copies) and the loop below can use them directly.
  const plan = buildPromotionPlan<Subscription>(localRecords, state.subscriptions);

  let created = 0;
  let failed = 0;
  for (const record of plan.create) {
    try {
      const copy = await repos.subscriptions.create(toSubscriptionInput(record));
      if (record.priceHistory?.length) {
        await repos.subscriptions.update(copy.id, { priceHistory: record.priceHistory });
      }
      created += 1;
    } catch {
      failed += 1;
    }
  }

  if (created > 0) await refreshSubscriptions();
  const outcome: PromotionOutcome = { created, skipped: plan.skipped.length, failed };
  if (failed > 0) {
    outcome.error = `${failed} ${failed === 1 ? 'record could' : 'records could'} not be copied and stayed on this device.`;
  }
  return outcome;
}

export async function refreshSubscriptions(): Promise<void> {
  if (!repos) return;
  try {
    const subscriptions = await repos.subscriptions.list();
    setState({ subscriptions, error: null });
  } catch (err) {
    setState({ error: toUserMessage(err) });
  }
}

async function mutate<T>(fn: (r: RepositoryBundle) => Promise<T>): Promise<T> {
  if (!repos) throw new Error('Store is not initialized');
  const result = await fn(repos);
  return result;
}

export async function addSubscription(input: SubscriptionInput): Promise<Subscription> {
  const created = await mutate((r) => r.subscriptions.create(input));
  setState({ subscriptions: [...state.subscriptions, created] });
  return created;
}

export async function updateSubscription(id: string, patch: SubscriptionPatch): Promise<Subscription> {
  const updated = await mutate((r) => r.subscriptions.update(id, patch));
  setState({
    subscriptions: state.subscriptions.map((s) => (s.id === id ? updated : s)),
  });
  return updated;
}

export async function deleteSubscription(id: string): Promise<void> {
  await mutate((r) => r.subscriptions.remove(id));
  setState({ subscriptions: state.subscriptions.filter((s) => s.id !== id) });
}

export async function setSubscriptionStatus(id: string, status: SubscriptionStatus): Promise<Subscription> {
  const updated = await mutate((r) => r.subscriptions.setStatus(id, status));
  setState({
    subscriptions: state.subscriptions.map((s) => (s.id === id ? updated : s)),
  });
  return updated;
}

export async function recordPayment(id: string): Promise<Subscription> {
  const current = state.subscriptions.find((s) => s.id === id);
  if (!current) throw new Error('Subscription not found');
  const updated = await mutate((r) =>
    r.subscriptions.recordPayment(id, new Date().toISOString().slice(0, 10), current.amountCents),
  );
  setState({
    subscriptions: state.subscriptions.map((s) => (s.id === id ? updated : s)),
  });
  return updated;
}

export async function setSubscriptionFlags(
  id: string,
  flags: { flaggedUnused?: boolean; isCancelCandidate?: boolean },
): Promise<Subscription> {
  return updateSubscription(id, flags);
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Profile> {
  const profile = await mutate((r) => r.profile.upsert(patch));
  setState({ profile });
  return profile;
}

/**
 * Persist an observed OS permission state without re-rendering consumers.
 * This is a bookkeeping field (it is re-read from the OS on every launch), so it
 * deliberately bypasses store state to avoid waking the reminder sync loop.
 */
export async function observePermissionStatus(
  permissionStatus: NotificationSettings['permissionStatus'],
): Promise<void> {
  try {
    await mutate((r) => r.notificationSettings.update({ permissionStatus }));
  } catch {
    // Permission bookkeeping is best-effort; the UI reads the live state anyway.
  }
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const settings = await mutate((r) => r.notificationSettings.update(patch));
  setState({ notificationSettings: settings });
  return settings;
}

/** Outcome of a destructive data operation, surfaced to the UI. */
export type DataWipeResult = WipeResult;

/**
 * Clear all demo data and re-seed the sample account.
 *
 * The old demo reminders are cancelled *before* the demo scope is wiped and
 * re-seeded (see `runScopedWipe`), so a refresh can never leave the previous
 * schedule behind or double-book the same renewal.
 */
export async function resetDemoData(): Promise<DataWipeResult> {
  const scope = state.scope;
  if (!scope || state.mode !== 'demo') {
    return {
      notificationsAttempted: 0,
      notificationsFailed: 0,
      dataDeleted: false,
      reseeded: false,
      error: 'Demo data can only be refreshed while demo mode is active.',
    };
  }
  return runScopedWipe({
    cancelScheduled: () => mutate((r) => cancelScheduledForScope(r.scheduledNotifications)),
    deleteAccountData: () => mutate((r) => r.profile.deleteAccountData()),
    reseed: async () => {
      await initializeStore('demo', scope, { seedDemo: true });
    },
  });
}

/**
 * Wipe every piece of data held under the current scope (account deletion).
 *
 * Reminders are cancelled before anything is deleted: once the notification
 * bookkeeping is gone there is no way to know which OS reminders belonged to
 * this account. A repository failure is reported rather than swallowed, so the
 * UI never claims a deletion that did not finish.
 */
export async function deleteAllAccountData(): Promise<DataWipeResult> {
  const result = await runScopedWipe({
    cancelScheduled: () => mutate((r) => cancelScheduledForScope(r.scheduledNotifications)),
    deleteAccountData: () => mutate((r) => r.profile.deleteAccountData()),
  });
  if (result.dataDeleted) {
    setState({ subscriptions: [], profile: null });
  } else {
    setState({ status: 'error', error: result.error ?? toUserMessage(null) });
  }
  return result;
}

export function useSubscriptionById(id: string): Subscription | undefined {
  const store = useDataStore();
  return store.subscriptions.find((s) => s.id === id);
}

export function useRepository(): RepositoryBundle {
  if (!repos) throw new Error('Store is not initialized');
  return repos;
}

export const listBillingEvents = (subscriptionId: string) =>
  mutate((r) => r.billingEvents.listForSubscription(subscriptionId));

/** All recorded billing events (for trend insights). */
export const listAllBillingEvents = () => mutate((r) => r.billingEvents.listAll());

export function useIsDemo(): boolean {
  return useDataStore().isDemo;
}

/** Selector helper used across screens. */
export function useSubscriptions(): { subscriptions: Subscription[]; status: StoreStatus } {
  const store = useDataStore();
  return { subscriptions: store.subscriptions, status: store.status };
}
