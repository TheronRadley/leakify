import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function Card({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <View
      className={cn('rounded-lg border border-border bg-card shadow-sm shadow-black/5', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return <View className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text> & { ref?: React.Ref<typeof Text> }) {
  return (
    <Text
      role="heading"
      aria-level={3}
      variant="large"
      className={cn('leading-none tracking-tight text-card-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & { ref?: React.Ref<typeof Text> }) {
  return <Text variant="muted" className={cn(className)} {...props} />;
}

function CardContent({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View className={cn('p-5 pt-0', className)} {...props} />
    </TextClassContext.Provider>
  );
}

function CardFooter({ className, ...props }: ViewProps & { ref?: React.Ref<View> }) {
  return <View className={cn('flex flex-row items-center p-5 pt-0', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
