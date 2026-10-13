import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function Card({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        data-slot="card"
        dataSet={{ slot: 'card' }}
        className={cn(
          'flex flex-col gap-4 rounded-xl border border-border bg-card py-4 text-card-foreground shadow-sm sm:gap-5 sm:py-5 web:transition-all web:duration-200',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function CardAction({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <View
      data-slot="card-action"
      dataSet={{ slot: 'card-action' }}
      className={cn('shrink-0 flex-row items-center gap-1.5 self-start', className)}
      {...props}
    />
  );
}
CardAction.displayName = 'CardAction';

function CardHeader({
  className,
  children,
  ...props
}: ViewProps & { ref?: React.Ref<View> }) {
  const childArray = React.Children.toArray(children);
  const actions: React.ReactNode[] = [];
  const rest: React.ReactNode[] = [];

  for (const child of childArray) {
    if (
      React.isValidElement(child) &&
      ((child.type as { displayName?: string })?.displayName === 'CardAction' ||
        child.type === CardAction)
    ) {
      actions.push(child);
    } else {
      rest.push(child);
    }
  }

  if (actions.length > 0) {
    return (
      <View
        data-slot="card-header"
        dataSet={{ slot: 'card-header' }}
        className={cn(
          'flex flex-row flex-wrap items-start justify-between gap-2.5 px-4 sm:px-6',
          className,
        )}
        {...props}
      >
        <View className="min-w-[140px] flex-1 flex-col items-start gap-1.5">{rest}</View>
        {actions}
      </View>
    );
  }

  return (
    <View
      data-slot="card-header"
      dataSet={{ slot: 'card-header' }}
      className={cn('flex flex-col items-start gap-1.5 px-4 sm:px-6', className)}
      {...props}
    />
  );
}

function CardTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & { ref?: React.Ref<Text> }) {
  return (
    <Text
      role="heading"
      aria-level={3}
      data-slot="card-title"
      dataSet={{ slot: 'card-title' }}
      className={cn('text-base font-semibold leading-snug tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & { ref?: React.Ref<Text> }) {
  return (
    <Text
      data-slot="card-description"
      dataSet={{ slot: 'card-description' }}
      variant="muted"
      className={cn('text-sm leading-5 text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <View
      data-slot="card-content"
      dataSet={{ slot: 'card-content' }}
      className={cn('px-4 sm:px-6', className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <View
      data-slot="card-footer"
      dataSet={{ slot: 'card-footer' }}
      className={cn('flex flex-row items-center px-4 sm:px-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
