import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CloudOff, type LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** Consistent empty state: icon, headline, supportive copy, optional action. */
export function EmptyState({
  icon: IconComponent,
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
    <View className={cn('items-center gap-3 px-6 py-12', className)} accessibilityRole="summary">
      {IconComponent ? (
        <View className="mb-1 rounded-full bg-accent p-4">
          <Icon as={IconComponent} size={28} className="text-accent-foreground" />
        </View>
      ) : null}
      <Text variant="large" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="text-center leading-6">
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button className="mt-3" onPress={onAction} accessibilityLabel={actionLabel}>
          <Text>{actionLabel}</Text>
        </Button>
      ) : null}
    </View>
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
      description={message ?? 'We could not load your data. Please check your connection and try again.'}
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
    />
  );
}

/** Card-stack loading skeleton matching dashboard layouts. */
export function LoadingSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <View className="gap-3 px-4 pt-4" accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      <Skeleton className="h-32 w-full" />
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i} className="flex-row items-center gap-3 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </View>
          <Skeleton className="h-5 w-16" />
        </Card>
      ))}
    </View>
  );
}
