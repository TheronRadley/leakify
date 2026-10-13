import { Spinner } from '@/components/ui/spinner';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';

const buttonVariants = cva(
  'group inline-flex shrink-0 flex-row items-center justify-center gap-2 rounded-md text-sm font-medium active:scale-[0.98] web:whitespace-nowrap web:transition-all web:duration-150 web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'bg-primary shadow-xs web:hover:bg-primary/90 active:bg-primary/90',
        destructive:
          'bg-destructive shadow-xs web:hover:bg-destructive/90 active:bg-destructive/90 dark:bg-destructive/60',
        outline:
          'border border-border bg-background shadow-xs web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent dark:border-input dark:bg-input/30 dark:web:hover:bg-input/50',
        secondary: 'bg-secondary shadow-2xs web:hover:bg-secondary/80 active:bg-secondary/80',
        ghost: 'web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent',
        link: 'web:underline-offset-4 web:hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 native:h-10',
        xs: 'h-6 gap-1 rounded-md px-2',
        sm: 'h-8 gap-1.5 rounded-md px-3 native:h-9',
        lg: 'h-10 rounded-md px-6 native:h-11',
        icon: 'h-9 w-9 native:h-10 native:w-10',
        'icon-xs': 'h-6 w-6 rounded-md',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const buttonTextVariants = cva('text-sm font-medium web:transition-colors', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-white',
      outline: 'text-foreground group-active:text-accent-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground group-active:text-accent-foreground',
      link: 'text-primary group-active:underline',
    },
    size: {
      default: 'text-sm',
      xs: 'text-xs',
      sm: 'text-xs',
      lg: 'text-sm',
      icon: 'text-sm',
      'icon-xs': 'text-xs',
      'icon-sm': 'text-sm',
      'icon-lg': 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading);
  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Comp
        data-slot="button"
        data-variant={variant ?? 'default'}
        data-size={size ?? 'default'}
        dataSet={{
          slot: 'button',
          variant: variant ?? 'default',
          size: size ?? 'default',
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50 web:pointer-events-none',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner
            size={14}
            className={
              variant === 'default' || variant === 'destructive'
                ? 'text-primary-foreground'
                : 'text-foreground'
            }
          />
        ) : null}
        {children as React.ReactNode}
      </Comp>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, buttonVariants };
