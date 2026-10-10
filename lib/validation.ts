import { z } from 'zod';
import { SUPPORTED_CURRENCY_CODES } from '@/lib/constants';
import { isValidISODate } from '@/lib/dates';

export const CATEGORY_KEYS = [
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
] as const;

const isoDate = (label: string) =>
  z
    .string()
    .refine((v) => v === '' || isValidISODate(v), `${label} must be a valid date`)
    .transform((v) => (v === '' ? null : v));

/**
 * Validates the add/edit subscription form. Amount stays a user-typed decimal
 * string here and is converted to minor units only after validation.
 */
export const subscriptionFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
    provider: z.string().trim().max(80, 'Provider name is too long'),
    amount: z
      .string()
      .trim()
      .min(1, 'Amount is required')
      .refine((v) => /^\d{1,9}([.,]\d{0,9})?$/.test(v.replace(/\s/g, '')), 'Enter a valid amount'),
    currency: z
      .string()
      .refine((c) => SUPPORTED_CURRENCY_CODES.includes(c), 'Unsupported currency'),
    intervalEvery: z
      .number({ message: 'Enter how often it bills' })
      .int('Must be a whole number')
      .min(1, 'Must be at least 1')
      .max(365, 'That interval is too large'),
    intervalUnit: z.enum(['day', 'week', 'month', 'year']),
    startDate: isoDate('Start date'),
    nextBillingDate: isoDate('Next billing date'),
    trialEndDate: isoDate('Trial end date'),
    category: z.enum(CATEGORY_KEYS),
    status: z.enum(['active', 'trialing', 'paused', 'canceled']),
    paymentMethodLabel: z.string().trim().max(40, 'Payment method label is too long'),
    cancellationUrl: z
      .string()
      .trim()
      .refine(
        (v) => v === '' || /^https?:\/\/.+\..+/.test(v),
        'Enter a valid URL starting with http(s)://',
      ),
    notes: z.string().trim().max(500, 'Notes are too long'),
  })
  .refine(
    (v) => !v.trialEndDate || !v.startDate || v.trialEndDate >= v.startDate,
    { message: 'Trial end cannot be before the start date', path: ['trialEndDate'] },
  )
  .refine(
    (v) => v.status !== 'trialing' || Boolean(v.trialEndDate),
    { message: 'Add a trial end date for trialing subscriptions', path: ['trialEndDate'] },
  );

/** Values as held by the form (pre-transform: dates are strings, "" = unset). */
export type SubscriptionFormInputValues = z.input<typeof subscriptionFormSchema>;
/** Values after validation transforms (unset dates become null). */
export type SubscriptionFormValues = z.output<typeof subscriptionFormSchema>;

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, 'Display name is required').max(60),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const recoverySchema = z.object({ email: emailSchema });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type RecoveryValues = z.infer<typeof recoverySchema>;
