import { LeakifyMark } from '@/components/branding/logo';
import { CurrencyTotalsText } from '@/components/shared/money';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Icon, iconWithClassName } from '@/components/ui/icon';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { detectLeaks } from '@/features/subscriptions/leaks-ui';
import { useDataStore } from '@/features/subscriptions/store';
import {
  contributesToRecurringSpend,
  monthlyRecurringByCurrency,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import { todayISO } from '@/lib/dates';
import { useAppTheme, useSemanticColors } from '@/lib/theme';
import { Tabs, usePathname, useRouter } from 'expo-router';
import {
  Bell,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Moon,
  PiggyBank,
  Plus,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

iconWithClassName(LayoutDashboard);
iconWithClassName(ListChecks);
iconWithClassName(TrendingUp);
iconWithClassName(CalendarDays);
iconWithClassName(Settings);

interface NavItem {
  name: string;
  href: string;
  label: string;
  icon: LucideIcon;
  accessibilityLabel: string;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    name: 'index',
    href: '/(tabs)',
    label: 'Home',
    icon: LayoutDashboard,
    accessibilityLabel: 'Home overview',
  },
  {
    name: 'subscriptions',
    href: '/(tabs)/subscriptions',
    label: 'Subscriptions',
    icon: ListChecks,
    accessibilityLabel: 'All subscriptions',
  },
  {
    name: 'insights',
    href: '/(tabs)/insights',
    label: 'Insights',
    icon: TrendingUp,
    accessibilityLabel: 'Spending insights',
  },
  {
    name: 'calendar',
    href: '/(tabs)/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    accessibilityLabel: 'Billing calendar',
  },
  {
    name: 'settings',
    href: '/(tabs)/settings',
    label: 'Settings',
    icon: Settings,
    accessibilityLabel: 'Settings and privacy',
  },
];

const SECONDARY_NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: 'leaks';
}[] = [
  { href: '/savings', label: 'Potential Savings', icon: PiggyBank, badgeKey: 'leaks' },
  { href: '/reminders', label: 'Upcoming Reminders', icon: Bell },
  { href: '/privacy', label: 'Privacy at Leakify', icon: ShieldCheck },
];

function isRouteActive(pathname: string, itemName: string): boolean {
  if (itemName === 'index') {
    return pathname === '/' || pathname === '/index' || pathname === '/(tabs)';
  }
  return pathname.startsWith(`/${itemName}`) || pathname.startsWith(`/(tabs)/${itemName}`);
}

function getActivePageTitle(pathname: string): string {
  const match = MAIN_NAV_ITEMS.find((item) => isRouteActive(pathname, item.name));
  return match?.label ?? 'Home';
}

