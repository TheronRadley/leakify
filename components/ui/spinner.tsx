import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react-native';
import * as React from 'react';
import { Animated, Easing, type ViewProps } from 'react-native';

function Spinner({
  className,
  size = 16,
  ...props
}: ViewProps & { size?: number }) {
  const [spin] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      role="status"
      aria-label="Loading"
      data-slot="spinner"
      dataSet={{ slot: 'spinner' }}
      style={{ transform: [{ rotate }] }}
      className={cn('items-center justify-center', className)}
      {...props}
    >
      <Icon as={Loader2} size={size} className={cn('text-current', className)} />
    </Animated.View>
  );
}

export { Spinner };
