import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

/** Labeled form field wrapper built on shadcn/ui `Field`, `FieldLabel`, `FieldDescription`, and `FieldError`. */
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
    <Field
      className={cn('gap-1.5', className)}
      accessibilityLiveRegion={error ? 'polite' : 'none'}
    >
      <View className="flex-row items-baseline justify-between">
        <FieldLabel>{label}</FieldLabel>
        {optional ? (
          <Text variant="small" className="text-xs text-muted-foreground">
            Optional
          </Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <FieldError errors={[{ message: error }]} />
      ) : hint ? (
        <FieldDescription className="text-xs">{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}
