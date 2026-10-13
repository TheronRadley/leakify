import { Icon } from '@/components/ui/icon';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as SelectPrimitive from '@rn-primitives/select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as React from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.TriggerProps & {
  ref?: React.Ref<SelectPrimitive.TriggerRef>;
  size?: 'sm' | 'default';
  children?: React.ReactNode;
}) {
  return (
    <TextClassContext.Provider value="text-sm text-foreground">
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        data-size={size}
        className={cn(
          'flex flex-row items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs web:whitespace-nowrap web:transition-[color,box-shadow] web:outline-none web:focus-visible:border-ring web:focus-visible:ring-[3px] web:focus-visible:ring-ring/50 dark:bg-input/30 dark:web:hover:bg-input/50',
          size === 'default' ? 'h-9 native:h-10' : 'h-8 native:h-9',
          props.disabled && 'opacity-50 web:cursor-not-allowed',
          className,
        )}
        {...props}
      >
        {children}
        <Icon as={ChevronDown} size={15} aria-hidden className="shrink-0 text-muted-foreground opacity-60" />
      </SelectPrimitive.Trigger>
    </TextClassContext.Provider>
  );
}

function SelectScrollUpButton(props: SelectPrimitive.ScrollUpButtonProps) {
  if (Platform.OS !== 'web') return null;
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      {...props}
      className="flex items-center justify-center py-1"
    >
      <Icon as={ChevronUp} size={16} className="text-foreground" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton(props: SelectPrimitive.ScrollDownButtonProps) {
  if (Platform.OS !== 'web') return null;
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      {...props}
      className="flex items-center justify-center py-1"
    >
      <Icon as={ChevronDown} size={16} className="text-foreground" />
    </SelectPrimitive.ScrollDownButton>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  portalHost,
  ...props
}: SelectPrimitive.ContentProps & {
  ref?: React.Ref<SelectPrimitive.ContentRef>;
  portalHost?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <SelectPrimitive.Overlay
        style={StyleSheet.absoluteFill}
        className={cn(Platform.OS !== 'web' && 'bg-black/25')}
      >
        <TextClassContext.Provider value="text-popover-foreground">
          <SelectPrimitive.Content
            data-slot="select-content"
            className={cn(
              'relative z-50 max-h-72 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg',
              position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
              className,
            )}
            position={position}
            {...props}
          >
            <SelectScrollUpButton />
            <SelectPrimitive.Viewport className="w-full p-1">
              <ScrollView className="max-h-64" bounces={false}>
                {children}
              </ScrollView>
            </SelectPrimitive.Viewport>
            <SelectScrollDownButton />
          </SelectPrimitive.Content>
        </TextClassContext.Provider>
      </SelectPrimitive.Overlay>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.LabelProps & { ref?: React.Ref<SelectPrimitive.LabelRef> }) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn('px-2 py-1.5 text-xs text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children: _children,
  ...props
}: SelectPrimitive.ItemProps & { ref?: React.Ref<SelectPrimitive.ItemRef> }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'web:group relative flex w-full flex-row items-center gap-2 rounded-md py-2 pl-2.5 pr-8 text-sm web:cursor-pointer web:select-none web:outline-none web:hover:bg-accent web:focus:bg-accent active:bg-accent',
        props.disabled && 'opacity-50 web:pointer-events-none',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="text-sm text-popover-foreground web:group-focus:text-accent-foreground" />
      <SelectPrimitive.ItemIndicator
        data-slot="select-item-indicator"
        className="absolute right-2 flex h-4 w-4 items-center justify-center"
      >
        <Icon as={Check} size={15} className="text-popover-foreground" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.SeparatorProps & { ref?: React.Ref<SelectPrimitive.SeparatorRef> }) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
