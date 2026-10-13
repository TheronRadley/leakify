import { cn } from '@/lib/utils';
import * as React from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

/** shadcn/ui pulsing skeleton placeholder. */
export function Skeleton({ className, ...props }: ViewProps) {
  const [opacity] = React.useState(() => new Animated.Value(1));

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      data-slot="skeleton"
      dataSet={{ slot: 'skeleton' }}
      style={[{ opacity }]}
      className={cn('rounded-md bg-accent', className)}
      {...props}
    />
  );
}
