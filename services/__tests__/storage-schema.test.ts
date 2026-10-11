/**
 * Schema-versioning tests. The property under test is the distinction between
 * "nothing stored" and "something stored that we cannot trust" — the difference
 * between a fresh install and a destroyed account.
 */
import {
  STORAGE_SCHEMA_VERSION,
  inspectRaw,
  migrateValue,
  validateShape,
  wrapEnvelope,
} from '@/services/storage-schema';

const subscription = {
  id: 'sub-1',
  userId: 'local-user',
  name: 'Netflix',
  provider: null,
  category: 'streaming',
  amountCents: 1549,
  currency: 'USD',
  interval: { every: 1, unit: 'month' },
  startDate: '2026-01-01',
  nextBillingDate: '2026-02-01',
  trialEndDate: null,
  status: 'active',
  priceHistory: [],
};

describe('validateShape', () => {
  it('accepts a well-formed subscription list and rejects junk of the right container type', () => {
    expect(validateShape('subscriptions', [subscription])).toBe(true);
    expect(validateShape('subscriptions', [])).toBe(true);
    expect(validateShape('subscriptions', [{ id: 'x' }])).toBe(false);
    expect(validateShape('subscriptions', { not: 'an array' })).toBe(false);
    expect(validateShape('subscriptions', [subscription, 42])).toBe(false);
  });

  it('requires money to stay an integer minor unit', () => {
    expect(validateShape('subscriptions', [{ ...subscription, amountCents: 15.49 }])).toBe(false);
    expect(validateShape('subscriptions', [{ ...subscription, currency: 'usd' }])).toBe(false);
  });

  it('treats null as a legitimate profile/settings value', () => {
    expect(validateShape('profile', null)).toBe(true);
    expect(validateShape('notificationSettings', null)).toBe(true);
    expect(validateShape('profile', { id: 'u', displayName: 'Me' })).toBe(true);
    expect(validateShape('profile', { id: 'u' })).toBe(false);
  });

  it('rejects notification settings that lost their lead-day arrays', () => {
    expect(
      validateShape('notificationSettings', { renewalLeadDays: [3], trialLeadDays: [1], weeklyDigestEnabled: false }),
    ).toBe(true);
    expect(validateShape('notificationSettings', { renewalLeadDays: 'nope' })).toBe(false);
  });
});

describe('inspectRaw', () => {
  it('distinguishes an absent key from an empty one', () => {
    expect(inspectRaw(null, 'subscriptions')).toEqual({ status: 'absent', value: null });
    expect(inspectRaw('{"v":1,"data":[]}', 'subscriptions')).toMatchObject({ status: 'current', value: [] });
  });

  it('round-trips through wrapEnvelope', () => {
    const raw = JSON.stringify(wrapEnvelope([subscription]));
    const outcome = inspectRaw<typeof subscription[]>(raw, 'subscriptions');
    expect(outcome.status).toBe('current');
    expect(outcome.value?.[0]?.name).toBe('Netflix');
  });

  it('adopts pre-versioning (legacy) payloads instead of discarding them', () => {
    const outcome = inspectRaw<typeof subscription[]>(JSON.stringify([subscription]), 'subscriptions');
    expect(outcome.status).toBe('legacy');
    expect(outcome.value).toHaveLength(1);
    // Legacy data stays usable until the next write upgrades it in place.
    expect(migrateValue('subscriptions', outcome.value, 0)).toEqual(outcome.value);
  });

  it('refuses to pretend malformed JSON is an empty account', () => {
    const outcome = inspectRaw('[{"id": "sub-1"', 'subscriptions');
    expect(outcome.status).toBe('invalid');
    expect(outcome.value).toBeNull();
  });

  it('refuses a shape that does not match the key', () => {
    const outcome = inspectRaw('{"v":1,"data":{"hello":"world"}}', 'subscriptions');
    expect(outcome.status).toBe('invalid');
    expect(outcome.details).toContain('subscriptions');
  });

  it('refuses a payload from a newer app version rather than guessing', () => {
    const future = JSON.stringify({ v: STORAGE_SCHEMA_VERSION + 1, data: [subscription] });
    const outcome = inspectRaw(future, 'subscriptions');
    expect(outcome.status).toBe('unsupported_version');
    expect(outcome.value).toBeNull();
    expect(outcome.details).toContain(`v${STORAGE_SCHEMA_VERSION + 1}`);
  });

  it('rejects an impossible envelope version', () => {
    expect(inspectRaw('{"v":0,"data":[]}', 'subscriptions').status).toBe('invalid');
  });

  it('accepts any JSON for unknown kinds (used by flags)', () => {
    expect(inspectRaw('{"v":1,"data":true}', 'flag').status).toBe('current');
    expect(inspectRaw('"local"', 'flag').status).toBe('legacy');
    expect(inspectRaw('{"v":1,"data":{"a":1}}', 'flag').status).toBe('invalid');
  });
});
