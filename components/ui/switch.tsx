import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { Platform } from 'react-native';

function Switch({
  className,
  ...props
}: SwitchPrimitives.RootProps & { ref?: React.Ref<SwitchPrimitives.RootRef> }) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'web:cursor-pointer h-6 w-11 native:h-[32] native:w-[51] flex-row items-center rounded-full border-2 border-transparent',
        props.checked ? 'bg-primary' : 'bg-input',
        props.disabled && 'opacity-50',
        Platform.OS === 'web' && 'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'h-5 w-5 native:h-[27] native:w-[27] rounded-full bg-white shadow-sm shadow-black/25 transition-transform',
          props.checked ? 'translate-x-5 native:translate-x-[18]' : 'translate-x-0',
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
