/**
 * Typed wrapper over AsyncStorage for local / demo mode persistence.
 *
 * Keys are namespaced per user scope so demo data stays separate from real user
 * data (`demo` vs user ids), and every value is written inside a versioned
 * envelope (see `services/storage-schema.ts`).
 *
 * The recovery rules that this layer is responsible for:
 * - A value that cannot be understood is never silently replaced. Its bytes are
 *   parked in a bounded recovery store so a human (or a later build) can get
 *   them back, and an issue is recorded for diagnostics.
 * - A value written by a *newer* app version is left alone: guessing at a future
 *   shape is how upgrades corrupt accounts.
 * - "Absent" and "unreadable" are different answers and stay different all the
 *   way to the UI, so a corrupt key can never masquerade as an empty account.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  inspectRaw,
  wrapEnvelope,
  type DataKind,
  type StorageStatus,
} from '@/services/storage-schema';

const PREFIX = 'leakify';

export const storageKeys = {
  onboardingCompleted: `${PREFIX}.onboarding.completed`,
  dataMode: `${PREFIX}.data.mode`,
  theme: `${PREFIX}.theme`,
  subscriptions: (scope: string) => `${PREFIX}.subscriptions.${scope}`,
  profile: (scope: string) => `${PREFIX}.profile.${scope}`,
  notificationSettings: (scope: string) => `${PREFIX}.notifications.settings.${scope}`,
  scheduledNotifications: (scope: string) => `${PREFIX}.notifications.scheduled.${scope}`,
  billingEvents: (scope: string) => `${PREFIX}.billing.events.${scope}`,
  /** Undecodable values, so a failed read is recoverable instead of destroyed. */
  recovery: `${PREFIX}.storage.recovery`,
};

export interface RecoveryEntry {
  key: string;
  kind: DataKind;
  status: StorageStatus;
  /** Bytes of the original payload — reported, never printed. */
  bytes: number;
  at: string;
  /** The original raw string, kept verbatim for a restore attempt. */
  raw: string;
}

/** Bounded so a persistent corruption cannot grow storage without limit. */
const MAX_RECOVERY_ENTRIES = 12;

const issues = new Map<string, RecoveryEntry>();

/** Diagnostic view for the UI. Contains key names and sizes, never user data. */
export function getStorageIssues(): Omit<RecoveryEntry, 'raw'>[] {
  return [...issues.values()].map(({ raw: _raw, ...rest }) => rest);
}

export function hasStorageIssues(): boolean {
  return issues.size > 0;
}

async function readRecoveryList(): Promise<RecoveryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKeys.recovery);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecoveryEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeRecoveryList(entries: RecoveryEntry[]): Promise<void> {
  if (entries.length === 0) {
    await AsyncStorage.removeItem(storageKeys.recovery);
    return;
  }
  await AsyncStorage.setItem(storageKeys.recovery, JSON.stringify(entries.slice(-MAX_RECOVERY_ENTRIES)));
}

async function parkForRecovery(key: string, kind: DataKind, status: StorageStatus, raw: string): Promise<void> {
  const entry: RecoveryEntry = { key, kind, status, bytes: raw.length, at: new Date().toISOString(), raw };
  issues.set(key, entry);
  const list = await readRecoveryList();
  const without = list.filter((e) => e.key !== key);
  // Truncate the payload itself too: a huge corrupt blob must not become a new
  // storage problem. Restore still works for the shapes we care about.
  without.push({ ...entry, raw: raw.slice(0, 200_000) });
  await writeRecoveryList(without);
}

/**
 * Read and interpret one key. Callers that need to distinguish "absent" from
 * "corrupt" use this; `readJSON` is the ergonomic form for the rest.
 */
export async function readValue<T>(key: string, kind: DataKind = 'unknown'): Promise<{
  status: StorageStatus;
  value: T | null;
  details?: string;
}> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (err) {
    // A storage-layer throw is not "no data": report it and keep whatever is on
    // disk untouched.
    return { status: 'invalid', value: null, details: err instanceof Error ? err.name : 'storage error' };
  }

  const outcome = inspectRaw<T>(raw, kind);
  if ((outcome.status === 'invalid' || outcome.status === 'unsupported_version') && raw) {
    await parkForRecovery(key, kind, outcome.status, raw);
  } else if (outcome.status === 'current' || outcome.status === 'legacy') {
    if (issues.has(key)) {
      issues.delete(key);
      const list = await readRecoveryList();
      await writeRecoveryList(list.filter((e) => e.key !== key));
    }
  }
  return outcome;
}

export async function readJSON<T>(key: string, fallback: T, kind: DataKind = 'unknown'): Promise<T> {
  const outcome = await readValue<T>(key, kind);
  return outcome.value ?? fallback;
}

/**
 * Write a versioned envelope. Reading back what we wrote always yields the same
 * value, which is the invariant the upgrade path depends on.
 */
export async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(wrapEnvelope(value)));
}

/**
 * Raw (un-enveloped) read/write for values that are deliberately not part of the
 * versioned user-data schema — currently only the theme preference, which is
 * cosmetic, reconstructed from the OS if missing, and therefore not worth a
 * migration or a recovery entry.
 */
export async function readRaw(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeRaw(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // A lost cosmetic preference must never surface as an app error.
  }
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Re-read a parked value. Returns true when the bytes now decode into something
 * this build understands and have been put back under the original key.
 */
/**
 * Re-read a parked value, optionally with a different expected shape (a newer
 * build may understand what an older one rejected). Returns true only when the
 * bytes are now understood *and* have been written back under the original key.
 */
export async function restoreQuarantined(key: string, kind?: DataKind): Promise<boolean> {
  const entry = issues.get(key) ?? (await readRecoveryList()).find((e) => e.key === key);
  if (!entry) return false;
  const outcome = inspectRaw(entry.raw, kind ?? entry.kind);
  if (outcome.status !== 'current' && outcome.status !== 'legacy') return false;
  await writeJSON(key, outcome.value);
  issues.delete(key);
  const list = await readRecoveryList();
  await writeRecoveryList(list.filter((e) => e.key !== key));
  return true;
}

/** Explicitly throw away a parked value (used by "discard" in diagnostics). */
export async function discardQuarantined(key: string): Promise<void> {
  issues.delete(key);
  const list = await readRecoveryList();
  await writeRecoveryList(list.filter((e) => e.key !== key));
}

/** Test/diagnostic helper: forget in-memory issues without touching disk. */
export function resetStorageIssueRegistry(): void {
  issues.clear();
}
