/**
 * Thin typed wrapper over AsyncStorage for local / demo mode persistence.
 * Keys are namespaced per user scope so demo data stays separate from real
 * user data (`demo` vs user ids).
 *
 * Two guarantees this module owns (audit R-01):
 *  1. A stored payload that exists but cannot be parsed or does not match its
 *     schema THROWS (StorageCorruptionError) instead of quietly returning the
 *     fallback. An empty screen that hides the user's real data is worse than
 *     an error message they can act on.
 *  2. The payload shape is versioned. Data written by a NEWER build is refused
 *     loudly rather than partially read; data written by an older build is
 *     migrated forward (see MIGRATIONS).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseStored, storageSchemas, type StorageKind } from '@/services/storage-schema';
import type { z } from 'zod';

const PREFIX = 'leakify';

/**
 * Payload shape version. 1 = the 1.0.0 release shape; no version key was
 * written back then, so an absent key means "1".
 */
export const CURRENT_SCHEMA_VERSION = 2;

export const storageKeys = {
  onboardingCompleted: `${PREFIX}.onboarding.completed`,
  dataMode: `${PREFIX}.data.mode`,
  theme: `${PREFIX}.theme`,
  schemaVersion: `${PREFIX}.storage.schemaVersion`,
  subscriptions: (scope: string) => `${PREFIX}.subscriptions.${scope}`,
  profile: (scope: string) => `${PREFIX}.profile.${scope}`,
  notificationSettings: (scope: string) => `${PREFIX}.notifications.settings.${scope}`,
  scheduledNotifications: (scope: string) => `${PREFIX}.notifications.scheduled.${scope}`,
  billingEvents: (scope: string) => `${PREFIX}.billing.events.${scope}`,
};

/** A key exists but its contents are not readable/valid Leakify data. */
export class StorageCorruptionError extends Error {
  constructor(
    readonly key: string,
    reason: string,
  ) {
    super(`Saved data under "${key}" could not be read (${reason}). Nothing was deleted — export your data from Settings after updating the app, or contact support@leakify.app.`);
    this.name = 'StorageCorruptionError';
  }
}

/** Data was written by a build that understands a newer payload shape. */
export class StorageVersionError extends Error {
  constructor(stored: number, supported: number) {
    super(
      `This data was saved by a newer version of Leakify (data format v${stored}; this build supports v${supported}). Update the app before opening it.`,
    );
    this.name = 'StorageVersionError';
  }
}

/** Output type of a stored payload, with schema defaults applied. */
export type StoredValue<T extends StorageKind> = z.infer<(typeof storageSchemas)[T]>;

/**
 * Read a scalar key. Absent → `fallback`. Present but unparseable → throws.
 * (Callers that must not fail — the boot path — wrap this themselves and say
 * why.)
 */
export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new StorageCorruptionError(key, 'not valid JSON');
  }
}

/** Validate one raw value; `null` means the key was absent. */
async function readValidated<T extends StorageKind>(
  kind: T,
  key: string,
): Promise<StoredValue<T> | null> {
  const raw = await AsyncStorage.getItem(key);
  if (raw === null || raw === undefined) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageCorruptionError(key, 'not valid JSON');
  }
  const result = storageSchemas[kind].safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` at "${issue.path.join('.')}"` : '';
    throw new StorageCorruptionError(key, `unexpected shape${where}`);
  }
  return result.data as StoredValue<T>;
}

/** Read a structured payload and validate it against its schema. */
export async function readStored<T extends StorageKind>(
  kind: T,
  key: string,
  fallback: StoredValue<T>,
): Promise<StoredValue<T>> {
  return (await readValidated(kind, key)) ?? fallback;
}

/** Same, for keys that may legitimately not exist yet (profile, settings). */
export async function readStoredOrNull<T extends StorageKind>(
  kind: T,
  key: string,
): Promise<StoredValue<T> | null> {
  return readValidated(kind, key);
}

/** Strictly-typed convenience used by repositories. */
export function parseStoredPayload<T extends StorageKind>(kind: T, value: unknown): unknown {
  return parseStored(kind, value);
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/** All keys this app owns. Used by migrations and by "delete everything". */
export async function listOwnedKeys(): Promise<string[]> {
  const all = await AsyncStorage.getAllKeys();
  return all.filter((key) => key.startsWith(`${PREFIX}.`));
}

export interface MigrationContext {
  listOwnedKeys(): Promise<string[]>;
}

interface Migration {
  from: number;
  to: number;
  /** Describe what changed — this is what a reader needs to trust the list. */
  description: string;
  run(ctx: MigrationContext): Promise<void>;
}

/**
 * Ordered list of payload-shape migrations. Nothing to rewrite is a legitimate
 * entry: v2 only ADDED `notificationSettings.genericLockScreenText`, which the
 * read schema defaults, so existing payloads stay valid untouched. The entry is
 * kept so the version history stays readable and so a future migration has a
 * place to hang off.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    to: 2,
    description: 'Added notificationSettings.genericLockScreenText (defaulted on read; no rewrite needed).',
    run: async () => undefined,
  },
];

/**
 * Bring stored data up to the shape this build understands. Idempotent: safe
 * to call on every start. Refuses data from a newer build instead of reading it
 * half-way.
 */
export async function migrateLocalStorage(): Promise<number> {
  const stored = await readJSON<unknown>(storageKeys.schemaVersion, 1);
  if (typeof stored !== 'number' || !Number.isInteger(stored) || stored < 1) {
    throw new StorageCorruptionError(storageKeys.schemaVersion, `not a version number (got ${JSON.stringify(stored)})`);
  }
  if (stored > CURRENT_SCHEMA_VERSION) throw new StorageVersionError(stored, CURRENT_SCHEMA_VERSION);
  if (stored === CURRENT_SCHEMA_VERSION) return stored;

  const ctx: MigrationContext = { listOwnedKeys };
  for (const migration of MIGRATIONS) {
    if (migration.from >= stored && migration.to <= CURRENT_SCHEMA_VERSION) {
      await migration.run(ctx);
    }
  }
  await writeJSON(storageKeys.schemaVersion, CURRENT_SCHEMA_VERSION);
  return CURRENT_SCHEMA_VERSION;
}

/** The version currently recorded in storage (1 when nothing was written). */
export async function getStoredSchemaVersion(): Promise<number> {
  const stored = await readJSON<unknown>(storageKeys.schemaVersion, 1);
  return typeof stored === 'number' ? stored : 1;
}
