import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'lucide-react-native';
import * as React from 'react';

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.RootProps & { ref?: React.Ref<CheckboxPrimitive.RootRef> }) {
  return (
    <CheckboxPrimitive.Root
      role="checkbox"
      data-slot="checkbox"
      data-state={props.checked ? 'checked' : 'unchecked'}
      dataSet={{ slot: 'checkbox', state: props.checked ? 'checked' : 'unchecked' }}
      accessibilityState={{ checked: props.checked, disabled: props.disabled }}
      className={cn(
        'peer h-4 w-4 native:h-[18] native:w-[18] shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs web:transition-shadow web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50 dark:bg-input/30',
        props.checked && 'border-primary bg-primary text-primary-foreground dark:bg-primary',
        props.disabled && 'opacity-50 web:cursor-not-allowed',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="items-center justify-center text-current"
      >
        <Icon as={Check} size={13} strokeWidth={2.75} className="text-primary-foreground" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
