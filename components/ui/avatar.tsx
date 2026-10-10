import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';
import * as React from 'react';

function Avatar({
  className,
  ...props
}: AvatarPrimitive.RootProps & { ref?: React.Ref<AvatarPrimitive.RootRef> }) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: AvatarPrimitive.ImageProps & { ref?: React.Ref<AvatarPrimitive.ImageRef> }) {
  return <AvatarPrimitive.Image className={cn('aspect-square h-full w-full', className)} {...props} />;
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.FallbackProps & { ref?: React.Ref<AvatarPrimitive.FallbackRef> }) {
  return (
    <AvatarPrimitive.Fallback
      className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
