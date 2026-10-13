import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const alertVariants = cva(
  'relative w-full flex-row items-start gap-3 rounded-lg border border-border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground',
        destructive:
          'border-destructive/30 bg-card text-destructive dark:border-destructive/40',
        warning:
          'border-amber-500/30 bg-card text-amber-700 dark:border-amber-500/40 dark:text-amber-400',
        success:
          'border-emerald-500/30 bg-card text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const alertIconVariants = cva('mt-0.5 shrink-0', {
  variants: {
    variant: {
      default: 'text-foreground',
      destructive: 'text-destructive',
      warning: 'text-amber-600 dark:text-amber-400',
      success: 'text-emerald-600 dark:text-emerald-400',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface AlertProps extends ViewProps, VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
}

function Alert({ className, variant = 'default', icon: IconComponent, children, ...props }: AlertProps) {
  return (
    <View
      data-slot="alert"
      data-variant={variant ?? 'default'}
      dataSet={{ slot: 'alert', variant: variant ?? 'default' }}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {IconComponent ? (
        <Icon as={IconComponent} size={16} className={alertIconVariants({ variant })} />
      ) : null}
      <View className="flex-1 gap-0.5">{children}</View>
    </View>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="alert-title"
      dataSet={{ slot: 'alert-title' }}
      className={cn('min-h-4 text-sm font-medium tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="alert-description"
      dataSet={{ slot: 'alert-description' }}
      variant="muted"
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="alert-action"
      dataSet={{ slot: 'alert-action' }}
      className={cn('absolute right-3 top-2.5', className)}
      {...props}
    />
  );
}

export { Alert, AlertAction, AlertDescription, AlertTitle, alertVariants };
