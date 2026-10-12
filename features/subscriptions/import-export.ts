/**
 * Export / restore for Leakify data (audit U-01).
 *
 * Export already existed; restore did not, which meant a local-only user had no
 * way back after an uninstall or a new phone. This module is the pure half of
 * both directions:
 *
 *  - `buildExportPayload` produces the payload Settings shares.
 *  - `analyzeImport` parses and VALIDATES a pasted payload and returns a
 *    preview (what would be imported, what is a duplicate, what is unusable)
 *    without writing anything. Nothing is applied until the user confirms.
 *  - Applying happens in the store (`importSubscriptions`), which owns writes.
 *
 * Deliberate rules:
 *  - A payload from a newer app version is refused, not half-imported.
 *  - `userId` from the file is ignored: rows are re-owned by the active scope,
 *    so an export can never smuggle in another user's id.
 *  - One bad row does not fail the import; it is listed in `invalid` and the
 *    rest still imports. The user sees the count before confirming.
 *  - Rollback: the preview is the safety net (no partial writes happen before
 *    confirmation), and the caller keeps the original text so it can be
 *    re-imported after a failed run.
 */
import { subscriptionSchema } from '@/services/storage-schema';
import type { Profile, Subscription } from '@/types';

export const EXPORT_APP_ID = 'leakify';

/** Payload format version. Bumped when the shape changes; older payloads read. */
export const EXPORT_FORMAT_VERSION = 1;

export interface ExportPayload {
  app: typeof EXPORT_APP_ID;
  formatVersion: number;
  exportedAt: string;
  profile: Profile | null;
  subscriptions: Subscription[];
  /** Optional: billing history, when the caller has it. */
  billingEvents?: unknown[];
}

export function buildExportPayload(
  profile: Profile | null,
  subscriptions: Subscription[],
  nowISO = new Date().toISOString(),
): ExportPayload {
  return {
    app: EXPORT_APP_ID,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: nowISO,
    profile,
    subscriptions,
  };
}

export type ImportDuplicateStrategy = 'skip' | 'replace';

export interface ImportIssue {
  /** Position in the payload's subscriptions array. */
  index: number;
  name: string;
  reason: string;
}

export interface ImportDuplicate {
  subscription: Subscription;
  /** Id of the row already in the target scope (needed to replace it). */
  existingId: string;
  /** Which existing row it collided with. */
  matchedOn: 'id' | 'name+amount';
}

export type ImportAnalysis =
  | { ok: false; error: string }
  | {
      ok: true;
      /** Rows that parsed cleanly and are not duplicates. */
      toCreate: Subscription[];
      /** Rows that collide with an existing subscription. */
      duplicates: ImportDuplicate[];
      /** Rows that could not be parsed; never imported. */
      invalid: ImportIssue[];
      profile: Profile | null;
      summary: string;
    };

interface AnalyzeContext {
  /** Subscriptions already in the target scope. */
  existing: Pick<Subscription, 'id' | 'name' | 'amountCents' | 'currency'>[];
  /** Scope the imported rows will belong to. */
  scope: string;
}

/**
 * Parse a pasted/loaded export and describe exactly what importing it would do.
 * Never throws and never writes.
 */
export function analyzeImport(raw: string, ctx: AnalyzeContext): ImportAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That is not valid JSON. Paste the whole file exactly as it was exported.' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'A Leakify export is a JSON object. This is not one.' };
  }
  const payload = parsed as Record<string, unknown>;

  if (payload.app !== undefined && payload.app !== EXPORT_APP_ID) {
    return {
      ok: false,
      error: `This file was exported by "${String(payload.app)}", not by Leakify. Leakify only restores its own exports.`,
    };
  }

  const formatVersion = typeof payload.formatVersion === 'number' ? payload.formatVersion : 1;
  if (formatVersion > EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: `This export was created by a newer version of Leakify (format v${formatVersion}; this build reads v${EXPORT_FORMAT_VERSION}). Update the app and try again.`,
    };
  }

  if (!Array.isArray(payload.subscriptions)) {
    return { ok: false, error: 'This export has no "subscriptions" list, so there is nothing to restore.' };
  }

  const existingById = new Map(ctx.existing.map((s) => [s.id, s]));
  const existingByShape = new Map(
    ctx.existing.map((s) => [`${s.name.toLowerCase()}|${s.currency}|${s.amountCents}`, s]),
  );

  const toCreate: Subscription[] = [];
  const duplicates: ImportDuplicate[] = [];
  const invalid: ImportIssue[] = [];

  payload.subscriptions.forEach((entry, index) => {
    const result = subscriptionSchema.safeParse(entry);
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue?.path.length ? ` (${issue.path.join('.')})` : '';
      invalid.push({
        index,
        name: typeof (entry as { name?: unknown })?.name === 'string' ? String((entry as { name: string }).name) : `entry ${index + 1}`,
        reason: `Could not be read${where}.`,
      });
      return;
    }

    // Re-own the row: a file is untrusted input, and ids belong to a scope.
    const subscription: Subscription = { ...result.data, userId: ctx.scope };

    const byId = existingById.get(subscription.id);
    if (byId) {
      duplicates.push({ subscription, existingId: byId.id, matchedOn: 'id' });
      return;
    }
    const shapeKey = `${subscription.name.toLowerCase()}|${subscription.currency}|${subscription.amountCents}`;
    const byShape = existingByShape.get(shapeKey);
    if (byShape) {
      duplicates.push({ subscription, existingId: byShape.id, matchedOn: 'name+amount' });
      return;
    }
    toCreate.push(subscription);
    existingByShape.set(shapeKey, subscription);
  });

  const profile =
    typeof payload.profile === 'object' && payload.profile !== null
      ? normalizeProfile(payload.profile as Record<string, unknown>, ctx.scope)
      : null;

  const parts = [
    `${toCreate.length} new`,
    `${duplicates.length} already present`,
    `${invalid.length} unreadable`,
  ];
  return {
    ok: true,
    toCreate,
    duplicates,
    invalid,
    profile,
    summary: `${parts.join(', ')} — subscription${toCreate.length === 1 ? '' : 's'}.`,
  };
}

/** Only the fields a profile row may carry are taken from the file. */
function normalizeProfile(
  raw: Record<string, unknown>,
  scope: string,
): Profile | null {
  const displayName = typeof raw.displayName === 'string' ? raw.displayName : 'Leakify User';
  const preferredCurrency =
    typeof raw.preferredCurrency === 'string' && raw.preferredCurrency.length === 3
      ? raw.preferredCurrency.toUpperCase()
      : 'USD';
  const themePreference = ['system', 'light', 'dark'].includes(String(raw.themePreference))
    ? (raw.themePreference as Profile['themePreference'])
    : 'system';
  const now = new Date().toISOString();
  return {
    id: scope,
    displayName,
    preferredCurrency,
    locale: typeof raw.locale === 'string' ? raw.locale : 'en-US',
    timezone: typeof raw.timezone === 'string' ? raw.timezone : 'UTC',
    themePreference,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: now,
  };
}

/** Turn a validated imported row into what a repository create/update expects. */
export function toSubscriptionInput(subscription: Subscription) {
  const { id: _id, userId: _userId, createdAt: _c, updatedAt: _u, ...input } = subscription;
  return input;
}
