import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

function Input({ className, placeholderClassName, ...props }: TextInputProps & { ref?: React.Ref<TextInput> }) {
  return (
    <TextInput
      className={cn(
        'h-11 native:h-12 rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground web:flex web:w-full web:py-2 web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
        props.editable === false && 'opacity-50',
        className,
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      {...props}
    />
  );
}

export { Input };
