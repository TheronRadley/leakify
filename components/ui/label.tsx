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
        className={cn(
          'text-sm font-medium leading-none text-foreground native:text-base web:peer-disabled:cursor-not-allowed web:peer-disabled:opacity-70',
          className,
        )}
        {...props}
      />
    </LabelPrimitive.Root>
  );
}

export { Label };
