import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { CloudOff, Inbox, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Consistent empty state built on shadcn/ui `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, and `EmptyContent`. */
export function EmptyState({
  icon: IconComponent = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Empty
      className={cn('border border-dashed border-border bg-card/40 py-10', className)}
      accessibilityRole="summary"
    >
      <EmptyHeader>
        {IconComponent ? (
          <EmptyMedia variant="icon">
            <Icon as={IconComponent} size={20} className="text-foreground" />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {actionLabel && onAction ? (
        <EmptyContent>
          <Button size="sm" onPress={onAction} accessibilityLabel={actionLabel}>
            <Text>{actionLabel}</Text>
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

/** Screen-level error state with optional retry. Never swallows failures silently. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <EmptyState
      icon={CloudOff}
      title={title}
      description={
        message ?? 'We could not load your data. Please check your connection and try again.'
      }
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
    />
  );
}

/** Card-stack loading skeleton matching shadcn/ui dashboard layouts. */
export function LoadingSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <View
      className="mx-auto w-full max-w-5xl gap-4 px-4 pt-6 md:px-6"
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      <Skeleton className="h-28 w-full rounded-xl" />
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="flex-row items-center gap-3.5 p-4 py-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
          </View>
          <Skeleton className="h-5 w-16" />
        </Card>
      ))}
    </View>
  );
}
