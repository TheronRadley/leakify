import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import * as React from 'react';

function Tabs({ className, ...props }: TabsPrimitive.RootProps & { ref?: React.Ref<TabsPrimitive.RootRef> }) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-2', className)} {...props} />;
}

function TabsList({ className, ...props }: TabsPrimitive.ListProps & { ref?: React.Ref<TabsPrimitive.ListRef> }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'web:inline-flex h-10 native:h-12 flex-row items-center justify-center rounded-md bg-muted p-1 native:px-1.5',
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.TriggerProps & { ref?: React.Ref<TabsPrimitive.TriggerRef> }) {
  const { value } = TabsPrimitive.useRootContext();
  return (
    <TextClassContext.Provider
      value={cn('text-sm font-medium', value === props.value ? 'text-foreground' : 'text-muted-foreground')}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'inline-flex h-full flex-1 items-center justify-center rounded-sm px-3 native:rounded-md web:whitespace-nowrap web:transition-all web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring',
          value === props.value && 'bg-background shadow-sm shadow-black/10',
          props.disabled && 'opacity-50 web:pointer-events-none',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.ContentProps & { ref?: React.Ref<TabsPrimitive.ContentRef> }) {
  return (
    <TabsPrimitive.Content
      className={cn('web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
