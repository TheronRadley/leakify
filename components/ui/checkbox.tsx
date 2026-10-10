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
      accessibilityState={{ checked: props.checked, disabled: props.disabled }}
      className={cn(
        'h-5 w-5 native:h-[20] native:w-[20] items-center justify-center rounded-[6px] border border-primary',
        props.checked && 'bg-primary',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Icon as={Check} size={14} className="text-primary-foreground" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
