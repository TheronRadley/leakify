import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
  AppWindow,
  Clapperboard,
  Cloud,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Music,
  Plug,
  Shapes,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import type { CategoryKey } from '@/types';

const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  streaming: Clapperboard,
  music: Music,
  software: AppWindow,
  cloud_storage: Cloud,
  gaming: Gamepad2,
  fitness: Dumbbell,
  shopping: ShoppingBag,
  utilities: Plug,
  education: GraduationCap,
  other: Shapes,
};

/** Paired background + glyph tint per category (light and dark aware). */
const CATEGORY_TINTS: Record<CategoryKey, { tile: string; glyph: string }> = {
  streaming: { tile: 'bg-rose-100 dark:bg-rose-950', glyph: 'text-rose-600 dark:text-rose-300' },
  music: { tile: 'bg-violet-100 dark:bg-violet-950', glyph: 'text-violet-600 dark:text-violet-300' },
  software: { tile: 'bg-blue-100 dark:bg-blue-950', glyph: 'text-blue-600 dark:text-blue-300' },
  cloud_storage: { tile: 'bg-sky-100 dark:bg-sky-950', glyph: 'text-sky-600 dark:text-sky-300' },
  gaming: { tile: 'bg-emerald-100 dark:bg-emerald-950', glyph: 'text-emerald-600 dark:text-emerald-300' },
  fitness: { tile: 'bg-orange-100 dark:bg-orange-950', glyph: 'text-orange-600 dark:text-orange-300' },
  shopping: { tile: 'bg-amber-100 dark:bg-amber-950', glyph: 'text-amber-600 dark:text-amber-300' },
  utilities: { tile: 'bg-teal-100 dark:bg-teal-950', glyph: 'text-teal-600 dark:text-teal-300' },
  education: { tile: 'bg-indigo-100 dark:bg-indigo-950', glyph: 'text-indigo-600 dark:text-indigo-300' },
  other: { tile: 'bg-slate-100 dark:bg-slate-800', glyph: 'text-slate-600 dark:text-slate-300' },
};

/**
 * Consistent category tile. Billing records never carry third-party brand
 * logos, so the tint + glyph pair doubles as the stable visual identity for
 * every subscription.
 */
export function CategoryIcon({
  category,
  size = 40,
  className,
}: {
  category: CategoryKey;
  size?: number;
  className?: string;
}) {
  const Glyph = CATEGORY_ICONS[category] ?? Shapes;
  const tint = CATEGORY_TINTS[category] ?? CATEGORY_TINTS.other;
  return (
    <View
      className={cn('items-center justify-center rounded-xl', tint.tile, className)}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
    >
      <Icon as={Glyph} size={size * 0.55} className={tint.glyph} />
    </View>
  );
}
