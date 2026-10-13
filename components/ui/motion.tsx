import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface FadeInViewProps extends ViewProps {
  /** Delay in ms before starting the entrance animation. */
  delay?: number;
  /** Stagger index (multiplied by 55ms). */
  index?: number;
  /** Duration in ms (default 340). */
  duration?: number;
  /** Initial vertical offset in px (default 10). */
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Smooth staggered entrance container (fade + upward slide).
 */
export function FadeInView({
  delay = 0,
  index = 0,
  duration = 340,
  offsetY = 10,
  style,
  className,
  children,
  ...props
}: FadeInViewProps) {
  const totalDelay = delay + index * 55;
  const [progress] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay: totalDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, duration, totalDelay]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View
      style={[{ opacity: progress, transform: [{ translateY }] }, style]}
      className={className}
      {...props}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Tactile spring scale wrapper for interactive rows, cards, and buttons.
 * Applies `className` to the outer `Pressable` so flex/width utilities work natively.
 */
export function ScaleOnPress({
  scaleTo = 0.985,
  hoverScale = 1.005,
  onPressIn,
  onPressOut,
  onHoverIn,
  onHoverOut,
  style,
  className,
  children,
  ...props
}: Omit<PressableProps, 'children'> & {
  scaleTo?: number;
  hoverScale?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [scale] = React.useState(() => new Animated.Value(1));

  const animateTo = React.useCallback(
    (target: number) => {
      Animated.spring(scale, {
        toValue: target,
        damping: 18,
        stiffness: 280,
        mass: 0.6,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    },
    [scale],
  );

  return (
    <Pressable
      className={className}
      onPressIn={(e) => {
        animateTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        animateTo(hoverScale);
        onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        animateTo(1);
        onHoverOut?.(e);
      }}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]} className="w-full">
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Live radar-pulse indicator dot for urgent renewals, trials, and active status badges.
 */
export function LivePulseDot({
  tone = 'primary',
  size = 8,
  className,
}: {
  tone?: 'primary' | 'warning' | 'destructive' | 'success';
  size?: number;
  className?: string;
}) {
  const [pulse] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0.65, 0.2, 0],
  });

  const colorClass =
    tone === 'destructive'
      ? 'bg-destructive'
      : tone === 'warning'
        ? 'bg-warning'
        : tone === 'success'
          ? 'bg-success'
          : 'bg-primary';

  return (
    <View
      style={{ width: size * 2, height: size * 2 }}
      className={cn('relative items-center justify-center', className)}
      accessibilityElementsHidden
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
        className={cn('absolute', colorClass)}
      />
      <View
        style={{ width: size, height: size, borderRadius: size / 2 }}
        className={colorClass}
      />
    </View>
  );
}
