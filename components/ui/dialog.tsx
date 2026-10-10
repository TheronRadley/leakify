import { Icon } from '@/components/ui/icon';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@rn-primitives/dialog';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Platform, View, type ViewProps } from 'react-native';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlayWeb({
  className,
  ...props
}: DialogPrimitive.OverlayProps & { ref?: React.Ref<DialogPrimitive.OverlayRef> }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-black/60 p-2',
        'web:fixed web:animate-in web:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogOverlayNative({
  className,
  children,
  ...props
}: DialogPrimitive.OverlayProps & { ref?: React.Ref<DialogPrimitive.OverlayRef> }) {
  return (
    <DialogPrimitive.Overlay
      className={cn('flex-1 items-center justify-center bg-black/60 p-4', className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Overlay>
  );
}

const DialogOverlay = Platform.select({ web: DialogOverlayWeb, default: DialogOverlayNative });

function DialogContent({
  className,
  children,
  portalHost,
  ...props
}: DialogPrimitive.ContentProps & {
  ref?: React.Ref<DialogPrimitive.ContentRef>;
  className?: string;
  portalHost?: string;
}) {
  return (
    <DialogPortal hostName={portalHost}>
      <DialogOverlay>
        <DialogPrimitive.Content
          className={cn(
            'w-full max-w-lg gap-4 rounded-lg border border-border bg-background p-6 shadow-lg web:animate-in web:fade-in-0 web:zoom-in-95',
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 active:opacity-100 web:outline-none web:ring-ring web:focus-visible:ring-2"
            accessibilityLabel="Close dialog"
          >
            <Icon as={X} size={20} className="text-muted-foreground" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogOverlay>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col gap-1.5 text-center native:text-left', className)} {...props} />;
}

function DialogFooter({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col-reverse gap-2 native:flex-row native:justify-end', className)} {...props} />;
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.TitleProps & { ref?: React.Ref<DialogPrimitive.TitleRef> }) {
  return (
    <TextClassContext.Provider value="text-foreground">
      <DialogPrimitive.Title className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)} {...props} />
    </TextClassContext.Provider>
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.DescriptionProps & { ref?: React.Ref<DialogPrimitive.DescriptionRef> }) {
  return (
    <TextClassContext.Provider value="text-muted-foreground">
      <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
    </TextClassContext.Provider>
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
export type { DialogProps } from './dialog-types';
