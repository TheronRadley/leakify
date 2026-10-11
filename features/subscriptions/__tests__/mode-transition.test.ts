import {
  buildPromotionPlan,
  describeModeTransition,
  describePromotion,
  promotionKey,
  type PromotableSubscription,
} from '@/features/subscriptions/mode-transition';

const sub = (over: Partial<PromotableSubscription> = {}): PromotableSubscription => ({
  name: 'Netflix',
  amountCents: 1549,
  currency: 'USD',
  interval: { every: 1, unit: 'month' },
  nextBillingDate: '2026-11-03',
  status: 'active',
  ...over,
});

describe('promotionKey', () => {
  it('treats case, whitespace and currency case as the same record', () => {
    expect(promotionKey(sub({ name: ' netflix ', currency: 'usd' }))).toBe(promotionKey(sub()));
  });

  it('separates records that only look alike', () => {
    const keys = new Set([
      promotionKey(sub()),
      promotionKey(sub({ amountCents: 1749 })),
      promotionKey(sub({ nextBillingDate: '2026-11-04' })),
      promotionKey(sub({ interval: { every: 1, unit: 'year' } })),
      promotionKey(sub({ status: 'canceled' })),
    ]);
    expect(keys.size).toBe(5);
  });

  it('does not let a paused and a canceled record collide', () => {
    expect(promotionKey(sub({ status: 'paused' }))).not.toBe(promotionKey(sub({ status: 'canceled' })));
  });
});

describe('buildPromotionPlan', () => {
  it('offers everything when the account is empty', () => {
    const local = [sub(), sub({ name: 'Spotify', amountCents: 1199 })];
    const plan = buildPromotionPlan(local, []);
    expect(plan.create).toEqual(local);
    expect(plan.skipped).toEqual([]);
  });

  it('skips a record the account already holds and keeps the rest', () => {
    const local = [sub(), sub({ name: 'Spotify', amountCents: 1199 })];
    const cloud = [sub({ name: 'NETFLIX' })];
    const plan = buildPromotionPlan(local, cloud);
    expect(plan.create.map((r) => r.name)).toEqual(['Spotify']);
    expect(plan.skipped.map((r) => r.name)).toEqual(['Netflix']);
  });

  it('keeps two genuinely identical subscriptions as two records', () => {
    const local = [sub(), sub()];
    expect(buildPromotionPlan(local, []).create.length).toBe(2);
    // one already in the account → copy exactly the other, never both
    const plan = buildPromotionPlan(local, [sub()]);
    expect(plan.create.length).toBe(1);
    expect(plan.skipped.length).toBe(1);
  });

  it('never proposes cloud-only records for deletion', () => {
    const plan = buildPromotionPlan([], [sub({ name: 'Only In Cloud' })]);
    expect(plan.create).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  it('preserves the original local objects', () => {
    const local = [sub()];
    expect(buildPromotionPlan(local, []).create[0]).toBe(local[0]);
  });
});

describe('describeModeTransition', () => {
  it('offers to copy on-device records after signing in', () => {
    const notice = describeModeTransition({
      mode: 'supabase',
      isSignedIn: true,
      localOnlyCount: 3,
      cloudOnlyCount: 1,
    });
    expect(notice?.action).toBe('upload');
    expect(notice?.title).toContain('3 subscriptions are still only on this device');
    expect(notice?.body).toMatch(/did not upload/i);
    expect(notice?.body).toMatch(/stays as it is/i);
  });

  it('uses the singular form for one record', () => {
    const notice = describeModeTransition({ mode: 'supabase', isSignedIn: true, localOnlyCount: 1, cloudOnlyCount: 0 });
    expect(notice?.title).toBe('1 subscription is still only on this device');
  });

  it('says nothing when the account already has everything', () => {
    expect(
      describeModeTransition({ mode: 'supabase', isSignedIn: true, localOnlyCount: 0, cloudOnlyCount: 4 }),
    ).toBeNull();
  });

  it('states that a cloud account is not being read in local mode', () => {
    const notice = describeModeTransition({ mode: 'local', isSignedIn: true, localOnlyCount: 0, cloudOnlyCount: 2 });
    expect(notice?.action).toBe('switch');
    expect(notice?.title).toContain('Your account has 2 subscriptions you are not viewing');
    expect(notice?.body).toMatch(/Nothing was deleted/);
  });

  it('does not alarm an unsigned-in local user about a store they cannot reach', () => {
    expect(describeModeTransition({ mode: 'local', isSignedIn: false, localOnlyCount: 5, cloudOnlyCount: 0 })).toBeNull();
  });

  it('keeps demo data described as local-only', () => {
    const notice = describeModeTransition({ mode: 'demo', isSignedIn: true, localOnlyCount: 0, cloudOnlyCount: 6 });
    expect(notice?.body).toMatch(/never uploaded/i);
    expect(notice?.title).toContain('6');
  });
});

describe('describePromotion', () => {
  it('reports what was copied and what was left alone', () => {
    expect(describePromotion({ created: 2, skipped: 1, failed: 0 })).toBe(
      '2 subscriptions copied, 1 already in your account, the on-device list was left untouched.',
    );
  });

  it('is honest about a partial failure', () => {
    const text = describePromotion({ created: 1, skipped: 0, failed: 2 });
    expect(text).toContain('1 subscription copied');
    expect(text).toContain('2 failed and stayed on this device');
  });

  it('leads with the error when nothing was copied', () => {
    expect(describePromotion({ created: 0, skipped: 0, failed: 0, error: 'Cloud mode is not active.' })).toBe(
      'Cloud mode is not active.',
    );
  });
});
