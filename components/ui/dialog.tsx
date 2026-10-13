import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { FadeInView } from '@/components/ui/motion';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  children,
  ...props
}: DialogPrimitive.OverlayProps & {
  ref?: React.Ref<DialogPrimitive.OverlayRef>;
  children?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      style={StyleSheet.absoluteFill}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Overlay>
  );
}

function DialogContent({
  className,
  children,
  portalHost,
  showCloseButton = true,
  ...props
}: DialogPrimitive.ContentProps & {
  ref?: React.Ref<DialogPrimitive.ContentRef>;
  portalHost?: string;
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        <FadeInView duration={200} offsetY={8} className="w-full max-w-lg items-center">
          <DialogPrimitive.Content
            data-slot="dialog-content"
            className={cn(
              'relative z-50 grid w-full max-w-lg gap-4 rounded-xl border border-border bg-background p-6 shadow-lg web:outline-none',
              className,
            )}
            {...props}
          >
            <TextClassContext.Provider value="text-foreground">
              {children}
            </TextClassContext.Provider>
            {showCloseButton ? (
              <DialogPrimitive.Close
                data-slot="dialog-close"
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
        </FadeInView>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="dialog-header"
      dataSet={{ slot: 'dialog-header' }}
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: ViewProps & { showCloseButton?: boolean }) {
  return (
    <View
      data-slot="dialog-footer"
      dataSet={{ slot: 'dialog-footer' }}
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">
            <Text>Close</Text>
          </Button>
        </DialogPrimitive.Close>
      ) : null}
    </View>
  );
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.TitleProps & { ref?: React.Ref<DialogPrimitive.TitleRef> }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DescriptionProps & { ref?: React.Ref<DialogPrimitive.DescriptionRef> }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
