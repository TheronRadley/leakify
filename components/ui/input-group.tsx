import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function InputGroup({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="input-group"
      dataSet={{ slot: 'input-group' }}
      role="group"
      className={cn(
        'group/input-group relative flex h-9 native:h-10 w-full min-w-0 flex-row items-center rounded-md border border-input bg-transparent shadow-xs web:transition-[color,box-shadow] web:outline-none dark:bg-input/30',
        className,
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  'flex h-auto flex-row items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none',
  {
    variants: {
      align: {
        'inline-start': 'pl-3',
        'inline-end': 'pr-3',
        'block-start': 'w-full justify-start px-3 pt-3',
        'block-end': 'w-full justify-start px-3 pb-3',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
);

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: ViewProps & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <View
      role="group"
      data-slot="input-group-addon"
      data-align={align ?? 'inline-start'}
      dataSet={{ slot: 'input-group-addon', align: align ?? 'inline-start' }}
      className={cn(inputGroupAddonVariants({ align }), className)}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva('flex-row items-center gap-1.5 text-sm shadow-none', {
  variants: {
    size: {
      xs: 'h-6 gap-1 rounded-sm px-2',
      sm: 'h-8 gap-1.5 rounded-md px-2.5',
      'icon-xs': 'h-6 w-6 rounded-sm p-0',
      'icon-sm': 'h-8 w-8 rounded-md p-0',
    },
  },
  defaultVariants: {
    size: 'xs',
  },
});

function InputGroupButton({
  className,
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      data-size={size ?? 'xs'}
      variant={variant}
      size={size ?? 'xs'}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

function InputGroupText({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="input-group-text"
      dataSet={{ slot: 'input-group-text' }}
      className={cn('flex-row items-center gap-2 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="input-group-control"
      dataSet={{ slot: 'input-group-control' }}
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none web:focus-visible:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      data-slot="input-group-control"
      dataSet={{ slot: 'input-group-control' }}
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent py-3 shadow-none web:focus-visible:ring-0 dark:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  inputGroupAddonVariants,
  InputGroupButton,
  inputGroupButtonVariants,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
