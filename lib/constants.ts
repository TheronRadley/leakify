import type { CategoryKey, CurrencyCode } from '@/types';

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  /** lucide icon name resolved by components/shared/category-icon.tsx */
  icon: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'streaming', label: 'Streaming & Entertainment', icon: 'clapperboard' },
  { key: 'music', label: 'Music & Media', icon: 'music' },
  { key: 'software', label: 'Software & Productivity', icon: 'app-window' },
  { key: 'cloud_storage', label: 'Cloud Storage', icon: 'cloud' },
  { key: 'gaming', label: 'Gaming', icon: 'gamepad-2' },
  { key: 'fitness', label: 'Fitness & Wellness', icon: 'dumbbell' },
  { key: 'shopping', label: 'Shopping & Memberships', icon: 'shopping-bag' },
  { key: 'utilities', label: 'Utilities & Bills', icon: 'plug' },
  { key: 'education', label: 'Education', icon: 'graduation-cap' },
  { key: 'other', label: 'Other', icon: 'shapes' },
];

export function categoryLabel(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? 'Other';
}

export function categoryIcon(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.icon ?? 'shapes';
}

/** Currencies offered in the currency picker. */
export const SUPPORTED_CURRENCIES: { code: CurrencyCode; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: '$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
];

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/** Selectable reminder lead times (days before the event; 0 = same day). */
export const RENEWAL_LEAD_OPTIONS = [7, 3, 1, 0] as const;
export const TRIAL_LEAD_OPTIONS = [3, 1, 0] as const;

export const APP_NAME = 'Leakify';
export const APP_TAGLINE = 'Stop the money leaks.';
