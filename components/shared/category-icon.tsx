import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { CategoryKey } from '@/types';
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

/** Paired background + glyph tint per category (shadcn/ui Zinc + subtle accent). */
const CATEGORY_TINTS: Record<CategoryKey, { tile: string; glyph: string }> = {
  streaming: {
    tile: 'border-rose-200/80 bg-rose-500/10 dark:border-rose-900/60 dark:bg-rose-500/15',
    glyph: 'text-rose-600 dark:text-rose-400',
  },
  music: {
    tile: 'border-violet-200/80 bg-violet-500/10 dark:border-violet-900/60 dark:bg-violet-500/15',
    glyph: 'text-violet-600 dark:text-violet-400',
  },
  software: {
    tile: 'border-blue-200/80 bg-blue-500/10 dark:border-blue-900/60 dark:bg-blue-500/15',
    glyph: 'text-blue-600 dark:text-blue-400',
  },
  cloud_storage: {
    tile: 'border-sky-200/80 bg-sky-500/10 dark:border-sky-900/60 dark:bg-sky-500/15',
    glyph: 'text-sky-600 dark:text-sky-400',
  },
  gaming: {
    tile: 'border-emerald-200/80 bg-emerald-500/10 dark:border-emerald-900/60 dark:bg-emerald-500/15',
    glyph: 'text-emerald-600 dark:text-emerald-400',
  },
  fitness: {
    tile: 'border-orange-200/80 bg-orange-500/10 dark:border-orange-900/60 dark:bg-orange-500/15',
    glyph: 'text-orange-600 dark:text-orange-400',
  },
  shopping: {
    tile: 'border-amber-200/80 bg-amber-500/10 dark:border-amber-900/60 dark:bg-amber-500/15',
    glyph: 'text-amber-600 dark:text-amber-400',
  },
  utilities: {
    tile: 'border-teal-200/80 bg-teal-500/10 dark:border-teal-900/60 dark:bg-teal-500/15',
    glyph: 'text-teal-600 dark:text-teal-400',
  },
  education: {
    tile: 'border-indigo-200/80 bg-indigo-500/10 dark:border-indigo-900/60 dark:bg-indigo-500/15',
    glyph: 'text-indigo-600 dark:text-indigo-400',
  },
  other: {
    tile: 'border-border bg-muted/60',
    glyph: 'text-muted-foreground',
  },
};

export function CategoryIcon({
  category,
  size = 38,
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
      data-slot="category-icon"
      dataSet={{ slot: 'category-icon' }}
      className={cn('items-center justify-center rounded-md border', tint.tile, className)}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
    >
      <Icon as={Glyph} size={Math.round(size * 0.48)} className={tint.glyph} />
    </View>
  );
}
