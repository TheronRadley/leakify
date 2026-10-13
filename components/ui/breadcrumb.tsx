import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { ChevronRight, MoreHorizontal } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';

function Breadcrumb({ className, ...props }: ViewProps) {
  return (
    <View
      accessibilityLabel="breadcrumb"
      data-slot="breadcrumb"
      dataSet={{ slot: 'breadcrumb' }}
      className={cn(className)}
      {...props}
    />
  );
}

function BreadcrumbList({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="breadcrumb-list"
      dataSet={{ slot: 'breadcrumb-list' }}
      className={cn(
        'flex-row flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:gap-2.5',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="breadcrumb-item"
      dataSet={{ slot: 'breadcrumb-item' }}
      className={cn('inline-flex flex-row items-center gap-1.5', className)}
      {...props}
    />
  );
}

function BreadcrumbLink({
  asChild,
  className,
  children,
  ...props
}: PressableProps & { asChild?: boolean; children?: React.ReactNode }) {
  const Comp = asChild ? Slot.Pressable : Pressable;
  return (
    <Comp
      data-slot="breadcrumb-link"
      dataSet={{ slot: 'breadcrumb-link' }}
      className={cn('web:transition-colors web:hover:text-foreground', className)}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className="text-sm text-muted-foreground web:hover:text-foreground">{children}</Text>
      ) : (
        children
      )}
    </Comp>
  );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="breadcrumb-page"
      dataSet={{ slot: 'breadcrumb-page' }}
      role="link"
      aria-disabled={true}
      aria-current="page"
      className={cn('text-sm font-normal text-foreground', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ViewProps) {
  return (
    <View
      data-slot="breadcrumb-separator"
      dataSet={{ slot: 'breadcrumb-separator' }}
      role="presentation"
      aria-hidden={true}
      className={cn('items-center justify-center', className)}
      {...props}
    >
      {children ?? <Icon as={ChevronRight} size={14} className="text-muted-foreground" />}
    </View>
  );
}

function BreadcrumbEllipsis({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="breadcrumb-ellipsis"
      dataSet={{ slot: 'breadcrumb-ellipsis' }}
      role="presentation"
      aria-hidden={true}
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <Icon as={MoreHorizontal} size={16} className="text-muted-foreground" />
    </View>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
