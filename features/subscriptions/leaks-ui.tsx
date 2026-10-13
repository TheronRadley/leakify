/**
 * Presentation for leak findings produced by the pure detector,
 * built on shadcn/ui `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, and `Badge`.
 */
import { CurrencyTotalsText } from '@/components/shared/money';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { ScaleOnPress } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LeakFinding } from '@/types';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  BellRing,
  CalendarX2,
  Copy,
  EyeOff,
  TrendingUp,
} from 'lucide-react-native';
import * as React from 'react';

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
  info: {
    wrap: 'border-border bg-card',
    glyph: 'text-muted-foreground',
    badge: 'secondary' as const,
  },
  warning: {
    wrap: 'border-warning/40 bg-warning/10 dark:bg-warning/15',
    glyph: 'text-warning',
    badge: 'warning' as const,
  },
  urgent: {
    wrap: 'border-destructive/40 bg-destructive/10 dark:bg-destructive/15',
    glyph: 'text-destructive',
    badge: 'destructive' as const,
  },
} as const;

export function LeakFindingUI({ finding }: { finding: LeakFinding }) {
  const router = useRouter();
  const styles = SEVERITY_STYLES[finding.severity];
  const icon = KIND_ICONS[finding.kind] ?? AlertTriangle;
  const target = finding.subscriptionIds[0];

  return (
    <ScaleOnPress
      scaleTo={0.99}
      disabled={!target}
      accessibilityRole={target ? 'button' : 'text'}
      accessibilityLabel={`${finding.title}. ${finding.explanation}`}
      onPress={() => {
        if (target) router.push(`/subscription/${target}`);
      }}
    >
      <Item
        variant="outline"
        size="sm"
        className={cn('rounded-lg web:hover:bg-accent/40 active:opacity-80', styles.wrap)}
      >
        <ItemMedia variant="icon">
          <Icon as={icon} size={16} className={styles.glyph} />
        </ItemMedia>
        <ItemContent className="min-w-0 flex-1">
          <ItemTitle className="font-semibold leading-5">{finding.title}</ItemTitle>
          <ItemDescription className="text-xs leading-4">{finding.explanation}</ItemDescription>
        </ItemContent>
        {finding.estimatedMonthlyCents?.length ? (
          <ItemActions>
            <Badge variant={styles.badge}>
              <CurrencyTotalsText
                totals={finding.estimatedMonthlyCents}
                variant="small"
                className="text-xs"
              />
              <Text className="text-[11px]">/mo</Text>
            </Badge>
          </ItemActions>
        ) : null}
      </Item>
    </ScaleOnPress>
  );
}
