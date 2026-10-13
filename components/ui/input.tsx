import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

function Input({
  className,
  placeholderClassName,
  ...props
}: TextInputProps & { ref?: React.Ref<TextInput> }) {
  return (
    <TextInput
      data-slot="input"
      dataSet={{ slot: 'input' }}
      className={cn(
        'h-9 native:h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base text-foreground shadow-xs placeholder:text-muted-foreground web:flex web:transition-[color,box-shadow] web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
        props.editable === false && 'opacity-50 web:pointer-events-none web:cursor-not-allowed',
        className,
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      {...props}
    />
  );
}

export { Input };
