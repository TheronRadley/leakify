import { cn } from '@/lib/utils';
import * as React from 'react';
import { Animated, Easing, View, type ViewProps } from 'react-native';

export interface ProgressProps extends ViewProps {
  /** Value between 0 and 100. */
  value?: number | null;
  indicatorClassName?: string;
}

function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value ?? 0));
  const [animWidth] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const anim = Animated.timing(animWidth, {
      toValue: clamped,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [animWidth, clamped]);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      data-slot="progress"
      dataSet={{ slot: 'progress' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/15',
        className,
      )}
      {...props}
    >
      <Animated.View
        data-slot="progress-indicator"
        dataSet={{ slot: 'progress-indicator' }}
        className={cn('h-full rounded-full bg-primary', indicatorClassName)}
        style={{ width: widthInterpolated }}
      />
    </View>
  );
}

export { Progress };
