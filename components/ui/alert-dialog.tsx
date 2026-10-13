import { buttonTextVariants, buttonVariants } from '@/components/ui/button';
import { FadeInView } from '@/components/ui/motion';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as AlertDialogPrimitive from '@rn-primitives/alert-dialog';
import * as React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

function AlertDialogOverlay({
  className,
  children,
  ...props
}: AlertDialogPrimitive.OverlayProps & {
  ref?: React.Ref<AlertDialogPrimitive.OverlayRef>;
  children?: React.ReactNode;
}) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      style={StyleSheet.absoluteFill}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4',
        className,
      )}
      {...props}
    >
      {children}
    </AlertDialogPrimitive.Overlay>
  );
}

function AlertDialogContent({
  className,
  portalHost,
  size = 'default',
  ...props
}: AlertDialogPrimitive.ContentProps & {
  ref?: React.Ref<AlertDialogPrimitive.ContentRef>;
  portalHost?: string;
  size?: 'default' | 'sm';
}) {
  return (
    <AlertDialogPortal hostName={portalHost}>
      <AlertDialogOverlay>
        <FadeInView duration={200} offsetY={8} className="w-full max-w-lg items-center">
          <AlertDialogPrimitive.Content
            data-slot="alert-dialog-content"
            data-size={size}
            className={cn(
              'group/alert-dialog-content z-50 grid w-full max-w-lg gap-4 rounded-xl border border-border bg-background p-6 shadow-lg',
              size === 'sm' && 'max-w-xs',
              className,
            )}
            {...props}
          />
        </FadeInView>
      </AlertDialogOverlay>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="alert-dialog-header"
      dataSet={{ slot: 'alert-dialog-header' }}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="alert-dialog-footer"
      dataSet={{ slot: 'alert-dialog-footer' }}
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

function AlertDialogMedia({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="alert-dialog-media"
      dataSet={{ slot: 'alert-dialog-media' }}
      className={cn(
        'mb-2 inline-flex h-16 w-16 items-center justify-center rounded-md bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.TitleProps & { ref?: React.Ref<AlertDialogPrimitive.TitleRef> }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.DescriptionProps & {
  ref?: React.Ref<AlertDialogPrimitive.DescriptionRef>;
}) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-sm leading-5 text-muted-foreground', className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: AlertDialogPrimitive.ActionProps & {
  ref?: React.Ref<AlertDialogPrimitive.ActionRef>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg';
}) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <AlertDialogPrimitive.Action
        data-slot="alert-dialog-action"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function AlertDialogCancel({
  className,
  variant = 'outline',
  size = 'default',
  ...props
}: AlertDialogPrimitive.CancelProps & {
  ref?: React.Ref<AlertDialogPrimitive.CancelRef>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'xs' | 'sm' | 'lg';
}) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <AlertDialogPrimitive.Cancel
        data-slot="alert-dialog-cancel"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
