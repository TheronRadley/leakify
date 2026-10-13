import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Text, TextClassContext } from '@/components/ui/text';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { PanelLeftIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';

const SIDEBAR_WIDTH = 256;
const SIDEBAR_WIDTH_ICON = 48;

type SidebarContextProps = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean | ((value: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  children,
  ...props
}: ViewProps & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }
    },
    [setOpenProp, open],
  );

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((prev) => !prev) : setOpen((prev) => !prev);
  }, [isMobile, setOpen, setOpenMobile]);

  const state: 'expanded' | 'collapsed' = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <View
        data-slot="sidebar-wrapper"
        dataSet={{ slot: 'sidebar-wrapper' }}
        className={cn(
          'group/sidebar-wrapper flex min-h-full w-full flex-1 flex-row bg-sidebar',
          className,
        )}
        {...props}
      >
        {children}
      </View>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: ViewProps & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === 'none') {
    return (
      <View
        data-slot="sidebar"
        dataSet={{ slot: 'sidebar' }}
        style={{ width: SIDEBAR_WIDTH }}
        className={cn('flex h-full flex-col bg-sidebar text-sidebar-foreground', className)}
        {...props}
      >
        {children}
      </View>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          showCloseButton={false}
          className="w-[280px] bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <View className="flex h-full w-full flex-col">{children}</View>
        </SheetContent>
      </Sheet>
    );
  }

  const collapsed = state === 'collapsed';
  const targetWidth =
    collapsed && collapsible === 'offcanvas'
      ? 0
      : collapsed && collapsible === 'icon'
        ? SIDEBAR_WIDTH_ICON
        : SIDEBAR_WIDTH;

  return (
    <View
      data-slot="sidebar"
      data-state={state}
      data-collapsible={collapsed ? collapsible : ''}
      data-variant={variant}
      data-side={side}
      dataSet={{
        slot: 'sidebar',
        state,
        collapsible: collapsed ? collapsible : '',
        variant,
        side,
      }}
      style={{ width: targetWidth }}
      className={cn(
        'group peer hidden h-full shrink-0 overflow-hidden web:transition-[width] web:duration-200 web:ease-linear md:flex',
        variant === 'inset' ? 'bg-sidebar p-2' : 'bg-sidebar',
        variant === 'sidebar' && side === 'left' && !collapsed && 'border-r border-sidebar-border',
        variant === 'sidebar' && side === 'right' && !collapsed && 'border-l border-sidebar-border',
        className,
      )}
      {...props}
    >
      <View
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        dataSet={{ sidebar: 'sidebar', slot: 'sidebar-inner' }}
        className={cn(
          'flex h-full w-full flex-col bg-sidebar',
          variant === 'floating' && 'rounded-lg border border-sidebar-border shadow-sm',
        )}
      >
        {children}
      </View>
    </View>
  );
}