function AppSidebar({
  activeCount,
  leakCount,
}: {
  activeCount: number;
  leakCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const { user } = useAuth();
  const { profile, subscriptions, isDemo } = useDataStore();
  const { colorScheme, setPreference } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const monthlyTotals = React.useMemo(
    () => monthlyRecurringByCurrency(subscriptions),
    [subscriptions],
  );

  const navigate = (href: string) => {
    if (isMobile) setOpenMobile(false);
    router.push(href as never);
  };

  const userInitial = (profile?.displayName ?? user?.email ?? 'LK').slice(0, 2).toUpperCase();

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onPress={() => navigate('/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="Leakify Home"
              className="px-2"
            >
              <LeakifyMark size={28} />
              <View className="flex-1">
                <Text className="text-sm font-semibold leading-none tracking-tight text-sidebar-foreground">
                  Leakify
                </Text>
                <Text className="mt-1 text-[11px] leading-none text-sidebar-foreground/60">
                  Subscription Intelligence
                </Text>
              </View>
              {isDemo ? (
                <Badge variant="secondary" className="px-1.5 py-0">
                  <Icon as={FlaskConical} size={10} className="text-secondary-foreground" />
                  <Text className="text-[10px]">Demo</Text>
                </Badge>
              ) : (
                <Badge variant="outline" className="px-1.5 py-0">
                  <Text className="text-[10px]">v1.0</Text>
                </Badge>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="py-1">
          <SidebarGroupContent className="flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem className="flex-row items-center gap-1.5 px-1">
                <Button
                  size="sm"
                  onPress={() => navigate('/subscription/new')}
                  accessibilityLabel="Add subscription"
                  className="h-8 flex-1 justify-start gap-2 bg-primary text-primary-foreground shadow-none"
                >
                  <Icon as={PlusCircle} size={15} className="text-primary-foreground" />
                  <Text className="text-xs font-semibold text-primary-foreground">
                    Quick Add Subscription
                  </Text>
                </Button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV_ITEMS.map((item) => {
                const active = isRouteActive(pathname, item.name);
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      isActive={active}
                      accessibilityRole="tab"
                      accessibilityLabel={item.accessibilityLabel}
                      accessibilityState={{ selected: active }}
                      onPress={() => navigate(item.href)}
                    >
                      <Icon
                        as={item.icon}
                        size={16}
                        className={
                          active
                            ? 'text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70'
                        }
                      />
                      <Text
                        className={
                          active
                            ? 'font-medium text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/85'
                        }
                      >
                        {item.label}
                      </Text>
                    </SidebarMenuButton>
                    {item.name === 'subscriptions' && activeCount > 0 ? (
                      <SidebarMenuBadge>{activeCount}</SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Audits & Alerts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY_NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      accessibilityRole="button"
                      onPress={() => navigate(item.href)}
                    >
                      <Icon
                        as={item.icon}
                        size={16}
                        className={
                          active
                            ? 'text-sidebar-accent-foreground'
                            : 'text-sidebar-foreground/70'
                        }
                      />
                      <Text className="text-sidebar-foreground/85">{item.label}</Text>
                    </SidebarMenuButton>
                    {item.badgeKey === 'leaks' && leakCount > 0 ? (
                      <SidebarMenuBadge className="bg-warning/15 text-warning">
                        <Text className="text-[11px] font-semibold text-warning">{leakCount}</Text>
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3">
        <View className="rounded-lg border border-sidebar-border bg-background/70 p-3">
          <View className="flex-row items-center justify-between">
            <Text variant="muted" className="text-[11px] font-medium uppercase tracking-wider">
              Monthly Run Rate
            </Text>
            <Badge variant="secondary" className="px-1.5 py-0">
              <Text className="text-[10px] tabular-nums">{activeCount} active</Text>
            </Badge>
          </View>
          <View className="mt-1 flex-row items-baseline gap-1">
            <CurrencyTotalsText
              totals={monthlyTotals}
              className="text-lg font-semibold tabular-nums tracking-tight text-foreground"
            />
            <Text variant="muted" className="text-xs font-normal">
              /mo
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2">
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate('/(tabs)/settings')}
            className="min-w-0 flex-1 flex-row items-center gap-2.5"
          >
            <Avatar alt="Account avatar" className="h-7 w-7 rounded-md">
              <AvatarFallback className="rounded-md bg-sidebar-primary">
                <Text className="text-[11px] font-semibold text-sidebar-primary-foreground">
                  {userInitial}
                </Text>
              </AvatarFallback>
            </Avatar>
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-xs font-medium text-sidebar-foreground">
                {profile?.displayName ?? user?.email ?? 'Local Workspace'}
              </Text>
              <Text numberOfLines={1} className="text-[11px] text-sidebar-foreground/60">
                {user?.email ?? (isDemo ? 'Demo workspace' : 'Offline-first mode')}
              </Text>
            </View>
          </Pressable>

          <Button
            size="icon-xs"
            variant="ghost"
            accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onPress={() => setPreference(isDark ? 'light' : 'dark')}
          >
            <Icon as={isDark ? Sun : Moon} size={14} className="text-sidebar-foreground" />
          </Button>
        </View>
      </SidebarFooter>
    </Sidebar>
  );
}

function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme, setPreference } = useAppTheme();
  const { isDemo } = useDataStore();
  const isDark = colorScheme === 'dark';
  const pageTitle = getActivePageTitle(pathname);

  return (
    <View
      data-slot="site-header"
      dataSet={{ slot: 'site-header' }}
      style={{ paddingTop: insets.top }}
      className="shrink-0 border-b border-border bg-background"
    >
      <View className="flex h-12 flex-row items-center justify-between gap-2 px-4 md:px-6">
        <View className="flex-row items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1.5 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:flex">
                <BreadcrumbLink onPress={() => router.push('/(tabs)')}>
                  <Text className="text-xs text-muted-foreground">Workspace</Text>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:flex" />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm font-medium">{pageTitle}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </View>

        <View className="flex-row items-center gap-2">
          {isDemo ? (
            <Badge variant="secondary" className="hidden sm:flex">
              <Icon as={FlaskConical} size={11} className="text-secondary-foreground" />
              <Text>Demo</Text>
            </Badge>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            onPress={() => setPreference(isDark ? 'light' : 'dark')}
          >
            <Icon as={isDark ? Sun : Moon} size={15} className="text-foreground" />
          </Button>
          <Button
            size="sm"
            onPress={() => router.push('/subscription/new')}
            accessibilityLabel="Add subscription"
            className="h-8 gap-1.5 px-2.5"
          >
            <Icon as={Plus} size={14} className="text-primary-foreground" />
            <Text className="text-xs font-medium text-primary-foreground">New</Text>
            <Kbd className="ml-0.5 hidden bg-primary-foreground/15 sm:flex">
              <Text className="text-[10px] font-medium text-primary-foreground">N</Text>
            </Kbd>
          </Button>
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 768;
  const colors = useSemanticColors();
  const { subscriptions } = useDataStore();
  const today = todayISO();

  const activeCount = React.useMemo(
    () => subscriptions.filter(contributesToRecurringSpend).length,
    [subscriptions],
  );
  const upcoming7d = React.useMemo(
    () => upcomingChargesByCurrency(subscriptions, today, 7),
    [subscriptions, today],
  );
  const leaks = React.useMemo(
    () => detectLeaks({ subscriptions, refISO: today, upcoming7dTotals: upcoming7d }),
    [subscriptions, today, upcoming7d],
  );

  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <SidebarProvider>
      <AppSidebar activeCount={activeCount} leakCount={leaks.length} />
      <SidebarInset>
        <SiteHeader />
        <View className="flex-1">
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.foreground,
              tabBarInactiveTintColor: colors.muted,
              tabBarStyle: isDesktop
                ? { display: 'none' }
                : {
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 54 + bottomPad,
                    paddingTop: 6,
                    paddingBottom: bottomPad,
                  },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '500',
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'Home',
                tabBarAccessibilityLabel: 'Home overview',
                tabBarIcon: ({ color, size }) => (
                  <LayoutDashboard color={color} size={size - 2} />
                ),
              }}
            />
            <Tabs.Screen
              name="subscriptions"
              options={{
                title: 'Subscriptions',
                tabBarAccessibilityLabel: 'All subscriptions',
                tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size - 2} />,
              }}
            />
            <Tabs.Screen
              name="insights"
              options={{
                title: 'Insights',
                tabBarAccessibilityLabel: 'Spending insights',
                tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size - 2} />,
              }}
            />
            <Tabs.Screen
              name="calendar"
              options={{
                title: 'Calendar',
                tabBarAccessibilityLabel: 'Billing calendar',
                tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size - 2} />,
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                tabBarAccessibilityLabel: 'Settings and privacy',
                tabBarIcon: ({ color, size }) => <Settings color={color} size={size - 2} />,
              }}
            />
          </Tabs>
        </View>
      </SidebarInset>
    </SidebarProvider>
  );
}
