import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, type PressableProps } from 'react-native';

const toggleVariants = cva(
  'inline-flex flex-row items-center justify-center gap-2 rounded-md text-sm font-medium web:whitespace-nowrap web:transition-[color,box-shadow] web:outline-none web:hover:bg-muted web:hover:text-muted-foreground web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent shadow-xs web:hover:bg-accent web:hover:text-accent-foreground',
      },
      size: {
        default: 'h-9 min-w-9 px-2',
        sm: 'h-8 min-w-8 px-1.5',
        lg: 'h-10 min-w-10 px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ToggleProps = PressableProps &
  VariantProps<typeof toggleVariants> & {
    pressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  };

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  pressed = false,
  onPressedChange,
  onPress,
  ...props
}: ToggleProps) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm font-medium',
        pressed ? 'text-accent-foreground' : 'text-foreground',
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: pressed, disabled: Boolean(props.disabled) }}
        data-slot="toggle"
        data-state={pressed ? 'on' : 'off'}
        dataSet={{ slot: 'toggle', state: pressed ? 'on' : 'off' }}
        onPress={(e) => {
          onPress?.(e);
          onPressedChange?.(!pressed);
        }}
        className={cn(
          toggleVariants({ variant, size }),
          props.disabled && 'opacity-50 web:pointer-events-none',
          pressed && 'bg-accent text-accent-foreground',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Toggle, toggleVariants };
