import { Icon } from '@/components/ui/icon';
import { FadeInView } from '@/components/ui/motion';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react-native';
import * as React from 'react';
import { Animated, Easing, Platform, Pressable, type PressableProps, View, type ViewProps } from 'react-native';

type AccordionContextValue = {
  type: 'single' | 'multiple';
  value: string[];
  toggleItem: (itemValue: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue>({
  type: 'single',
  value: [],
  toggleItem: () => {},
});

const AccordionItemContext = React.createContext<{ value: string; isExpanded: boolean }>({
  value: '',
  isExpanded: false,
});

export type AccordionProps = ViewProps & {
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (val: any) => void;
};

function Accordion({
  className,
  type = 'single',
  collapsible = true,
  defaultValue,
  value: controlledValue,
  onValueChange,
  ...props
}: AccordionProps) {
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(() => {
    if (!defaultValue) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });

  const activeItems = React.useMemo(() => {
    if (controlledValue !== undefined) {
      return Array.isArray(controlledValue) ? controlledValue : [controlledValue];
    }
    return uncontrolled;
  }, [controlledValue, uncontrolled]);

  const toggleItem = React.useCallback(
    (itemValue: string) => {
      let next: string[];
      if (type === 'multiple') {
        next = activeItems.includes(itemValue)
          ? activeItems.filter((v) => v !== itemValue)
          : [...activeItems, itemValue];
      } else {
        if (activeItems.includes(itemValue)) {
          next = collapsible ? [] : activeItems;
        } else {
          next = [itemValue];
        }
      }
      if (controlledValue === undefined) {
        setUncontrolled(next);
      }
      onValueChange?.(type === 'multiple' ? next : (next[0] ?? ''));
    },
    [activeItems, collapsible, controlledValue, onValueChange, type],
  );

  return (
    <AccordionContext.Provider value={{ type, value: activeItems, toggleItem }}>
      <View
        data-slot="accordion"
        dataSet={{ slot: 'accordion' }}
        className={cn('w-full', className)}
        {...props}
      />
    </AccordionContext.Provider>
  );
}

function AccordionItem({ className, value, ...props }: ViewProps & { value: string }) {
  const { value: activeItems } = React.useContext(AccordionContext);
  const isExpanded = activeItems.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isExpanded }}>
      <View
        data-slot="accordion-item"
        data-state={isExpanded ? 'open' : 'closed'}
        dataSet={{ slot: 'accordion-item', state: isExpanded ? 'open' : 'closed' }}
        className={cn('border-b border-border last:border-b-0', className)}
        {...props}
      />
    </AccordionItemContext.Provider>
  );
}

function AccordionTrigger({
  className,
  children,
  onPress,
  ...props
}: PressableProps & { children?: React.ReactNode }) {
  const { toggleItem } = React.useContext(AccordionContext);
  const { value, isExpanded } = React.useContext(AccordionItemContext);
  const [rotateAnim] = React.useState(() => new Animated.Value(isExpanded ? 1 : 0));

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isExpanded, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TextClassContext.Provider value="text-left text-sm font-medium text-foreground">
      <View className="flex">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          data-slot="accordion-trigger"
          data-state={isExpanded ? 'open' : 'closed'}
          dataSet={{ slot: 'accordion-trigger', state: isExpanded ? 'open' : 'closed' }}
          onPress={(e) => {
            onPress?.(e);
            toggleItem(value);
          }}
          className={cn(
            'flex flex-1 flex-row items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium web:transition-all web:outline-none web:hover:underline web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50',
            props.disabled && 'opacity-50 web:pointer-events-none',
            className,
          )}
          {...props}
        >
          {children}
          <Animated.View style={{ transform: [{ rotate }] }} className="pt-0.5">
            <Icon as={ChevronDown} size={16} className="shrink-0 text-muted-foreground" />
          </Animated.View>
        </Pressable>
      </View>
    </TextClassContext.Provider>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: ViewProps & { children?: React.ReactNode }) {
  const { isExpanded } = React.useContext(AccordionItemContext);
  if (!isExpanded) return null;

  return (
    <TextClassContext.Provider value="text-sm text-foreground">
      <FadeInView
        duration={220}
        offsetY={6}
        data-slot="accordion-content"
        data-state="open"
        dataSet={{ slot: 'accordion-content', state: 'open' }}
        className="overflow-hidden text-sm"
        {...props}
      >
        <View className={cn('pb-4 pt-0', className)}>{children}</View>
      </FadeInView>
    </TextClassContext.Provider>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
