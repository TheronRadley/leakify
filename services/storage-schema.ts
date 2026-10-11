/**
 * Local storage schema: versioning, shape validation and recovery decisions.
 *
 * Why this exists: `readJSON()` used to answer "corrupt JSON", "a shape from a
 * future build" and "genuinely empty account" identically — with the fallback.
 * A half-written key or a downgrade was therefore indistinguishable from a new
 * install, and the next save would overwrite the remains. That is silent data
 * loss, and for a local-first app it is the worst failure mode available.
 *
 * This module is pure (no AsyncStorage, no React Native) so every branch is unit
 * tested in Node. `services/local-storage.ts` supplies the I/O.
 */
import type { BillingEvent, NotificationSettings, Profile, ScheduledNotification, Subscription } from '@/types';

/** Bump when the persisted shape changes, and add a `migrate()` case. */
export const STORAGE_SCHEMA_VERSION = 1;

export type DataKind =
  | 'unknown'
  | 'subscriptions'
  | 'profile'
  | 'notificationSettings'
  | 'scheduledNotifications'
  | 'billingEvents'
  | 'flag';

/** Envelope written by this build. Un-enveloped values are legacy (version 0). */
export interface Envelope {
  v: number;
  data: unknown;
}

export type StorageStatus =
  /** Key does not exist — a genuinely fresh scope. */
  | 'absent'
  /** Envelope of the current version with a valid shape. */
  | 'current'
  /** Pre-versioning value that this build accepts and will upgrade on write. */
  | 'legacy'
  /** Valid JSON, wrong shape for the key (or unparseable JSON). */
  | 'invalid'
  /** Written by a newer build; never guessed at, never overwritten silently. */
  | 'unsupported_version';

export interface ReadOutcome<T> {
  status: StorageStatus;
  /** `null` means "use the caller's fallback"; never a fabricated account. */
  value: T | null;
  /** Present when the stored bytes should not be trusted or discarded. */
  details?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isISODate = (value: unknown): boolean =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/* ---------- per-kind shape validators ---------- */

function isSubscription(value: unknown): value is Subscription {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.name === 'string' &&
    Number.isInteger(value.amountCents) &&
    typeof value.currency === 'string' &&
    /^[A-Z]{3}$/.test(value.currency as string) &&
    isRecord(value.interval) &&
    Number.isInteger(value.interval.every) &&
    typeof value.interval.unit === 'string' &&
    ['active', 'trialing', 'paused', 'canceled'].includes(String(value.status)) &&
    (value.priceHistory === undefined || Array.isArray(value.priceHistory))
  );
}

function isProfile(value: unknown): value is Profile {
  return isRecord(value) && typeof value.id === 'string' && typeof value.displayName === 'string';
}

function isNotificationSettings(value: unknown): value is NotificationSettings {
  return (
    isRecord(value) &&
    Array.isArray(value.renewalLeadDays) &&
    value.renewalLeadDays.every((n) => Number.isInteger(n)) &&
    Array.isArray(value.trialLeadDays) &&
    typeof value.weeklyDigestEnabled === 'boolean'
  );
}

function isScheduledNotification(value: unknown): value is ScheduledNotification {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.osNotificationId === 'string' &&
    ['scheduled', 'canceled'].includes(String(value.status))
  );
}

function isBillingEvent(value: unknown): value is BillingEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.subscriptionId === 'string' &&
    Number.isInteger(value.amountCents) &&
    (isISODate(value.expectedDate) || typeof value.expectedDate === 'string')
  );
}

/** True when `value` is a usable payload for `kind`. `unknown` accepts any JSON. */
export function validateShape(kind: DataKind, value: unknown): boolean {
  switch (kind) {
    case 'subscriptions':
      return Array.isArray(value) && value.every(isSubscription);
    case 'billingEvents':
      return Array.isArray(value) && value.every(isBillingEvent);
    case 'scheduledNotifications':
      return Array.isArray(value) && value.every(isScheduledNotification);
    case 'profile':
      // `null` is a legitimate stored value ("no profile yet").
      return value === null || isProfile(value);
    case 'notificationSettings':
      return value === null || isNotificationSettings(value);
    case 'flag':
      return typeof value === 'boolean' || typeof value === 'string';
    default:
      return true;
  }
}

/** Wrap a value for writing. */
export function wrapEnvelope<T>(value: T): Envelope {
  return { v: STORAGE_SCHEMA_VERSION, data: value };
}

function isEnvelope(value: unknown): value is Envelope {
  if (!isRecord(value)) return false;
  const candidate: Partial<Envelope> = { v: value.v as number | undefined, data: value.data };
  return typeof candidate.v === 'number' && 'data' in value;
}

/**
 * Migration entry point. Version 0 (pre-envelope) and version 1 are both
 * understood, so the only real migration is "adopt the legacy shape". Add a
 * case here for every future version, keeping each step forward-only.
 */
export function migrateValue(kind: DataKind, value: unknown, fromVersion: number): unknown {
  void kind;
  void fromVersion;
  return value;
}

/**
 * Interpret the raw string read from storage. This function never writes, never
 * throws and never loses information: `invalid` / `unsupported_version` outcomes
 * tell the caller to quarantine the bytes instead of overwriting them.
 */
export function inspectRaw<T>(raw: string | null, kind: DataKind): ReadOutcome<T> {
  if (raw === null || raw === '') return { status: 'absent', value: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { status: 'invalid', value: null, details: err instanceof Error ? err.name : 'SyntaxError' };
  }

  if (isEnvelope(parsed)) {
    const version = parsed.v;
    if (version > STORAGE_SCHEMA_VERSION) {
      return {
        status: 'unsupported_version',
        value: null,
        details: `stored v${version} > app v${STORAGE_SCHEMA_VERSION}`,
      };
    }
    if (version < 1) {
      return { status: 'invalid', value: null, details: `envelope version ${version} is not readable` };
    }
    const data = migrateValue(kind, parsed.data, version) as T;
    if (!validateShape(kind, data)) {
      return { status: 'invalid', value: null, details: `payload does not match ${kind}` };
    }
    return { status: 'current', value: data };
  }

  // Legacy, un-enveloped payload from before schema versioning.
  const data = migrateValue(kind, parsed, 0) as T;
  if (!validateShape(kind, data)) {
    return { status: 'invalid', value: null, details: `legacy payload does not match ${kind}` };
  }
  return { status: 'legacy', value: data };
}

/** Describe an outcome for logs/diagnostics without leaking stored values. */
export function describeIssue(raw: string | null, outcome: ReadOutcome<unknown>): { bytes: number; status: string } {
  return { bytes: raw ? raw.length : 0, status: outcome.status };
}
