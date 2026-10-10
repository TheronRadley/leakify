import { cn } from '@/lib/utils';
import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';

function Textarea({ className, multiline = true, placeholderClassName, ...props }: TextInputProps & { ref?: React.Ref<TextInput> }) {
  return (
    <TextInput
      className={cn(
        'min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring',
        props.editable === false && 'opacity-50',
        className,
      )}
      placeholderClassName={cn('text-muted-foreground', placeholderClassName)}
      multiline={multiline}
      textAlignVertical="top"
      {...props}
    />
  );
}

export { Textarea };
