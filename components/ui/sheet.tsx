import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

function SheetOverlay({
  className,
  children,
  ...props
}: DialogPrimitive.OverlayProps & {
  ref?: React.Ref<DialogPrimitive.OverlayRef>;
  children?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      style={StyleSheet.absoluteFill}
      className={cn('fixed inset-0 z-50 bg-black/50', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Overlay>
  );
}

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  portalHost,
  ...props
}: DialogPrimitive.ContentProps & {
  ref?: React.Ref<DialogPrimitive.ContentRef>;
  side?: 'top' | 'right' | 'bottom' | 'left';
  showCloseButton?: boolean;
  portalHost?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <SheetPortal hostName={portalHost}>
      <SheetOverlay>
        <DialogPrimitive.Content
          data-slot="sheet-content"
          style={{
            paddingTop: side === 'left' || side === 'right' || side === 'top' ? insets.top : 0,
            paddingBottom:
              side === 'left' || side === 'right' || side === 'bottom' ? insets.bottom : 0,
          }}
          className={cn(
            'absolute z-50 flex flex-col gap-4 bg-background shadow-lg',
            side === 'right' && 'inset-y-0 right-0 h-full w-4/5 max-w-[300px] border-l border-border',
            side === 'left' && 'inset-y-0 left-0 h-full w-4/5 max-w-[300px] border-r border-border',
            side === 'top' && 'inset-x-0 top-0 h-auto border-b border-border',
            side === 'bottom' && 'inset-x-0 bottom-0 h-auto border-t border-border',
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              data-slot="sheet-close"
              className={cn(
                'absolute right-4 top-4 rounded-xs p-1 opacity-70 web:transition-opacity web:hover:opacity-100',
                Platform.OS === 'web' && 'focus:outline-none focus:ring-2 focus:ring-ring',
              )}
              accessibilityLabel="Close"
            >
              <Icon as={X} size={16} className="text-muted-foreground" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </SheetOverlay>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sheet-header"
      dataSet={{ slot: 'sheet-header' }}
      className={cn('flex flex-col gap-1.5 p-4', className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sheet-footer"
      dataSet={{ slot: 'sheet-footer' }}
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: DialogPrimitive.TitleProps & { ref?: React.Ref<DialogPrimitive.TitleRef> }) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.DescriptionProps & { ref?: React.Ref<DialogPrimitive.DescriptionRef> }) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
