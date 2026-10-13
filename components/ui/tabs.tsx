import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

function Tabs({
  className,
  ...props
}: TabsPrimitive.RootProps & { ref?: React.Ref<TabsPrimitive.RootRef> }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  'flex max-w-full flex-row flex-wrap items-center rounded-lg p-1 text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'gap-1 bg-muted',
        line: 'gap-1 rounded-none bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function TabsList({
  className,
  variant = 'default',
  ...props
}: TabsPrimitive.ListProps &
  VariantProps<typeof tabsListVariants> & { ref?: React.Ref<TabsPrimitive.ListRef> }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant ?? 'default'}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.TriggerProps & { ref?: React.Ref<TabsPrimitive.TriggerRef> }) {
  const { value } = TabsPrimitive.useRootContext();
  const isActive = props.value === value;
  return (
    <TextClassContext.Provider
      value={cn(
        'text-xs sm:text-sm font-medium',
        isActive ? 'text-foreground' : 'text-foreground/60 dark:text-muted-foreground',
      )}
    >
      <TabsPrimitive.Trigger
        data-slot="tabs-trigger"
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'inline-flex min-h-8 shrink-0 flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-xs font-medium sm:text-sm web:whitespace-nowrap web:transition-all web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50',
          props.disabled && 'opacity-50 web:pointer-events-none',
          isActive &&
            'bg-background shadow-sm dark:border-input dark:bg-input/30 dark:text-foreground',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.ContentProps & { ref?: React.Ref<TabsPrimitive.ContentRef> }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('web:outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger };
