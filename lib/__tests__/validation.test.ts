import { signUpSchema, subscriptionFormSchema } from '@/lib/validation';

const validForm = {
  name: 'Netflix',
  provider: 'Netflix Inc',
  amount: '15.49',
  currency: 'USD',
  intervalEvery: 1,
  intervalUnit: 'month' as const,
  startDate: '2026-01-01',
  nextBillingDate: '2026-11-13',
  trialEndDate: '',
  category: 'streaming' as const,
  status: 'active' as const,
  paymentMethodLabel: 'Visa 4242',
  cancellationUrl: 'https://www.netflix.com/cancelplan',
  notes: '',
};

describe('subscriptionFormSchema', () => {
  it('accepts a complete valid form', () => {
    const result = subscriptionFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.trialEndDate).toBeNull();
    }
  });

  it('allows genuinely optional fields to be empty', () => {
    const result = subscriptionFormSchema.safeParse({
      ...validForm,
      provider: '',
      startDate: '',
      nextBillingDate: '',
      paymentMethodLabel: '',
      cancellationUrl: '',
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('requires a name and a valid amount', () => {
    expect(subscriptionFormSchema.safeParse({ ...validForm, name: ' ' }).success).toBe(false);
    expect(subscriptionFormSchema.safeParse({ ...validForm, amount: 'abc' }).success).toBe(false);
    expect(subscriptionFormSchema.safeParse({ ...validForm, amount: '' }).success).toBe(false);
  });

  it('rejects invalid dates and bad currencies', () => {
    expect(subscriptionFormSchema.safeParse({ ...validForm, nextBillingDate: '2026-13-40' }).success).toBe(false);
    expect(subscriptionFormSchema.safeParse({ ...validForm, currency: 'XAU' }).success).toBe(false);
  });

  it('rejects trial ends before the start date', () => {
    const result = subscriptionFormSchema.safeParse({
      ...validForm,
      status: 'trialing' as const,
      startDate: '2026-10-01',
      trialEndDate: '2026-09-15',
    });
    expect(result.success).toBe(false);
  });

  it('trialing status requires a trial end date', () => {
    expect(
      subscriptionFormSchema.safeParse({ ...validForm, status: 'trialing' as const, trialEndDate: '' }).success,
    ).toBe(false);
    expect(
      subscriptionFormSchema.safeParse({ ...validForm, status: 'trialing' as const, trialEndDate: '2026-11-01' }).success,
    ).toBe(true);
  });

  it('validates cancellation URLs', () => {
    expect(subscriptionFormSchema.safeParse({ ...validForm, cancellationUrl: 'not a url' }).success).toBe(false);
    expect(subscriptionFormSchema.safeParse({ ...validForm, cancellationUrl: '' }).success).toBe(true);
  });
});

describe('signUpSchema', () => {
  it('enforces password strength and confirmation', () => {
    const weak = signUpSchema.safeParse({ displayName: 'Ana', email: 'a@b.co', password: 'short', confirmPassword: 'short' });
    expect(weak.success).toBe(false);
    const mismatch = signUpSchema.safeParse({ displayName: 'Ana', email: 'a@b.co', password: 'longenough1', confirmPassword: 'different!' });
    expect(mismatch.success).toBe(false);
    const ok = signUpSchema.safeParse({ displayName: 'Ana', email: 'a@b.co', password: 'longenough1', confirmPassword: 'longenough1' });
    expect(ok.success).toBe(true);
  });
});
