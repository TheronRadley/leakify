/** Shared fixtures for notification-engine tests. Not a test file (no .test.ts). */
import type { Subscription } from '@/types';

/** A fixed local-clock "now": a Saturday at noon. */
export const NOW = '2026-10-10T12:00:00';

export function sub(partial: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    userId: 'user',
    name: 'Netflix',
    provider: null,
    category: 'streaming',
    amountCents: 1549,
    currency: 'USD',
    interval: { every: 1, unit: 'month' },
    startDate: '2026-01-01',
    nextBillingDate: '2026-10-13',
    trialEndDate: null,
    status: 'active',
    paymentMethodLabel: null,
    cancellationUrl: null,
    cancellationNotes: null,
    notes: null,
    reminders: { enabled: true, renewalLeadDays: [3, 1, 0], trialLeadDays: [1] },
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
