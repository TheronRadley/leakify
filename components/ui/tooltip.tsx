import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function TooltipProvider({ children }: { children: React.ReactNode; delayDuration?: number }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function TooltipTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

function TooltipContent({ className, ...props }: ViewProps & { sideOffset?: number }) {
  return (
    <TextClassContext.Provider value="text-xs text-background">
      <View
        data-slot="tooltip-content"
        dataSet={{ slot: 'tooltip-content' }}
        className={cn(
          'z-50 w-fit rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md',
          className,
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
