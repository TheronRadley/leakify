/**
 * App data store — a tiny observable store exposed through useSyncExternalStore.
 * Write-through semantics (no optimistic updates): every mutation awaits the
 * repository, then replaces state, so UI never shows unconfirmed data and no
 * rollback machinery is needed.
 */
import { useSyncExternalStore } from 'react';
import { buildDemoSubscriptions, DEMO_PRICE_HISTORY } from '@/features/subscriptions/demo';
import { createRepositories, type RepositoryBundle } from '@/services';
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

/** Clear all demo data and return the demo scope to a pristine state. */
export async function resetDemoData(): Promise<void> {
  const scope = state.scope;
  if (!scope || state.mode !== 'demo') return;
  await mutate((r) => r.profile.deleteAccountData());
  await initializeStore('demo', scope, { seedDemo: true });
}

/** Wipe every piece of data held under the current scope (account deletion). */
export async function deleteAllAccountData(): Promise<void> {
  await mutate((r) => r.profile.deleteAccountData());
  setState({ subscriptions: [], profile: null });
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
