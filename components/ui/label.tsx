import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@rn-primitives/label';
import * as React from 'react';

function Label({
  className,
  onPress,
  ...props
}: LabelPrimitive.TextProps & { ref?: React.Ref<LabelPrimitive.TextRef> }) {
  return (
    <LabelPrimitive.Root className="web:cursor-default" onPress={onPress}>
      <LabelPrimitive.Text
        data-slot="label"
        className={cn(
          'flex items-center gap-2 text-sm font-medium leading-none text-foreground select-none web:peer-disabled:cursor-not-allowed web:peer-disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}

export { Label };
