import { Text as RNText } from '@/components/ui/text';
import { Link as RouterLink, type LinkProps } from 'expo-router';
import * as React from 'react';

/** Inline navigation link styled as interactive text. */
export function Link({ href, children }: { href: LinkProps['href']; children: string }) {
  return (
    <RouterLink href={href} asChild>
      <RNText variant="muted" className="font-semibold text-primary" accessibilityRole="link">
        {children}
      </RNText>
    </RouterLink>
  );
}

export const Text = RNText;
