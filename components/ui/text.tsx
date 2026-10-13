import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '@/lib/utils';

const TextClassContext = React.createContext<string | undefined>(undefined);

const textVariants = cva('text-foreground web:select-text', {
  variants: {
    variant: {
      default: 'text-sm leading-5',
      h1: 'text-3xl font-bold tracking-tight sm:text-4xl',
      h2: 'text-2xl font-semibold tracking-tight',
      h3: 'text-xl font-semibold tracking-tight',
      h4: 'text-base font-semibold tracking-tight',
      p: 'text-sm leading-6',
      blockquote: 'mt-4 border-l-2 border-border pl-4 italic text-muted-foreground',
      code: 'rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground',
      lead: 'text-base text-muted-foreground leading-6',
      large: 'text-base font-semibold tracking-tight',
      small: 'text-xs font-medium leading-4',
      muted: 'text-xs text-muted-foreground leading-5',
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
