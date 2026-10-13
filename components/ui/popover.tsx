import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@rn-primitives/dialog';
import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

const Popover = DialogPrimitive.Root;
const PopoverTrigger = DialogPrimitive.Trigger;

function PopoverContent({
  className,
  portalHost,
  ...props
}: DialogPrimitive.ContentProps & {
  ref?: React.Ref<DialogPrimitive.ContentRef>;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  portalHost?: string;
}) {
  return (
    <DialogPrimitive.Portal hostName={portalHost}>
      <DialogPrimitive.Overlay
        style={Platform.OS !== 'web' ? StyleSheet.absoluteFill : undefined}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      >
        <TextClassContext.Provider value="text-popover-foreground">
          <DialogPrimitive.Content
            data-slot="popover-content"
            className={cn(
              'z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md web:outline-none',
              className,
            )}
            {...props}
          />
        </TextClassContext.Provider>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="popover-header"
      dataSet={{ slot: 'popover-header' }}
      className={cn('flex flex-col gap-1 text-sm', className)}
      {...props}
    />
  );
}

function PopoverTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="popover-title"
      dataSet={{ slot: 'popover-title' }}
      className={cn('font-medium text-popover-foreground', className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      data-slot="popover-description"
      dataSet={{ slot: 'popover-description' }}
      variant="muted"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
