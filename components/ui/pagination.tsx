import { Button, buttonVariants } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';

function Pagination({ className, ...props }: ViewProps) {
  return (
    <View
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      dataSet={{ slot: 'pagination' }}
      className={cn('mx-auto flex w-full flex-row justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="pagination-content"
      dataSet={{ slot: 'pagination-content' }}
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

function PaginationItem(props: ViewProps) {
  return <View data-slot="pagination-item" dataSet={{ slot: 'pagination-item' }} {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  PressableProps;

function PaginationLink({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) {
  return (
    <Pressable
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      dataSet={{ slot: 'pagination-link', active: isActive }}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      accessibilityLabel="Go to previous page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pl-2.5', className)}
      {...props}
    >
      <Icon as={ChevronLeft} size={16} className="text-foreground" />
      <Text className="hidden text-sm font-medium sm:flex">Previous</Text>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      accessibilityLabel="Go to next page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pr-2.5', className)}
      {...props}
    >
      <Text className="hidden text-sm font-medium sm:flex">Next</Text>
      <Icon as={ChevronRight} size={16} className="text-foreground" />
    </PaginationLink>
  );
}

function PaginationEllipsis({ className, ...props }: ViewProps) {
  return (
    <View
      aria-hidden
      data-slot="pagination-ellipsis"
      dataSet={{ slot: 'pagination-ellipsis' }}
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <Icon as={MoreHorizontal} size={16} className="text-muted-foreground" />
    </View>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
