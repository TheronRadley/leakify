import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />');
  }
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ViewProps & {
  id?: string;
  config: ChartConfig;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <View
        data-slot="chart"
        data-chart={chartId}
        dataSet={{ slot: 'chart', chart: chartId }}
        className={cn('flex w-full justify-center text-xs', className)}
        {...props}
      >
        {children}
      </View>
    </ChartContext.Provider>
  );
}

function ChartTooltipContent({
  label,
  items,
  indicator = 'dot',
  className,
}: {
  label?: string;
  items: {
    name: string;
    value: string;
    color?: string;
    sublabel?: string;
  }[];
  indicator?: 'dot' | 'line' | 'dashed';
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <View
      data-slot="chart-tooltip"
      dataSet={{ slot: 'chart-tooltip' }}
      className={cn(
        'min-w-[140px] gap-1.5 rounded-lg border border-border/70 bg-popover px-3 py-2 shadow-md',
        className,
      )}
    >
      {label ? <Text className="text-xs font-semibold text-popover-foreground">{label}</Text> : null}
      <View className="gap-1">
        {items.map((item) => (
          <View key={item.name} className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-1.5">
              <View
                className={cn(
                  'shrink-0 rounded-[2px]',
                  indicator === 'dot' ? 'h-2.5 w-2.5 rounded-full' : 'h-3 w-1',
                )}
                style={{ backgroundColor: item.color ?? '#2563EB' }}
              />
              <Text variant="muted" className="text-xs">
                {item.name}
              </Text>
            </View>
            <View className="flex-row items-baseline gap-1">
              <Text className="font-mono text-xs font-semibold tabular-nums text-popover-foreground">
                {item.value}
              </Text>
              {item.sublabel ? (
                <Text variant="muted" className="text-[10px]">
                  {item.sublabel}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ChartLegendContent({
  items,
  className,
}: {
  items: { key: string; label: string; color: string }[];
  className?: string;
}) {
  return (
    <View
      data-slot="chart-legend"
      dataSet={{ slot: 'chart-legend' }}
      className={cn('flex-row flex-wrap items-center justify-center gap-4 pt-3', className)}
    >
      {items.map((item) => (
        <View key={item.key} className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color }} />
          <Text variant="muted" className="text-xs">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
  useChart,
};
