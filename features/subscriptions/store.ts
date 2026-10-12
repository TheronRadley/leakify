/**
 * App data store — a tiny observable store exposed through useSyncExternalStore.
 * Write-through semantics (no optimistic updates): every mutation awaits the
 * repository, then replaces state, so UI never shows unconfirmed data and no
 * rollback machinery is needed.
 */
import { useSyncExternalStore } from 'react';
import { cancelAllScheduled } from '@/features/notifications/service';
import { buildDemoSubscriptions, DEMO_PRICE_HISTORY } from '@/features/subscriptions/demo';
import { createRepositories, type RepositoryBundle } from '@/services';
import {
  toSubscriptionInput,
  type ImportAnalysis,
  type ImportDuplicateStrategy,
} from '@/features/subscriptions/import-export';
import { migrateLocalStorage } from '@/services/local-storage';
import {
  toUserMessage,
  type AccountDeletionResult,
  type SubscriptionInput,
  type SubscriptionPatch,
} from '@/services/repository';
import type { DataMode, NotificationSettings, Profile, Subscription, SubscriptionStatus } from '@/types';

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
  renewalLeadDays: [3, 1, 0],
  trialLeadDays: [1],
  weeklyDigestEnabled: false,
  genericLockScreenText: false,
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
    // Refuse to read data this build does not understand (and migrate what it
    // does). Failures land in the error state below, where the user sees them.
    await migrateLocalStorage();
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

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const settings = await mutate((r) => r.notificationSettings.update(patch));
  setState({ notificationSettings: settings });
  return settings;
}

/**
 * Clear all demo data and return the demo scope to a pristine state.
 *
 * OS notifications are cancelled FIRST. The bookkeeping that maps our dedup
 * keys to OS notification ids is deleted along with the rest of the scope, and
 * once it is gone the next sync sees `existing = []` and can no longer cancel
 * anything — so re-seeding would schedule a second copy of every reminder
 * while the originals are still queued in the OS (audit N-01).
 */
export async function resetDemoData(): Promise<void> {
  const scope = state.scope;
  if (!scope || state.mode !== 'demo') return;
  const repos = requireRepositories();
  await cancelAllScheduled(repos.scheduledNotifications);
  await mutate((r) => r.profile.deleteAccountData());
  await initializeStore('demo', scope, { seedDemo: true });
}

/**
 * Wipe every piece of data held under the current scope (account deletion).
 *
 * Same ordering rule as the demo reset: cancel what the OS still holds before
 * removing the records that identify it — otherwise reminders for deleted
 * subscriptions keep firing, complete with their names and amounts.
 *
 * Returns the repository's deletion result so the UI can report honestly
 * whether the cloud account itself was destroyed or only the data.
 */
export async function deleteAllAccountData(): Promise<AccountDeletionResult> {
  const repos = requireRepositories();
  await cancelAllScheduled(repos.scheduledNotifications);
  const result = await mutate((r) => r.profile.deleteAccountData());
  setState({ subscriptions: [], profile: null, notificationSettings: DEFAULT_SETTINGS });
  return result;
}

function requireRepositories(): RepositoryBundle {
  if (!repos) throw new Error('Store is not initialized');
  return repos;
}

/**
 * How many subscriptions exist in the on-device (`local-user`) scope, no matter
 * which mode is active. Used to warn before a mode switch that would hide them
 * (features/subscriptions/mode-transition.ts).
 */
export async function countLocalSubscriptions(): Promise<number> {
  const repos = createRepositories('local', 'local-user');
  const subscriptions = await repos.subscriptions.list();
  return subscriptions.length;
}

export interface ImportResult {
  created: number;
  replaced: number;
  skipped: number;
  failed: number;
}

/**
 * Apply a PREVIEWED import (see analyzeImport). Writes go through the active
 * repository, so demo/local/cloud all behave the same and RLS still applies.
 * Per-row failures are counted rather than thrown: a half-restored list the
 * user can see beats an opaque error with no idea what landed.
 */
export async function importSubscriptions(
  analysis: Extract<ImportAnalysis, { ok: true }>,
  strategy: ImportDuplicateStrategy,
): Promise<ImportResult> {
  const repos = requireRepositories();
  const result: ImportResult = { created: 0, replaced: 0, skipped: 0, failed: 0 };

  for (const subscription of analysis.toCreate) {
    try {
      await repos.subscriptions.create(toSubscriptionInput(subscription));
      result.created += 1;
    } catch {
      result.failed += 1;
    }
  }

  for (const duplicate of analysis.duplicates) {
    if (strategy === 'skip') {
      result.skipped += 1;
      continue;
    }
    try {
      await repos.subscriptions.update(duplicate.existingId, toSubscriptionInput(duplicate.subscription));
      result.replaced += 1;
    } catch {
      result.failed += 1;
    }
  }

  if (analysis.profile) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...profilePatch } = analysis.profile;
    try {
      await repos.profile.upsert(profilePatch);
    } catch {
      result.failed += 1;
    }
  }

  const subscriptions = await repos.subscriptions.list();
  const profile = await repos.profile.get();
  setState({ subscriptions, profile, error: null });
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
