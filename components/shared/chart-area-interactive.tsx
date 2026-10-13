import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { contributesToRecurringSpend, monthlyEquivalentCents } from '@/lib/billing';
import { categoryLabel } from '@/lib/constants';
import { formatMoney } from '@/lib/currency';
import { useAppTheme } from '@/lib/theme';
import type { CurrencyCode, Subscription } from '@/types';
import * as React from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

const chartConfig = {
  recurring: {
    label: 'Recurring Spend',
    color: '#2563EB',
  },
  projected: {
    label: 'Cumulative / Trial',
    color: '#10B981',
  },
} satisfies ChartConfig;

type ChartMode = '6m' | '12m' | 'categories';

interface DataPoint {
  key: string;
  label: string;
  shortLabel: string;
  primaryCents: number;
  secondaryCents: number;
  count: number;
}

function buildSmoothAreaPath(
  points: { x: number; y: number }[],
  baselineY: number,
): { linePath: string; areaPath: string } {
  if (points.length === 0) return { linePath: '', areaPath: '' };
  if (points.length === 1) {
    const p = points[0];
    const line = `M 0 ${p.y} L ${p.x * 2} ${p.y}`;
    const area = `${line} L ${p.x * 2} ${baselineY} L 0 ${baselineY} Z`;
    return { linePath: line, areaPath: area };
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = ((curr.x + next.x) / 2).toFixed(1);
    d += ` C ${midX} ${curr.y.toFixed(1)}, ${midX} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const area = `${d} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
  return { linePath: d, areaPath: area };
}

/**
 * Interactive Area & Category Spend Chart modeled after shadcn/ui `dashboard-01` (`chart-area-interactive.tsx`).
 * Uses `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction` with `ToggleGroup`,
 * `ChartContainer`, `ChartTooltipContent`, and smooth SVG cubic-bezier curves.
 */
export function ChartAreaInteractive({
  subscriptions,
  preferredCurrency = 'USD',
}: {
  subscriptions: Subscription[];
  preferredCurrency?: CurrencyCode;
}) {
  const isMobile = useIsMobile();
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const [mode, setMode] = React.useState<ChartMode>('6m');
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const [measuredWidth, setMeasuredWidth] = React.useState<number>(0);
  const [reveal] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [mode, reveal, subscriptions.length]);

  const activeSubs = React.useMemo(
    () => subscriptions.filter(contributesToRecurringSpend),
    [subscriptions],
  );

  const primaryCurrency: CurrencyCode = React.useMemo(() => {
    if (activeSubs.some((s) => s.currency === preferredCurrency)) return preferredCurrency;
    return activeSubs[0]?.currency ?? preferredCurrency;
  }, [activeSubs, preferredCurrency]);

  const points: DataPoint[] = React.useMemo(() => {
    const currencySubs = activeSubs.filter((s) => s.currency === primaryCurrency);
    const baseMonthly = currencySubs
      .filter((s) => s.status === 'active')
      .reduce((acc, s) => acc + monthlyEquivalentCents(s.amountCents, s.interval), 0);
    const trialMonthly = currencySubs
      .filter((s) => s.status === 'trialing')
      .reduce((acc, s) => acc + monthlyEquivalentCents(s.amountCents, s.interval), 0);

    if (mode === 'categories') {
      const byCat = new Map<string, { cents: number; trialCents: number; count: number }>();
      for (const s of currencySubs) {
        const eq = monthlyEquivalentCents(s.amountCents, s.interval);
        const prev = byCat.get(s.category) ?? { cents: 0, trialCents: 0, count: 0 };
        byCat.set(s.category, {
          cents: prev.cents + eq,
          trialCents: prev.trialCents + (s.status === 'trialing' ? eq : 0),
          count: prev.count + 1,
        });
      }
      const entries = Array.from(byCat.entries()).sort((a, b) => b[1].cents - a[1].cents);
      return entries.map(([cat, val]) => {
        const full = categoryLabel(cat as Subscription['category']);
        return {
          key: cat,
          label: full,
          shortLabel: full.length > 8 ? `${full.slice(0, 7)}…` : full,
          primaryCents: val.cents,
          secondaryCents: val.trialCents,
          count: val.count,
        };
      });
    }

    const monthsCount = mode === '12m' ? 12 : 6;
    const now = new Date();
    const result: DataPoint[] = [];

    for (let i = 0; i < monthsCount; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });

      let dueInMonthCents = 0;
      let dueCount = 0;
      for (const sub of currencySubs) {
        const eq = monthlyEquivalentCents(sub.amountCents, sub.interval);
        if (sub.interval.unit === 'year') {
          const nextDate = sub.nextBillingDate
            ? new Date(sub.nextBillingDate + 'T00:00:00')
            : null;
          if (nextDate && nextDate.getMonth() === d.getMonth()) {
            dueInMonthCents += sub.amountCents;
            dueCount += 1;
          } else {
            dueInMonthCents += eq;
          }
        } else {
          dueInMonthCents += eq;
          dueCount += 1;
        }
      }

      result.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: monthLabel,
        shortLabel: shortMonth,
        primaryCents: dueInMonthCents || baseMonthly,
        secondaryCents: baseMonthly + trialMonthly,
        count: dueCount || currencySubs.length,
      });
    }
    return result;
  }, [activeSubs, mode, primaryCurrency]);

  const activePoint =
    selectedIndex !== null && points[selectedIndex]
      ? points[selectedIndex]
      : points[points.length - 1] ?? null;

  const width = Math.max(280, measuredWidth || (isMobile ? 320 : 620));
  const height = isMobile ? 168 : 196;
  const padLeft = 12;
  const padRight = 12;
  const padTop = 18;
  const padBottom = 14;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baselineY = padTop + plotH;

  const maxVal = React.useMemo(() => {
    const m = Math.max(
      ...points.map((p) => Math.max(p.primaryCents, p.secondaryCents)),
      100,
    );
    return m * 1.15;
  }, [points]);

  const primaryCoords = React.useMemo(
    () =>
      points.map((p, idx) => {
        const x =
          points.length === 1
            ? padLeft + plotW / 2
            : padLeft + (idx / (points.length - 1)) * plotW;
        const y = baselineY - (p.primaryCents / maxVal) * plotH;
        return { x, y };
      }),
    [points, padLeft, plotW, baselineY, maxVal, plotH],
  );

  const secondaryCoords = React.useMemo(
    () =>
      points.map((p, idx) => {
        const x =
          points.length === 1
            ? padLeft + plotW / 2
            : padLeft + (idx / (points.length - 1)) * plotW;
        const y = baselineY - (p.secondaryCents / maxVal) * plotH;
        return { x, y };
      }),
    [points, padLeft, plotW, baselineY, maxVal, plotH],
  );

  const primaryPaths = React.useMemo(
    () => buildSmoothAreaPath(primaryCoords, baselineY),
    [primaryCoords, baselineY],
  );
  const secondaryPaths = React.useMemo(
    () => buildSmoothAreaPath(secondaryCoords, baselineY),
    [secondaryCoords, baselineY],
  );

  const primaryStroke = isDark ? '#60A5FA' : '#2563EB';
  const secondaryStroke = isDark ? '#34D399' : '#10B981';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(9,9,11,0.07)';

  if (points.length === 0) return null;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Recurring Spend Trajectory</CardTitle>
        <CardDescription>
          {mode === 'categories'
            ? `Monthly spend across ${points.length} categories (${primaryCurrency})`
            : `Projected cashflow & baseline over ${mode === '12m' ? '12 months' : '6 months'}`}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={mode}
            onValueChange={(next) => {
              if (next) {
                setSelectedIndex(null);
                setMode(next as ChartMode);
              }
            }}
          >
            <ToggleGroupItem value="6m" isFirst className="px-2.5">
              <Text className="text-xs">{isMobile ? '6m' : '6 Months'}</Text>
            </ToggleGroupItem>
            <ToggleGroupItem value="12m" className="px-2.5">
              <Text className="text-xs">{isMobile ? '12m' : '12 Months'}</Text>
            </ToggleGroupItem>
            <ToggleGroupItem value="categories" isLast className="px-2.5">
              <Text className="text-xs">Categories</Text>
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>

      <CardContent
        className="gap-3"
        onLayout={(e) => {
          const w = Math.floor(e.nativeEvent.layout.width - 32);
          if (w > 180 && Math.abs(w - measuredWidth) > 8) {
            setMeasuredWidth(w);
          }
        }}
      >
        {/* Interactive Tooltip Header Bar */}
        {activePoint ? (
          <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
            <ChartTooltipContent
              label={activePoint.label}
              className="border-0 bg-transparent p-0 shadow-none"
              items={[
                {
                  name: mode === 'categories' ? 'Category spend' : 'Projected charge',
                  value: formatMoney(activePoint.primaryCents, primaryCurrency),
                  color: primaryStroke,
                  sublabel: '/mo',
                },
                ...(mode !== 'categories'
                  ? [
                      {
                        name: 'Normalized run rate',
                        value: formatMoney(activePoint.secondaryCents, primaryCurrency),
                        color: secondaryStroke,
                        sublabel: `${activePoint.count} active`,
                      },
                    ]
                  : []),
              ]}
            />
          </View>
        ) : null}

        <ChartContainer config={chartConfig} className="w-full">
          <Animated.View
            style={{
              opacity: reveal,
            }}
            className="w-full gap-1.5"
          >
            <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
              <Defs>
                <LinearGradient id="fillPrimary" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="5%" stopColor={primaryStroke} stopOpacity="0.38" />
                  <Stop offset="95%" stopColor={primaryStroke} stopOpacity="0.02" />
                </LinearGradient>
                <LinearGradient id="fillSecondary" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="5%" stopColor={secondaryStroke} stopOpacity="0.22" />
                  <Stop offset="95%" stopColor={secondaryStroke} stopOpacity="0.01" />
                </LinearGradient>
              </Defs>

              {/* Horizontal Cartesian grid lines */}
              {[0.2, 0.5, 0.8, 1].map((ratio) => {
                const y = padTop + plotH * ratio;
                return (
                  <Line
                    key={ratio}
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke={gridStroke}
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                );
              })}

              {mode !== 'categories' && secondaryPaths.areaPath ? (
                <>
                  <Path d={secondaryPaths.areaPath} fill="url(#fillSecondary)" />
                  <Path
                    d={secondaryPaths.linePath}
                    fill="none"
                    stroke={secondaryStroke}
                    strokeWidth="1.75"
                    strokeDasharray="5 4"
                  />
                </>
              ) : null}

              {primaryPaths.areaPath ? (
                <>
                  <Path d={primaryPaths.areaPath} fill="url(#fillPrimary)" />
                  <Path
                    d={primaryPaths.linePath}
                    fill="none"
                    stroke={primaryStroke}
                    strokeWidth="2.5"
                  />
                </>
              ) : null}

              {/* Data points */}
              {primaryCoords.map((pt, idx) => {
                const isSelected =
                  selectedIndex === idx ||
                  (selectedIndex === null && idx === primaryCoords.length - 1);
                return (
                  <React.Fragment key={points[idx].key}>
                    {isSelected ? (
                      <Line
                        x1={pt.x}
                        y1={padTop}
                        x2={pt.x}
                        y2={baselineY}
                        stroke={primaryStroke}
                        strokeOpacity="0.35"
                        strokeDasharray="3 3"
                        strokeWidth="1.2"
                      />
                    ) : null}
                    <Circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 5 : 3.5}
                      fill={isSelected ? primaryStroke : isDark ? '#18181B' : '#FFFFFF'}
                      stroke={primaryStroke}
                      strokeWidth={isSelected ? 2.5 : 2}
                    />
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Interactive X-axis scrubber buttons */}
            <View className="flex-row items-center justify-between px-1">
              {points.map((pt, idx) => {
                // On mobile in 12m mode, show every 2nd label so labels never crowd
                if (isMobile && points.length > 7 && idx % 2 === 1 && idx !== points.length - 1) {
                  return null;
                }
                const isSelected =
                  selectedIndex === idx || (selectedIndex === null && idx === points.length - 1);
                return (
                  <Pressable
                    key={pt.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Inspect ${pt.label}: ${formatMoney(pt.primaryCents, primaryCurrency)}`}
                    onPress={() => setSelectedIndex(idx)}
                    onHoverIn={() => setSelectedIndex(idx)}
                    className={
                      isSelected
                        ? 'rounded-md bg-accent px-1.5 py-0.5'
                        : 'rounded-md px-1 py-0.5 web:hover:bg-accent/50'
                    }
                  >
                    <Text
                      numberOfLines={1}
                      className={
                        isSelected
                          ? 'text-[11px] font-semibold text-foreground'
                          : 'text-[11px] text-muted-foreground'
                      }
                    >
                      {pt.shortLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <ChartLegendContent
            items={[
              {
                key: 'primary',
                label: mode === 'categories' ? 'Category Spend' : 'Projected Monthly Cashflow',
                color: primaryStroke,
              },
              ...(mode !== 'categories'
                ? [
                    {
                      key: 'secondary',
                      label: 'Normalized Run Rate (incl. Trials)',
                      color: secondaryStroke,
                    },
                  ]
                : []),
            ]}
          />
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
