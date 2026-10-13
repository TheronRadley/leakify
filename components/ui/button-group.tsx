import { Separator } from '@/components/ui/separator';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const buttonGroupVariants = cva(
  'flex w-fit items-stretch',
  {
    variants: {
      orientation: {
        horizontal: 'flex-row',
        vertical: 'flex-col',
      },
    },
    defaultVariants: {
      orientation: 'horizontal',
    },
  },
);

function ButtonGroup({
  className,
  orientation = 'horizontal',
  ...props
}: ViewProps & VariantProps<typeof buttonGroupVariants>) {
  return (
    <View
      role="group"
      data-slot="button-group"
      data-orientation={orientation ?? 'horizontal'}
      dataSet={{ slot: 'button-group', orientation: orientation ?? 'horizontal' }}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: ViewProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.View : View;
  return (
    <TextClassContext.Provider value="text-sm font-medium text-foreground">
      <Comp
        data-slot="button-group-text"
        dataSet={{ slot: 'button-group-text' }}
        className={cn(
          'flex-row items-center gap-2 rounded-md border border-border bg-muted px-4 py-1.5 text-sm font-medium shadow-xs',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      dataSet={{ slot: 'button-group-separator' }}
      orientation={orientation}
      className={cn('relative self-stretch bg-input', className)}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
