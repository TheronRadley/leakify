import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const badgeVariants = cva('flex-row items-center rounded-md border px-2.5 py-0.5', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary',
      secondary: 'border-transparent bg-secondary',
      success: 'border-transparent bg-accent',
      warning: 'border-transparent bg-warning',
      destructive: 'border-transparent bg-destructive',
      outline: 'border-border',
    },
  },
  defaultVariants: { variant: 'default' },
});

const badgeTextVariants = cva('text-xs font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      success: 'text-accent-foreground',
      warning: 'text-warning-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  label: string;
}

function Badge({ className, variant, label, ...props }: BadgeProps) {
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <View className={cn(badgeVariants({ variant }), className)} {...props}>
        <Text className={badgeTextVariants({ variant })}>{label}</Text>
      </View>
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
