import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function ItemGroup({ className, ...props }: ViewProps) {
  return (
    <View
      role="list"
      data-slot="item-group"
      dataSet={{ slot: 'item-group' }}
      className={cn('group/item-group flex flex-col', className)}
      {...props}
    />
  );
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="item-separator"
      dataSet={{ slot: 'item-separator' }}
      orientation="horizontal"
      className={cn('my-0', className)}
      {...props}
    />
  );
}

const itemVariants = cva(
  'group/item flex flex-row items-center rounded-lg border border-transparent text-sm web:transition-colors web:duration-100 web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border-border bg-card',
        muted: 'bg-muted/50',
      },
      size: {
        default: 'gap-3.5 p-3.5 sm:gap-4 sm:p-4',
        sm: 'gap-2.5 px-3.5 py-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Item({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: ViewProps & VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.View : View;
  return (
    <Comp
      data-slot="item"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      dataSet={{
        slot: 'item',
        variant: variant ?? 'default',
        size: size ?? 'default',
      }}
      className={cn(itemVariants({ variant, size, className }))}
      {...props}
    />
  );
}

const itemMediaVariants = cva('flex shrink-0 items-center justify-center gap-2', {
  variants: {
    variant: {
      default: 'bg-transparent',
      icon: 'h-8 w-8 rounded-md border border-border bg-muted',
      image: 'h-10 w-10 overflow-hidden rounded-md',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function ItemMedia({
  className,
  variant = 'default',
  ...props
}: ViewProps & VariantProps<typeof itemMediaVariants>) {
  return (
    <View
      data-slot="item-media"
      data-variant={variant ?? 'default'}
      dataSet={{ slot: 'item-media', variant: variant ?? 'default' }}
      className={cn(itemMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="item-content"
      dataSet={{ slot: 'item-content' }}
      className={cn('flex min-w-0 flex-1 flex-col gap-0.5', className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="item-title"
      dataSet={{ slot: 'item-title' }}
      className={cn('text-sm font-medium leading-snug text-foreground', className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="item-description"
      dataSet={{ slot: 'item-description' }}
      variant="muted"
      className={cn('text-xs font-normal leading-normal text-muted-foreground sm:text-sm', className)}
      {...props}
    />
  );
}

function ItemActions({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="item-actions"
      dataSet={{ slot: 'item-actions' }}
      className={cn('flex shrink-0 flex-row items-center gap-2', className)}
      {...props}
    />
  );
}

function ItemHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="item-header"
      dataSet={{ slot: 'item-header' }}
      className={cn('flex w-full flex-row items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

function ItemFooter({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="item-footer"
      dataSet={{ slot: 'item-footer' }}
      className={cn('flex w-full flex-row items-center justify-between gap-2', className)}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  itemMediaVariants,
  ItemSeparator,
  ItemTitle,
  itemVariants,
};
