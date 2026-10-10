import { useSemanticColors } from '@/lib/theme';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { Text } from '@/components/ui/text';

/**
 * Leakify mark: a droplet (the money that leaks away) with a contained
 * waterline + stopper base (the leak under control). Recognizable at app-icon
 * size: single hue, two shapes, no text.
 */
export function LeakifyMark({
  size = 32,
  color,
  waveColor = '#FFFFFF',
}: {
  size?: number;
  color?: string;
  waveColor?: string;
}) {
  const colors = useSemanticColors();
  const drop = color ?? colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Leakify logo">
      <Defs>
        <ClipPath id="dropClip">
          <Path d="M24 4c-3.2 5-6.4 9.2-9.6 12.8C10.4 21.4 8 25.4 8 30a16 16 0 0 0 32 0c0-4.6-2.4-8.6-6.4-13.2C30.4 13.2 27.2 9 24 4z" />
        </ClipPath>
      </Defs>
      {/* Droplet body */}
      <Path
        d="M24 4c-3.2 5-6.4 9.2-9.6 12.8C10.4 21.4 8 25.4 8 30a16 16 0 0 0 32 0c0-4.6-2.4-8.6-6.4-13.2C30.4 13.2 27.2 9 24 4z"
        fill={drop}
      />
      {/* Contained water: a calm wave clipped inside the droplet */}
      <G clipPath="url(#dropClip)">
        <Path
          d="M4 28c4-2 8-2 12 0s8 2 12 0 8-2 12 0v18H4z"
          fill={waveColor}
          opacity={0.9}
        />
        <Rect x="4" y="42" width="40" height="4" rx="2" fill={drop} opacity={0.22} />
      </G>
    </Svg>
  );
}

/** Full lockup: mark + wordmark for onboarding and headers. */
export function LeakifyLogo({ size = 40, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  if (!showWordmark) return <LeakifyMark size={size} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.25 }}>
      <LeakifyMark size={size} />
      <Text style={{ fontSize: size * 0.55, lineHeight: size * 0.62 }} className="font-extrabold text-foreground">
        Leakify
      </Text>
    </View>
  );
}
