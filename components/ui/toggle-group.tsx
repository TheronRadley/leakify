import { TextClassContext } from '@/components/ui/text';
import { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
  spacing?: number;
  type: 'single' | 'multiple';
  value: string | string[] | undefined;
  onItemPress: (itemValue: string) => void;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  size: 'default',
  variant: 'default',
  spacing: 0,
  type: 'single',
  value: undefined,
  onItemPress: () => {},
});

export type ToggleGroupProps = ViewProps &
  VariantProps<typeof toggleVariants> & {
    type?: 'single' | 'multiple';
    value?: string | string[];
    onValueChange?: (value: any) => void;
    spacing?: number;
  };

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  type = 'single',
  value,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const onItemPress = React.useCallback(
    (itemValue: string) => {
      if (type === 'multiple') {
        const arr = Array.isArray(value) ? value : [];
        const next = arr.includes(itemValue)
          ? arr.filter((v) => v !== itemValue)
          : [...arr, itemValue];
        onValueChange?.(next);
      } else {
        onValueChange?.(itemValue);
      }
    },
    [type, value, onValueChange],
  );

  return (
    <View
      role="group"
      data-slot="toggle-group"
      data-variant={variant ?? 'default'}
      data-size={size ?? 'default'}
      data-spacing={spacing}
      dataSet={{
        slot: 'toggle-group',
        variant: variant ?? 'default',
        size: size ?? 'default',
        spacing,
      }}
      className={cn(
        'group/toggle-group flex w-fit flex-row items-center rounded-md',
        spacing === 0 && variant === 'outline' && 'shadow-xs',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing, type, value, onItemPress }}>
        {children}
      </ToggleGroupContext.Provider>
    </View>
  );
}

export type ToggleGroupItemProps = PressableProps &
  VariantProps<typeof toggleVariants> & {
    value: string;
    isFirst?: boolean;
    isLast?: boolean;
  };

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value: itemValue,
  isFirst,
  isLast,
  onPress,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext);
  const isSelected = Array.isArray(context.value)
    ? context.value.includes(itemValue)
    : context.value === itemValue;
  const resolvedVariant = context.variant || variant || 'default';
  const resolvedSize = context.size || size || 'default';

  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm font-medium',
        isSelected ? 'text-accent-foreground' : 'text-foreground',
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: Boolean(props.disabled) }}
        data-slot="toggle-group-item"
        data-variant={resolvedVariant}
        data-size={resolvedSize}
        data-state={isSelected ? 'on' : 'off'}
        dataSet={{
          slot: 'toggle-group-item',
          variant: resolvedVariant,
          size: resolvedSize,
          state: isSelected ? 'on' : 'off',
        }}
        onPress={(e) => {
          onPress?.(e);
          context.onItemPress(itemValue);
        }}
        className={cn(
          toggleVariants({
            variant: resolvedVariant,
            size: resolvedSize,
          }),
          props.disabled && 'opacity-50 web:pointer-events-none',
          isSelected && 'bg-accent',
          context.spacing === 0 && 'rounded-none shadow-none',
          context.spacing === 0 && isFirst && 'rounded-l-md',
          context.spacing === 0 && isLast && 'rounded-r-md',
          context.spacing === 0 && resolvedVariant === 'outline' && !isFirst && 'border-l-0',
          className,
        )}
        {...props}
      >
        {children}
      </Pressable>
    </TextClassContext.Provider>
  );
}

export { ToggleGroup, ToggleGroupItem };
