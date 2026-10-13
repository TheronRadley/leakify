import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function Kbd({ className, children, ...props }: ViewProps & { children?: React.ReactNode }) {
  return (
    <View
      data-slot="kbd"
      dataSet={{ slot: 'kbd' }}
      className={cn(
        'pointer-events-none inline-flex h-5 w-fit min-w-5 flex-row items-center justify-center gap-1 rounded-sm bg-muted px-1.5 select-none',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className="font-sans text-xs font-medium text-muted-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function KbdGroup({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="kbd-group"
      dataSet={{ slot: 'kbd-group' }}
      className={cn('inline-flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
