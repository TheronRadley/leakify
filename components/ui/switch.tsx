import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { Animated, Platform } from 'react-native';

function Switch({
  className,
  size = 'default',
  ...props
}: SwitchPrimitives.RootProps & {
  ref?: React.Ref<SwitchPrimitives.RootRef>;
  size?: 'sm' | 'default';
}) {
  const maxTranslate = size === 'default' ? 16 : 12;
  const [translateX] = React.useState(
    () => new Animated.Value(props.checked ? maxTranslate : 0),
  );

  React.useEffect(() => {
    Animated.spring(translateX, {
      toValue: props.checked ? maxTranslate : 0,
      damping: 18,
      stiffness: 260,
      mass: 0.6,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [props.checked, maxTranslate, translateX]);

  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      data-size={size}
      data-state={props.checked ? 'checked' : 'unchecked'}
      className={cn(
        'peer group/switch inline-flex shrink-0 flex-row items-center rounded-full border border-transparent p-0.5 shadow-xs web:cursor-pointer',
        size === 'default' ? 'h-5 w-9 native:h-[24] native:w-[42]' : 'h-4 w-7',
        props.checked ? 'bg-primary' : 'bg-input dark:bg-input/80',
        props.disabled && 'opacity-50 web:cursor-not-allowed',
        Platform.OS === 'web' &&
          'transition-colors duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb asChild>
        <Animated.View
          data-slot="switch-thumb"
          style={{ transform: [{ translateX }] }}
          className={cn(
            'pointer-events-none rounded-full bg-background ring-0 shadow-2xs dark:bg-primary-foreground',
            size === 'default' ? 'h-4 w-4 native:h-[18] native:w-[18]' : 'h-3 w-3',
            !props.checked && 'dark:bg-foreground',
          )}
        />
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  );
}

export { Switch };
