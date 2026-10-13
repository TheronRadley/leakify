import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function FieldSet({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="field-set"
      dataSet={{ slot: 'field-set' }}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    />
  );
}

function FieldLegend({
  className,
  variant = 'legend',
  ...props
}: Omit<React.ComponentProps<typeof Text>, 'variant'> & { variant?: 'legend' | 'label' }) {
  return (
    <Text
      data-slot="field-legend"
      data-variant={variant}
      dataSet={{ slot: 'field-legend', variant }}
      className={cn(
        'mb-3 font-medium text-foreground',
        variant === 'legend' ? 'text-base' : 'text-sm',
        className,
      )}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="field-group"
      dataSet={{ slot: 'field-group' }}
      className={cn('group/field-group flex w-full flex-col gap-5', className)}
      {...props}
    />
  );
}

const fieldVariants = cva('group/field flex w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-center justify-between',
      responsive: 'flex-col sm:flex-row sm:items-center',
    },
  },
  defaultVariants: {
    orientation: 'vertical',
  },
});

function Field({
  className,
  orientation = 'vertical',
  ...props
}: ViewProps & VariantProps<typeof fieldVariants>) {
  return (
    <View
      role="group"
      data-slot="field"
      data-orientation={orientation ?? 'vertical'}
      dataSet={{ slot: 'field', orientation: orientation ?? 'vertical' }}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="field-content"
      dataSet={{ slot: 'field-content' }}
      className={cn('group/field-content flex flex-1 flex-col gap-1.5 leading-snug', className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        'group/field-label flex flex-row items-center gap-2 text-sm font-medium leading-snug text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="field-label"
      dataSet={{ slot: 'field-label' }}
      className={cn(
        'flex flex-row items-center gap-2 text-sm font-medium leading-snug text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="field-description"
      dataSet={{ slot: 'field-description' }}
      variant="muted"
      className={cn('text-sm font-normal leading-normal text-muted-foreground', className)}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: ViewProps & { children?: React.ReactNode }) {
  return (
    <View
      data-slot="field-separator"
      data-content={Boolean(children)}
      dataSet={{ slot: 'field-separator', content: Boolean(children) }}
      className={cn('relative my-1 h-5 items-center justify-center', className)}
      {...props}
    >
      <Separator className="absolute inset-x-0 top-1/2" />
      {children ? (
        <View
          data-slot="field-separator-content"
          dataSet={{ slot: 'field-separator-content' }}
          className="relative bg-card px-2"
        >
          {typeof children === 'string' ? (
            <Text variant="small" className="text-xs text-muted-foreground">
              {children}
            </Text>
          ) : (
            children
          )}
        </View>
      ) : null}
    </View>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: ViewProps & {
  errors?: ({ message?: string } | undefined)[];
}) {
  const content = React.useMemo(() => {
    if (children) return children;
    if (!errors?.length) return null;
    const uniqueErrors = [...new Map(errors.map((e) => [e?.message, e])).values()].filter((e) =>
      Boolean(e?.message),
    );
    if (uniqueErrors.length === 0) return null;
    if (uniqueErrors.length === 1) return uniqueErrors[0]?.message;
    return uniqueErrors.map((e) => e?.message).join('. ');
  }, [children, errors]);

  if (!content) return null;

  return (
    <View
      role="alert"
      accessibilityRole="alert"
      data-slot="field-error"
      dataSet={{ slot: 'field-error' }}
      className={cn('pt-0.5', className)}
      {...props}
    >
      {typeof content === 'string' ? (
        <Text
          variant="small"
          className="text-sm font-normal text-destructive"
          accessibilityRole="alert"
        >
          {content}
        </Text>
      ) : (
        content
      )}
    </View>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  fieldVariants,
};
