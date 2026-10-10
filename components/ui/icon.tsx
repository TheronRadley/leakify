import { cn } from '@/lib/utils';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import * as React from 'react';

/**
 * RNR-style icon wrapper: enables `className` (text color / opacity) on any
 * lucide-react-native icon via cssInterop.
 */
export function iconWithClassName(icon: LucideIcon) {
  cssInterop(icon, {
    className: {
      target: 'style',
      nativeStyleToProp: {
        color: true,
        opacity: true,
      },
    },
  });
}

interface IconProps extends LucideProps {
  as: LucideIcon;
  className?: string;
}

export function Icon({ as: IconComponent, className, size = 24, ...props }: IconProps) {
  iconWithClassName(IconComponent);
  return <IconComponent size={size} className={cn('text-foreground', className)} {...props} />;
}
