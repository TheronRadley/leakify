/**
 * Export → restore round trip (audit U-01). The important properties: the
 * preview never lies about what will happen, a bad row cannot abort the rest,
 * and nothing from the file can smuggle in another user's identity.
 */
import {
  analyzeImport,
  buildExportPayload,
  EXPORT_APP_ID,
  EXPORT_FORMAT_VERSION,
  toSubscriptionInput,
} from '@/features/subscriptions/import-export';
import type { Profile, Subscription } from '@/types';

const SCOPE = 'local-user';

function sub(partial: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    userId: 'whoever-exported-it',
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amountCents: 1549,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: '2026-11-01',
    trialEndDate: null,
    status: 'active',
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3, 1], trialLeadDays: [] },
    flaggedUnused: false,
    isCancelCandidate: false,
    canceledAt: null,
    archivedAt: null,
    priceHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

const profile: Profile = {
  id: 'whoever-exported-it',
  displayName: 'Ana',
  preferredCurrency: 'EUR',
  locale: 'de-DE',
  timezone: 'Europe/Berlin',
  themePreference: 'dark',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function analyze(payload: unknown, existing: Subscription[] = []) {
  return analyzeImport(JSON.stringify(payload), { existing, scope: SCOPE });
}

describe('round trip', () => {
  it('restores exactly what was exported', () => {
    const payload = buildExportPayload(profile, [sub(), sub({ id: 'sub-2', name: 'Spotify' })]);
    const result = analyze(payload);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toCreate).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.profile?.displayName).toBe('Ana');
  });

  it('keeps the export self-describing', () => {
    const payload = buildExportPayload(profile, [], '2026-10-12T00:00:00.000Z');
    expect(payload).toMatchObject({
      app: EXPORT_APP_ID,
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: '2026-10-12T00:00:00.000Z',
    });
  });

  it('re-owns every row to the importing scope', () => {
    const result = analyze(buildExportPayload(null, [sub()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toCreate[0].userId).toBe(SCOPE);
    expect(result.toCreate[0].userId).not.toBe('whoever-exported-it');
  });

  it('ignores the exported profile id and keeps only profile fields', () => {
    const result = analyze({
      app: EXPORT_APP_ID,
      subscriptions: [],
      profile: { ...profile, id: 'someone-else', isAdmin: true },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile).toMatchObject({ id: SCOPE, displayName: 'Ana', preferredCurrency: 'EUR' });
    expect(result.profile).not.toHaveProperty('isAdmin');
  });

  it('still reads a 1.0.0 export that has no formatVersion', () => {
    const legacy = { exportedAt: '2026-01-01', app: 'leakify', profile: null, subscriptions: [sub()] };
    const result = analyze(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toCreate).toHaveLength(1);
  });
});

describe('refusing payloads it cannot honour', () => {
  it.each([
    ['not json at all', 'not valid JSON'],
    ['[]', 'JSON object'],
    ['{"app":"otherapp","subscriptions":[]}', 'not by Leakify'],
    ['{"subscriptions":"nope"}', 'no "subscriptions"'],
  ])('rejects %s with a usable message', (raw, expected) => {
    const result = analyzeImport(raw, { existing: [], scope: SCOPE });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(expected);
  });

  it('refuses an export from a newer app version instead of half-importing', () => {
    const result = analyze({ app: 'leakify', formatVersion: 99, subscriptions: [sub()] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('newer version of Leakify');
  });
});

describe('previewing duplicates and bad rows', () => {
  it('reports a collision on id', () => {
    const existing = [sub()];
    const result = analyze(buildExportPayload(null, [sub()]), existing);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicates).toEqual([{ subscription: expect.anything(), existingId: 'sub-1', matchedOn: 'id' }]);
    expect(result.toCreate).toHaveLength(0);
  });

  it('reports a collision on name + currency + amount even with a new id', () => {
    const existing = [sub()];
    const result = analyze(buildExportPayload(null, [sub({ id: 'different-id' })]), existing);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicates[0]).toMatchObject({ matchedOn: 'name+amount', existingId: 'sub-1' });
  });

  it('does not treat a price change as a duplicate', () => {
    const result = analyze(buildExportPayload(null, [sub({ id: 'x', amountCents: 1799 })]), [sub()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.duplicates).toHaveLength(0);
    expect(result.toCreate).toHaveLength(1);
  });

  it('lists unreadable rows and still imports the rest', () => {
    const payload = buildExportPayload(null, [sub(), sub({ id: 'sub-2' })]);
    (payload.subscriptions as unknown[])[1] = { name: 'Broken' };

    const result = analyze(payload);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.toCreate).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0]).toMatchObject({ index: 1, name: 'Broken' });
    expect(result.summary).toContain('1 new');
    expect(result.summary).toContain('1 unreadable');
  });

  it('summarises pluralisation correctly for one row', () => {
    const result = analyze(buildExportPayload(null, [sub()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toContain('1 new, 0 already present, 0 unreadable — subscription.');
  });
});

describe('toSubscriptionInput', () => {
  it('drops the identity and audit fields a repository assigns itself', () => {
    const input = toSubscriptionInput(sub());
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('userId');
    expect(input).not.toHaveProperty('createdAt');
    expect(input).not.toHaveProperty('updatedAt');
    expect(input).toMatchObject({ name: 'Netflix', amountCents: 1549 });
  });
});
