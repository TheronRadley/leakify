import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Standard horizontal padding (default true). */
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra content fixed below the scroll area, inside the safe area. */
  footer?: React.ReactNode;
  edges?: ('top' | 'bottom')[];
  contentContainerClassName?: string;
}

/** Standard screen container with centered max-width and safe-area handling across all app screens. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  footer,
  edges = [],
  className,
  contentContainerClassName,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const topPad = edges.includes('top') ? insets.top : 0;
  const bottomPad = edges.includes('bottom') ? insets.bottom : 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="flex-1" style={[{ paddingTop: topPad }]} {...props}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerClassName={cn(
              'mx-auto w-full max-w-5xl flex-col gap-5',
              padded && 'px-4 pt-4 pb-12 md:px-6 md:pt-6',
              className,
              contentContainerClassName,
            )}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View
            className={cn(
              'mx-auto w-full max-w-5xl flex-1 flex-col gap-5',
              padded && 'px-4 pt-4 pb-8 md:px-6 md:pt-6',
              className,
              contentContainerClassName,
            )}
          >
            {children}
          </View>
        )}
        {footer ? (
          <View
            style={{ paddingBottom: Math.max(bottomPad, 12) }}
            className="mx-auto w-full max-w-5xl px-4 md:px-6"
          >
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
