import { cn } from '@/lib/utils';
import * as React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Standard 16px horizontal padding (default true). */
  padded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra content fixed below the scroll area, inside the safe area. */
  footer?: React.ReactNode;
  edges?: ('top' | 'bottom')[];
}

/** Standard screen container with safe-area handling across all app screens. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshing,
  onRefresh,
  footer,
  edges = ['top'],
  className,
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
      <View className={cn('flex-1', className)} style={[{ paddingTop: topPad }]} {...props}>
        {scroll ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName={cn(padded && 'px-4 pb-8')}
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
          <View className={cn('flex-1', padded && 'px-4 pb-8')}>{children}</View>
        )}
        {footer ? (
          <View style={{ paddingBottom: Math.max(bottomPad, 12) }} className="px-4">
            {footer}
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