function SidebarTrigger({
  className,
  onPress,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      accessibilityLabel="Toggle Sidebar"
      className={cn('h-7 w-7', className)}
      onPress={(event) => {
        onPress?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <Icon as={PanelLeftIcon} size={16} className="text-foreground" />
    </Button>
  );
}

function SidebarRail({ className, ...props }: PressableProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <Pressable
      data-sidebar="rail"
      data-slot="sidebar-rail"
      accessibilityLabel="Toggle Sidebar"
      onPress={toggleSidebar}
      className={cn('hidden w-2 md:flex', className)}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-inset"
      dataSet={{ slot: 'sidebar-inset' }}
      className={cn(
        'relative flex w-full flex-1 flex-col overflow-hidden bg-background md:m-2 md:ml-0 md:rounded-xl md:border md:border-border/70 md:shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn('h-8 w-full bg-background shadow-none', className)}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-header"
      data-sidebar="header"
      dataSet={{ slot: 'sidebar-header', sidebar: 'header' }}
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-footer"
      data-sidebar="footer"
      dataSet={{ slot: 'sidebar-footer', sidebar: 'footer' }}
      className={cn('flex flex-col gap-2 p-2', className)}
      {...props}
    />
  );
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-sidebar-border', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-content"
      data-sidebar="content"
      dataSet={{ slot: 'sidebar-content', sidebar: 'content' }}
      className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto', className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-group"
      data-sidebar="group"
      dataSet={{ slot: 'sidebar-group', sidebar: 'group' }}
      className={cn('relative flex w-full min-w-0 flex-col p-2', className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  asChild = false,
  children,
  ...props
}: ViewProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.View : View;

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      dataSet={{ slot: 'sidebar-group-label', sidebar: 'group-label' }}
      className={cn(
        'flex h-8 shrink-0 flex-row items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className="text-xs font-medium text-sidebar-foreground/70">{children}</Text>
      ) : (
        children
      )}
    </Comp>
  );
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: PressableProps & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      dataSet={{ slot: 'sidebar-group-action', sidebar: 'group-action' }}
      className={cn(
        'absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground web:hover:bg-sidebar-accent',
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      dataSet={{ slot: 'sidebar-group-content', sidebar: 'group-content' }}
      className={cn('w-full text-sm', className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-menu"
      data-sidebar="menu"
      dataSet={{ slot: 'sidebar-menu', sidebar: 'menu' }}
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      dataSet={{ slot: 'sidebar-menu-item', sidebar: 'menu-item' }}
      className={cn('group/menu-item relative', className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  'peer/menu-button flex w-full flex-row items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm web:transition-all web:duration-150 web:outline-none web:hover:bg-sidebar-accent web:hover:text-sidebar-accent-foreground active:bg-sidebar-accent',
  {
    variants: {
      variant: {
        default: 'web:hover:bg-sidebar-accent web:hover:text-sidebar-accent-foreground',
        outline:
          'bg-background shadow-xs border border-sidebar-border web:hover:bg-sidebar-accent',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'h-12 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: PressableProps & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm',
        isActive
          ? 'font-medium text-sidebar-accent-foreground'
          : 'font-normal text-sidebar-foreground',
      )}
    >
      <Comp
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size={size ?? 'default'}
        data-active={isActive}
        dataSet={{
          slot: 'sidebar-menu-button',
          sidebar: 'menu-button',
          size: size ?? 'default',
          active: isActive,
        }}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }),
          isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-2xs',
          className,
        )}
        {...props}
      >
        {children}
      </Comp>
    </TextClassContext.Provider>
  );
}

function SidebarMenuAction({
  className,
  asChild = false,
  ...props
}: PressableProps & {
  asChild?: boolean;
  showOnHover?: boolean;
}) {
  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      dataSet={{ slot: 'sidebar-menu-action', sidebar: 'menu-action' }}
      className={cn(
        'absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground web:hover:bg-sidebar-accent',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({ className, children, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      dataSet={{ slot: 'sidebar-menu-badge', sidebar: 'menu-badge' }}
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 flex-row items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className="text-xs font-medium tabular-nums text-sidebar-foreground/80">
          {String(children)}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: ViewProps & {
  showIcon?: boolean;
}) {
  return (
    <View
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      dataSet={{ slot: 'sidebar-menu-skeleton', sidebar: 'menu-skeleton' }}
      className={cn('flex h-8 flex-row items-center gap-2 rounded-md px-2', className)}
      {...props}
    >
      {showIcon ? <Skeleton className="h-4 w-4 rounded-md" /> : null}
      <Skeleton className="h-4 flex-1" />
    </View>
  );
}

function SidebarMenuSub({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      dataSet={{ slot: 'sidebar-menu-sub', sidebar: 'menu-sub' }}
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5',
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: ViewProps) {
  return (
    <View
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      dataSet={{ slot: 'sidebar-menu-sub-item', sidebar: 'menu-sub-item' }}
      className={cn('group/menu-sub-item relative', className)}
      {...props}
    />
  );
}

function SidebarMenuSubButton({
  asChild = false,
  size = 'md',
  isActive = false,
  className,
  ...props
}: PressableProps & {
  asChild?: boolean;
  size?: 'sm' | 'md';
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      dataSet={{
        slot: 'sidebar-menu-sub-button',
        sidebar: 'menu-sub-button',
        size,
        active: isActive,
      }}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px flex-row items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground web:hover:bg-sidebar-accent web:hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  sidebarMenuButtonVariants,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
