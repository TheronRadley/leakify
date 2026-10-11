/**
 * Mode-transition rules — the policy that decides what happens to data when a
 * user moves between on-device ("local") and cloud ("supabase") modes.
 *
 * The product rule this encodes (audit U-04 / N-03): a mode switch must never
 * silently orphan or destroy records.
 * - Signing in to cloud does **not** upload local records. It is offered, with the
 *   duplicate rule stated up front, and the local copy stays where it was.
 * - Switching back to local mode does **not** delete cloud rows; it only changes
 *   which store the UI reads.
 * - Counts are always taken from the two stores, never guessed, so the copy in the
 *   UI can be trusted.
 *
 * Everything here is pure so the dedupe rule and the wording are unit tested; the
 * store performs the actual repository calls.
 */
import type { BillingIntervalValue, Subscription } from '@/types';

/** Fields that identify "the same subscription" when merging two stores. */
export interface PromotableSubscription {
  name: string;
  amountCents: number;
  currency: string;
  interval: BillingIntervalValue;
  nextBillingDate: string | null;
  status?: Subscription['status'];
  priceHistory?: Subscription['priceHistory'];
}

export interface PromotionPlan<T = PromotableSubscription> {
  /** Local records with no cloud counterpart yet, in their original order. */
  create: T[];
  /** Local records deliberately left alone because the cloud already has them. */
  skipped: T[];
}

/**
 * A duplicate key that survives a rename-with-typo but not a coincidence:
 * service name + amount + currency + the next date, plus status when it is not the
 * default. Two genuinely identical subscriptions are *not* collapsed into one.
 */
export function promotionKey(record: PromotableSubscription): string {
  return [
    record.name.trim().toLowerCase(),
    String(record.amountCents),
    (record.currency ?? '').toUpperCase(),
    `${record.interval?.every ?? 1}:${record.interval?.unit ?? 'month'}`,
    record.nextBillingDate ?? '',
    record.status && record.status !== 'active' ? record.status : '',
  ].join('|');
}

export function buildPromotionPlan<T extends PromotableSubscription>(local: T[], cloud: T[]): PromotionPlan<T> {
  const remaining = new Map<string, number>();
  for (const record of cloud) {
    const key = promotionKey(record);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const create: T[] = [];
  const skipped: T[] = [];
  for (const record of local) {
    const key = promotionKey(record);
    const already = remaining.get(key) ?? 0;
    if (already > 0) {
      remaining.set(key, already - 1);
      skipped.push(record);
    } else {
      create.push(record);
    }
  }
  return { create, skipped };
}

export type ModeTransitionNotice = {
  /** `upload` offers to copy local records into the account; `switch` is informational. */
  action: 'upload' | 'switch' | null;
  title: string;
  body: string;
};

export interface ModeTransitionInput {
  mode: 'local' | 'demo' | 'supabase';
  isSignedIn: boolean;
  /** Local records the account does not already hold (excluding seeded demo data). */
  localOnlyCount: number;
  /** Records in the cloud account that this mode is not reading. */
  cloudOnlyCount: number;
}

/**
 * What the user should be told about the *other* store right now, or `null` when
 * there is nothing to disclose. Never invents a count.
 */
export function describeModeTransition({
  mode,
  isSignedIn,
  localOnlyCount,
  cloudOnlyCount,
}: ModeTransitionInput): ModeTransitionNotice | null {
  if (mode === 'supabase') {
    if (localOnlyCount <= 0) return null;
    return {
      action: 'upload',
      title: `${localOnlyCount} ${localOnlyCount === 1 ? 'subscription is' : 'subscriptions are'} still only on this device`,
      body:
        'Signing in did not upload them. You can copy them into your account now; the on-device list stays as it is, so nothing is moved or removed.',
    };
  }

  if (mode === 'demo') {
    if (!isSignedIn || cloudOnlyCount <= 0) return null;
    return {
      action: 'switch',
      title: `Your account has ${cloudOnlyCount} ${cloudOnlyCount === 1 ? 'subscription' : 'subscriptions'} you are not viewing`,
      body: `Demo records live on this device only and are never uploaded${
        localOnlyCount > 0
          ? `; the ${localOnlyCount} real ${localOnlyCount === 1 ? 'subscription is' : 'subscriptions are'} on this device too`
          : ''
      }. Switch to cloud mode to see the account records again.`,
    };
  }

  // local mode while signed in: the account is not being read
  if (!isSignedIn || cloudOnlyCount <= 0) return null;
  return {
    action: 'switch',
    title: `Your account has ${cloudOnlyCount} ${cloudOnlyCount === 1 ? 'subscription' : 'subscriptions'} you are not viewing`,
    body: 'This mode reads only what is on this device. Nothing was deleted — switch to cloud mode to see the account records again.',
  };
}

export interface PromotionOutcome {
  created: number;
  skipped: number;
  failed: number;
  error?: string;
}

/** How to describe a promotion run without over-claiming what happened. */
export function describePromotion(outcome: PromotionOutcome): string {
  if (outcome.error && outcome.created === 0) return outcome.error;
  const parts = [outcome.created === 1 ? '1 subscription copied' : `${outcome.created} subscriptions copied`];
  if (outcome.skipped > 0) parts.push(`${outcome.skipped} already in your account`);
  if (outcome.failed > 0) parts.push(`${outcome.failed} failed and stayed on this device`);
  else parts.push('the on-device list was left untouched');
  return `${parts.join(', ')}.`;
}
