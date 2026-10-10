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
  children,
  ...props
}: SelectPrimitive.TriggerProps & { ref?: React.Ref<SelectPrimitive.TriggerRef>; children?: React.ReactNode }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'h-11 native:h-12 flex-row items-center justify-between rounded-md border border-input bg-background px-3',
        props.disabled && 'opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <Icon as={ChevronDown} size={16} aria-hidden className="text-muted-foreground" />
    </SelectPrimitive.Trigger>
  );
}

function SelectScrollUpButton(props: SelectPrimitive.ScrollUpButtonProps) {
  if (Platform.OS !== 'web') return null;
  return (
    <SelectPrimitive.ScrollUpButton {...props} className="flex items-center justify-center py-1">
      <Icon as={ChevronUp} size={14} className="text-foreground" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton(props: SelectPrimitive.ScrollDownButtonProps) {
  if (Platform.OS !== 'web') return null;
  return (
    <SelectPrimitive.ScrollDownButton {...props} className="flex items-center justify-center py-1">
      <Icon as={ChevronDown} size={14} className="text-foreground" />
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
      <SelectPrimitive.Overlay style={Platform.OS !== 'web' ? StyleSheet.absoluteFill : undefined}>
        <TextClassContext.Provider value="text-popover-foreground">
          <SelectPrimitive.Content
            className={cn(
              'relative z-50 max-h-72 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover shadow-md',
              position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
              className,
            )}
            position={position}
            {...props}
          >
            <SelectScrollUpButton />
            <SelectPrimitive.Viewport
              className={cn(
                'p-1',
                position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
              )}
            >
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

function SelectLabel({ className, ...props }: SelectPrimitive.LabelProps & { ref?: React.Ref<SelectPrimitive.LabelRef> }) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-sm native:text-base font-semibold text-muted-foreground', className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.ItemProps & { ref?: React.Ref<SelectPrimitive.ItemRef> }) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'web:group relative flex-row items-center gap-2 rounded-sm py-2 native:py-2.5 pl-2 pr-8 web:cursor-pointer web:outline-none web:focus:bg-accent active:bg-accent',
        props.disabled && 'opacity-50 web:pointer-events-none',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="text-sm native:text-base text-popover-foreground native:text-base web:group-focus:text-accent-foreground" />
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
        <Icon as={Check} size={16} className="text-popover-foreground" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.SeparatorProps & { ref?: React.Ref<SelectPrimitive.SeparatorRef> }) {
  return <SelectPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />;
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
