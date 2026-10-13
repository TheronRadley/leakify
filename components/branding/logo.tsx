import { Text } from '@/components/ui/text';
import { useSemanticColors } from '@/lib/theme';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/**
 * Leakify mark: a droplet (the money that leaks away) with a contained
 * waterline + stopper base (the leak under control). Recognizable at app-icon
 * size: single hue, two shapes, no text.
 */
export function LeakifyMark({
  size = 32,
  color,
  waveColor,
}: {
  size?: number;
  color?: string;
  waveColor?: string;
}) {
  const colors = useSemanticColors();
  const drop = color ?? colors.primary;
  const wave = waveColor ?? colors.primaryForeground;
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
          fill={wave}
          opacity={0.92}
        />
        <Rect x="4" y="42" width="40" height="4" rx="2" fill={drop} opacity={0.22} />
      </G>
    </Svg>
  );
}

/** Full lockup: shadcn-inspired square emblem + crisp tracking-tight wordmark. */
export function LeakifyLogo({ size = 36, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  const colors = useSemanticColors();
  const boxSize = Math.round(size * 0.9);
  const markSize = Math.round(size * 0.62);

  const badge = (
    <View
      style={{ width: boxSize, height: boxSize }}
      className="items-center justify-center rounded-lg border border-border/50 bg-primary shadow-sm"
    >
      <LeakifyMark
        size={markSize}
        color={colors.primaryForeground}
        waveColor={colors.primary}
      />
    </View>
  );

  if (!showWordmark) return badge;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Math.round(size * 0.25) }}>
      {badge}
      <Text
        style={{ fontSize: Math.round(size * 0.52), lineHeight: Math.round(size * 0.6) }}
        className="font-bold tracking-tight text-foreground"
      >
        Leakify
      </Text>
    </View>
  );
}
