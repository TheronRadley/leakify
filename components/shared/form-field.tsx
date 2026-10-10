import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

/** Labeled form field wrapper with inline validation messaging. */
export function FormField({
  label,
  error,
  hint,
  optional,
  children,
  className,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-1.5', className)} accessibilityLiveRegion={error ? 'polite' : 'none'}>
      <View className="flex-row items-baseline justify-between">
        <Label>{label}</Label>
        {optional ? (
          <Text variant="small" className="text-muted-foreground">
            Optional
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text variant="small" className="text-destructive" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" className="text-muted-foreground">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
