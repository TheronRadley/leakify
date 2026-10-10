import { detectLeaks, findDuplicateCandidates, nameSimilarity } from '@/features/subscriptions/leak-detector';
import type { Subscription } from '@/types';

const REF = '2026-10-10';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'user',
    name: 'Service',
    provider: null,
    category: 'other',
    amountCents: 1000,
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
    reminders: { enabled: true, renewalLeadDays: [], trialLeadDays: [] },
    flaggedUnused: false,
    isCancelCandidate: false,
    canceledAt: null,
    archivedAt: null,
    priceHistory: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('nameSimilarity', () => {
  it('scores identical / contained names high', () => {
    expect(nameSimilarity('HBO Max', 'HBO Max')).toBe(1);
    expect(nameSimilarity('Apple iCloud', 'iCloud+')).toBeGreaterThanOrEqual(0.85);
  });
  it('scores unrelated names low', () => {
    expect(nameSimilarity('Netflix', 'Spotify')).toBeLessThan(0.3);
  });
});

describe('findDuplicateCandidates', () => {
  it('flags near-identical services with evidence', () => {
    const candidates = findDuplicateCandidates([
      sub({ id: 'a', name: 'iCloud+ 200GB', provider: 'Apple', category: 'cloud_storage' }),
      sub({ id: 'b', name: 'Apple iCloud Storage', provider: 'Apple', category: 'cloud_storage' }),
      sub({ id: 'c', name: 'Netflix', provider: 'Netflix', category: 'streaming' }),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].reasons.length).toBeGreaterThan(0);
    expect(new Set([candidates[0].a.id, candidates[0].b.id])).toEqual(new Set(['a', 'b']));
  });

  it('does not flag unrelated services in the same category (no false alarms)', () => {
    const candidates = findDuplicateCandidates([
      sub({ name: 'Netflix', category: 'streaming' }),
      sub({ name: 'Hulu', category: 'streaming' }),
      sub({ name: 'Disney+', category: 'streaming' }),
    ]);
    expect(candidates).toHaveLength(0);
  });

  it('ignores canceled and archived records', () => {
    const candidates = findDuplicateCandidates([
      sub({ name: 'HBO Max', status: 'canceled' }),
      sub({ name: 'HBO Max Standard', status: 'active' }),
    ]);
    expect(candidates).toHaveLength(0);
  });
});

describe('detectLeaks', () => {
  it('surfaces trials expiring soon with urgency', () => {
    const findings = detectLeaks({
      subscriptions: [sub({ id: 't', name: 'Figma', status: 'trialing', trialEndDate: '2026-10-11', nextBillingDate: '2026-10-11' })],
      refISO: REF,
      upcoming7dTotals: [],
    });
    const trial = findings.find((f) => f.kind === 'trial_ending')!;
    expect(trial.severity).toBe('urgent');
    expect(trial.title).toContain('tomorrow');
    expect(trial.explanation).toMatch(/review/i);
  });

  it('reports missing billing dates as an actionable fix', () => {
    const findings = detectLeaks({
      subscriptions: [sub({ name: 'Utility Co', nextBillingDate: null })],
      refISO: REF,
      upcoming7dTotals: [],
    });
    expect(findings.some((f) => f.kind === 'missing_billing_date')).toBe(true);
  });

  it('only reports unused subscriptions when the user flagged them', () => {
    const flagged = detectLeaks({
      subscriptions: [sub({ name: 'Audible', flaggedUnused: true })],
      refISO: REF,
      upcoming7dTotals: [],
    });
    expect(flagged.some((f) => f.kind === 'flagged_unused')).toBe(true);

    const unflagged = detectLeaks({
      subscriptions: [sub({ name: 'Audible', flaggedUnused: false })],
      refISO: REF,
      upcoming7dTotals: [],
    });
    expect(unflagged.some((f) => f.kind === 'flagged_unused')).toBe(false);
  });

  it('flags large upcoming totals per currency', () => {
    const findings = detectLeaks({
      subscriptions: [],
      refISO: REF,
      upcoming7dTotals: [{ currency: 'USD', amountCents: 15_000 }],
    });
    expect(findings.some((f) => f.kind === 'large_upcoming_total')).toBe(true);
  });

  it('reports price increases only from recorded history', () => {
    const withHistory = sub({
      name: 'Netflix',
      amountCents: 1549,
      priceHistory: [{ amountCents: 1399, currency: 'USD', effectiveFrom: '2025-01-15' }],
    });
    const findings = detectLeaks({ subscriptions: [withHistory], refISO: REF, upcoming7dTotals: [] });
    expect(findings.some((f) => f.kind === 'price_increase')).toBe(true);

    const withoutHistory = detectLeaks({ subscriptions: [sub({ name: 'X', amountCents: 99999 })], refISO: REF, upcoming7dTotals: [] });
    expect(withoutHistory.some((f) => f.kind === 'price_increase')).toBe(false);
  });

  it('produces nothing for a healthy subscription set', () => {
    const findings = detectLeaks({
      subscriptions: [sub({ name: 'Netflix' })],
      refISO: REF,
      upcoming7dTotals: [],
    });
    expect(findings).toHaveLength(0);
  });
});
