import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function Empty({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="empty"
      dataSet={{ slot: 'empty' }}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-border p-6 text-center md:p-12',
        className,
      )}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="empty-header"
      dataSet={{ slot: 'empty-header' }}
      className={cn('flex max-w-sm flex-col items-center gap-2 text-center', className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  'mb-2 flex shrink-0 items-center justify-center',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function EmptyMedia({
  className,
  variant = 'default',
  ...props
}: ViewProps & VariantProps<typeof emptyMediaVariants>) {
  return (
    <View
      data-slot="empty-icon"
      data-variant={variant ?? 'default'}
      dataSet={{ slot: 'empty-icon', variant: variant ?? 'default' }}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="empty-title"
      dataSet={{ slot: 'empty-title' }}
      className={cn('text-lg font-medium tracking-tight text-center text-foreground', className)}
      {...props}
    />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="empty-description"
      dataSet={{ slot: 'empty-description' }}
      variant="muted"
      className={cn('text-center text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="empty-content"
      dataSet={{ slot: 'empty-content' }}
      className={cn(
        'flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm',
        className,
      )}
      {...props}
    />
  );
}

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  emptyMediaVariants,
  EmptyTitle,
};
