import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

const buttonVariants = cva('group flex items-center justify-center rounded-md web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2', {
  variants: {
    variant: {
      default: 'bg-primary active:opacity-90 web:hover:opacity-90',
      destructive: 'bg-destructive active:opacity-90 web:hover:opacity-90',
      outline: 'border border-border bg-background active:bg-accent web:hover:bg-accent',
      secondary: 'bg-secondary active:opacity-80 web:hover:opacity-80',
      ghost: 'active:bg-accent web:hover:bg-accent',
      link: 'web:underline-offset-4 web:hover:underline',
    },
    size: {
      default: 'h-11 px-5 py-2 native:h-12 native:px-6',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-12 rounded-md px-8 native:h-14',
      icon: 'h-10 w-10',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

const buttonTextVariants = cva('text-sm font-semibold web:whitespace-nowrap', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary',
    },
    size: {
      default: '',
      sm: '',
      lg: 'native:text-base',
      icon: '',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and blocks presses while an action runs. */
    loading?: boolean;
  };

function Button({ ref, className, variant, size, asChild = false, loading, disabled, children, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Pressable : Pressable;
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Component
        ref={ref}
        role="button"
        accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
        className={cn(
          (disabled || loading) && 'opacity-50',
          buttonVariants({ variant, size, className }),
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <ActivityIndicator color="white" /> : children}
      </Component>
    </TextClassContext.Provider>
  );
}
Button.displayName = 'Button';

export { Button, buttonTextVariants, buttonVariants };
export type { ButtonProps };
