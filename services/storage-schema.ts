/**
 * Zod shapes for everything Leakify persists locally.
 *
 * Why this exists (audit R-01): `readJSON` used to catch every parse error and
 * return the fallback, so data written by an older (or newer) app version read
 * back as "no subscriptions" — an empty screen with the real data still sitting
 * in storage. Validating on read turns that into a visible error instead.
 *
 * Every field that could be missing from an older payload carries a default, so
 * upgrading never throws on data that is merely old. A field that is missing
 * and has NO default means the payload is not Leakify data, and must fail.
 */
import { z } from 'zod';

const nullableString = z.string().nullable().default(null);

export const billingIntervalSchema = z.object({
  every: z.number().int().min(1),
  unit: z.enum(['day', 'week', 'month', 'year']),
});

export const reminderPreferencesSchema = z.object({
  enabled: z.boolean(),
  renewalLeadDays: z.array(z.number().int()),
  trialLeadDays: z.array(z.number().int()),
});

export const pricePointSchema = z.object({
  amountCents: z.number().int(),
  currency: z.string(),
  effectiveFrom: z.string(),
});

export const subscriptionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  name: z.string(),
  provider: nullableString,
  category: z.enum([
    'streaming',
    'music',
    'software',
    'cloud_storage',
    'gaming',
    'fitness',
    'shopping',
    'utilities',
    'education',
    'other',
  ]),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  interval: billingIntervalSchema,
  startDate: nullableString,
  nextBillingDate: nullableString,
  trialEndDate: nullableString,
  status: z.enum(['active', 'trialing', 'paused', 'canceled']),
  paymentMethodLabel: nullableString,
  cancellationUrl: nullableString,
  cancellationNotes: nullableString,
  notes: nullableString,
  reminders: reminderPreferencesSchema,
  flaggedUnused: z.boolean().default(false),
  isCancelCandidate: z.boolean().default(false),
  canceledAt: nullableString,
  archivedAt: nullableString,
  priceHistory: z.array(pricePointSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const billingEventSchema = z.object({
  id: z.string().min(1),
  subscriptionId: z.string().min(1),
  userId: z.string().min(1),
  expectedDate: z.string(),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  type: z.enum(['first_charge', 'renewal', 'trial_end']),
  status: z.enum(['expected', 'charged', 'skipped', 'canceled']),
  actualDate: nullableString,
  actualAmountCents: z.number().int().nullable().default(null),
  createdAt: z.string(),
});

export const scheduledNotificationSchema = z.object({
  key: z.string().min(1),
  subscriptionId: nullableString,
  type: z.enum(['renewal', 'trial', 'weekly_digest']),
  occurrenceDate: z.string(),
  leadDays: z.number().int(),
  triggerAt: z.string(),
  osNotificationId: z.string(),
  status: z.enum(['scheduled', 'canceled']),
  createdAt: z.string(),
});

export const profileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string(),
  preferredCurrency: z.string().length(3),
  locale: z.string(),
  timezone: z.string(),
  themePreference: z.enum(['system', 'light', 'dark']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** `genericLockScreenText` arrived in schema v2 — older payloads lack it. */
export const notificationSettingsSchema = z.object({
  renewalLeadDays: z.array(z.number().int()),
  trialLeadDays: z.array(z.number().int()),
  weeklyDigestEnabled: z.boolean(),
  genericLockScreenText: z.boolean().default(false),
  permissionStatus: z.enum(['unknown', 'granted', 'denied']).default('unknown'),
});

/** Every stored payload kind, keyed for the reader in services/local-storage. */
export const storageSchemas = {
  subscriptions: z.array(subscriptionSchema),
  billingEvents: z.array(billingEventSchema),
  scheduledNotifications: z.array(scheduledNotificationSchema),
  profile: profileSchema,
  notificationSettings: notificationSettingsSchema,
} as const;

export type StorageKind = keyof typeof storageSchemas;

/** Parse a stored payload, or throw with the reason. Never returns undefined. */
export function parseStored<T extends StorageKind>(kind: T, value: unknown): unknown {
  return storageSchemas[kind].parse(value);
}

/** Non-throwing shape check, for callers that only need a boolean. */
export function isStoredShape(kind: StorageKind, value: unknown): boolean {
  return storageSchemas[kind].safeParse(value).success;
}
