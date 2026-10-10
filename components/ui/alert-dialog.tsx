import { buttonTextVariants, buttonVariants } from '@/components/ui/button';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as AlertDialogPrimitive from '@rn-primitives/alert-dialog';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.OverlayProps & { ref?: React.Ref<AlertDialogPrimitive.OverlayRef> }) {
  return (
    <AlertDialogPrimitive.Overlay
      className={cn(
        'flex-1 items-center justify-center bg-black/60 p-6 web:fixed web:inset-0 web:flex web:animate-in web:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  portalHost,
  ...props
}: AlertDialogPrimitive.ContentProps & {
  ref?: React.Ref<AlertDialogPrimitive.ContentRef>;
  portalHost?: string;
}) {
  return (
    <AlertDialogPrimitive.Portal hostName={portalHost}>
      <AlertDialogOverlay>
        <TextClassContext.Provider value="text-foreground">
          <AlertDialogPrimitive.Content
            className={cn(
              'w-full max-w-md gap-4 rounded-lg border border-border bg-background p-6 shadow-lg web:animate-in web:fade-in-0 web:zoom-in-95',
              className,
            )}
            {...props}
          />
        </TextClassContext.Provider>
      </AlertDialogOverlay>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col-reverse gap-2 native:flex-row native:justify-end', className)} {...props} />;
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.TitleProps & { ref?: React.Ref<AlertDialogPrimitive.TitleRef> }) {
  return (
    <AlertDialogPrimitive.Title
      className={cn('text-lg font-semibold text-foreground', className)}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.DescriptionProps & { ref?: React.Ref<AlertDialogPrimitive.DescriptionRef> }) {
  return (
    <AlertDialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  ...props
}: AlertDialogPrimitive.ActionProps & { ref?: React.Ref<AlertDialogPrimitive.ActionRef> }) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant: 'default' })}>
      <AlertDialogPrimitive.Action className={cn(buttonVariants(), className)} {...props} />
    </TextClassContext.Provider>
  );
}

function AlertDialogCancel({
  className,
  ...props
}: AlertDialogPrimitive.CancelProps & { ref?: React.Ref<AlertDialogPrimitive.CancelRef> }) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant: 'outline' })}>
      <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: 'outline' }), 'native:mt-0', className)} {...props} />
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
  AlertDialogTitle,
  AlertDialogTrigger,
};
