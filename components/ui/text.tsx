import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '@/lib/utils';

const TextClassContext = React.createContext<string | undefined>(undefined);

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: 'text-base',
      h1: 'text-4xl font-extrabold tracking-tight',
      h2: 'text-3xl font-bold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold',
      p: 'text-base leading-7',
      blockquote: 'mt-4 border-l-2 border-border pl-4 italic',
      code: 'rounded-md bg-muted px-1 py-0.5 font-mono text-sm',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  VariantProps<typeof textVariants> & { asChild?: boolean }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot.Text : RNText;
  return (
    <Component className={cn(textVariants({ variant }), textClass, className)} {...props} />
  );
}

export { Text, TextClassContext, textVariants };
