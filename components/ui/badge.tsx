import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium web:whitespace-nowrap web:transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive text-white dark:bg-destructive/60',
        outline: 'border-border text-foreground bg-transparent',
        ghost: 'bg-transparent text-foreground',
        link: 'text-primary underline-offset-4',
        success:
          'border-emerald-500/25 bg-emerald-500/10 dark:border-emerald-500/30 dark:bg-emerald-500/15',
        warning:
          'border-amber-500/25 bg-amber-500/10 dark:border-amber-500/30 dark:bg-amber-500/15',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const badgeTextVariants = cva('text-xs font-medium leading-4', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-white',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
      success: 'text-emerald-700 dark:text-emerald-400',
      warning: 'text-amber-700 dark:text-amber-400',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const badgeDotVariants = cva('h-1.5 w-1.5 rounded-full', {
  variants: {
    variant: {
      default: 'bg-primary-foreground',
      secondary: 'bg-muted-foreground',
      destructive: 'bg-white',
      outline: 'bg-muted-foreground',
      ghost: 'bg-muted-foreground',
      link: 'bg-primary',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  label?: string;
  asChild?: boolean;
  dot?: boolean;
}

function Badge({
  className,
  variant = 'default',
  label,
  asChild = false,
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.View : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Comp
        data-slot="badge"
        data-variant={variant ?? 'default'}
        dataSet={{ slot: 'badge', variant: variant ?? 'default' }}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {dot ? <View className={badgeDotVariants({ variant })} accessibilityElementsHidden /> : null}
        {label !== undefined ? <Text className={badgeTextVariants({ variant })}>{label}</Text> : children}
      </Comp>
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
