import { cn } from '@/lib/utils';
import * as React from 'react';
import { ScrollView, type ScrollViewProps, View, type ViewProps } from 'react-native';

function ScrollArea({ className, children, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      data-slot="scroll-area"
      className={cn('relative', className)}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ViewProps & { orientation?: 'vertical' | 'horizontal' }) {
  return (
    <View
      data-slot="scroll-area-scrollbar"
      dataSet={{ slot: 'scroll-area-scrollbar', orientation }}
      className={cn(
        'flex select-none',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-px',
        orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-px',
        className,
      )}
      {...props}
    />
  );
}

export { ScrollArea, ScrollBar };
