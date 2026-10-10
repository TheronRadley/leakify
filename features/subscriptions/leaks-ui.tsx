/**
 * Presentation for leak findings produced by the pure detector.
 */
import { CurrencyTotalsText } from '@/components/shared/money';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { AlertTriangle, BellRing, CalendarX2, Copy, EyeOff, TrendingUp } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import type { LeakFinding } from '@/types';

export { detectLeaks, findDuplicateCandidates } from '@/features/subscriptions/leak-detector';

const KIND_ICONS = {
  duplicate_candidate: Copy,
  trial_ending: BellRing,
  missing_billing_date: CalendarX2,
  flagged_unused: EyeOff,
  large_upcoming_total: TrendingUp,
  price_increase: TrendingUp,
} as const;

const SEVERITY_STYLES = {
  info: { wrap: 'border-border bg-card', glyph: 'text-muted-foreground' },
  warning: { wrap: 'border-warning/50 bg-warning/10 dark:bg-warning/15', glyph: 'text-warning' },
  urgent: { wrap: 'border-destructive/50 bg-destructive/10 dark:bg-destructive/15', glyph: 'text-destructive' },
} as const;

export function LeakFindingUI({ finding }: { finding: LeakFinding }) {
  const router = useRouter();
  const styles = SEVERITY_STYLES[finding.severity];
  const icon = KIND_ICONS[finding.kind] ?? AlertTriangle;
  const target = finding.subscriptionIds[0];

  return (
    <Pressable
      className={cn('gap-2 rounded-lg border p-3.5 active:opacity-80', styles.wrap)}
      accessibilityRole={target ? 'button' : 'text'}
      accessibilityLabel={`${finding.title}. ${finding.explanation}`}
      onPress={() => {
        if (target) router.push(`/subscription/${target}`);
      }}
    >
      <View className="flex-row items-start gap-2.5">
        <Icon as={icon} size={18} className={cn('mt-0.5', styles.glyph)} />
        <View className="flex-1 gap-1">
          <Text className="font-semibold leading-5">{finding.title}</Text>
          <Text variant="small" className="leading-4 text-muted-foreground">
            {finding.explanation}
          </Text>
          {finding.estimatedMonthlyCents?.length ? (
            <View className="flex-row items-center gap-1 pt-0.5">
              <Text variant="small" className="text-muted-foreground">
                Potential saving:
              </Text>
              <CurrencyTotalsText totals={finding.estimatedMonthlyCents} variant="small" />
              <Text variant="small" className="text-muted-foreground">
                /mo
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
