import { CategoryIcon } from '@/components/shared/category-icon';
import { MoneyText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared/state-views';
import { SubscriptionRow } from '@/components/shared/subscription-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ItemGroup } from '@/components/ui/item';
import { Kbd } from '@/components/ui/kbd';
import { FadeInView } from '@/components/ui/motion';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { refreshSubscriptions, useDataStore } from '@/features/subscriptions/store';
import { intervalLabel, monthlyEquivalentCents } from '@/lib/billing';
import { CATEGORIES } from '@/lib/constants';
import { daysBetween, formatDisplayDate, todayISO } from '@/lib/dates';
import type { CategoryKey, Subscription, SubscriptionStatus } from '@/types';
import { useRouter } from 'expo-router';
import {
  CreditCard,
  LayoutList,
  Plus,
  Search,
  Table2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type SortKey = 'renewal' | 'priceDesc' | 'priceAsc' | 'name';
type StatusFilter = 'all' | SubscriptionStatus;
type CategoryFilter = 'all' | CategoryKey;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'renewal', label: 'Sort: Next renewal' },
  { value: 'priceDesc', label: 'Sort: Highest monthly' },
  { value: 'priceAsc', label: 'Sort: Lowest monthly' },
  { value: 'name', label: 'Sort: Name (A–Z)' },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  ...CATEGORIES.map((c) => ({ value: c.key as CategoryFilter, label: c.label })),
];

const PAGE_SIZE = 10;

function filterAndSort(
  items: Subscription[],
  opts: {
    query: string;
    status: StatusFilter;
    category: CategoryFilter;
    sort: SortKey;
  },
): Subscription[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = items.filter((sub) => {
    if (sub.archivedAt) return false;
    if (opts.status !== 'all' && sub.status !== opts.status) return false;
    if (opts.category !== 'all' && sub.category !== opts.category) return false;
    if (q) {
      const hay = `${sub.name} ${sub.provider ?? ''} ${sub.notes ?? ''} ${sub.paymentMethodLabel ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (opts.sort) {
      case 'renewal':
        return (a.nextBillingDate ?? '9999-12-31').localeCompare(
          b.nextBillingDate ?? '9999-12-31',
        );
      case 'priceDesc':
        return (
          monthlyEquivalentCents(b.amountCents, b.interval) -
          monthlyEquivalentCents(a.amountCents, a.interval)
        );
      case 'priceAsc':
        return (
          monthlyEquivalentCents(a.amountCents, a.interval) -
          monthlyEquivalentCents(b.amountCents, b.interval)
        );
      case 'name':
        return a.name.localeCompare(b.name);
    }
  });
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { subscriptions, status, error } = useDataStore();
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>('all');
  const [sort, setSort] = React.useState<SortKey>('renewal');
  const [viewMode, setViewMode] = React.useState<'list' | 'table'>('list');
  const [page, setPage] = React.useState(1);
  const today = todayISO();

  const liveSubs = React.useMemo(
    () => subscriptions.filter((s) => !s.archivedAt),
    [subscriptions],
  );

  const visible = React.useMemo(
    () =>
      filterAndSort(liveSubs, {
        query,
        status: statusFilter,
        category: categoryFilter,
        sort,
      }),
    [liveSubs, query, statusFilter, categoryFilter, sort],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = React.useMemo(
    () => visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visible, safePage],
  );

  const counts = React.useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: liveSubs.length,
      active: 0,
      trialing: 0,
      paused: 0,
      canceled: 0,
    };
    for (const sub of liveSubs) {
      map[sub.status] += 1;
    }
    return map;
  }, [liveSubs]);

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen>
        <LoadingSkeleton cards={5} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ErrorState
          message={error ?? 'Unable to load subscriptions.'}
          onRetry={() => void refreshSubscriptions()}
        />
      </Screen>
    );
  }

  const hasFilters =
    query.trim().length > 0 || statusFilter !== 'all' || categoryFilter !== 'all';

  return (
    <Screen className="gap-5">
      {/* Header */}
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-semibold tracking-tight text-foreground">
              Subscriptions
            </Text>
            <Badge variant="secondary">
              <Text>{liveSubs.length}</Text>
            </Badge>
          </View>
          <Text className="text-sm text-muted-foreground">
            Filter, audit, and manage every recurring plan in one place.
          </Text>
        </View>
        <Button size="sm" onPress={() => router.push('/subscription/new')}>
          <Icon as={Plus} size={15} className="text-primary-foreground" />
          <Text>New subscription</Text>
        </Button>
      </FadeInView>

      {liveSubs.length === 0 ? (
        <FadeInView delay={60}>
          <EmptyState
            icon={CreditCard}
            title="No subscriptions yet"
            description="Add your recurring services to track upcoming charges, billing cycles, and cancellation links."
            actionLabel="Add subscription"
            onAction={() => router.push('/subscription/new')}
          />
        </FadeInView>
      ) : (
        <>
          {/* Filter & Search Toolbar (shadcn InputGroup + Select + ToggleGroup + Tabs) */}
          <FadeInView delay={60} className="gap-3">
            <View className="flex-col gap-2.5 md:flex-row md:items-center">
              <View className="flex-1">
                <InputGroup>
                  <InputGroupAddon align="inline-start">
                    <Icon as={Search} size={15} className="text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Filter by service, notes, or card…"
                    accessibilityLabel="Search subscriptions"
                  />
                  {query.length > 0 ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        onPress={() => setQuery('')}
                        accessibilityLabel="Clear search"
                      >
                        <Icon as={X} size={13} className="text-muted-foreground" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : (
                    <InputGroupAddon align="inline-end" className="hidden sm:flex">
                      <Kbd>⌘K</Kbd>
                    </InputGroupAddon>
                  )}
                </InputGroup>
              </View>

              <View className="flex-row flex-wrap items-center gap-2">
                <View className="min-w-[140px] flex-1 sm:flex-none">
                  <Select
                    value={
                      CATEGORY_OPTIONS.find((o) => o.value === categoryFilter) ??
                      CATEGORY_OPTIONS[0]
                    }
                    onValueChange={(opt) =>
                      opt && setCategoryFilter(opt.value as CategoryFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:min-w-[155px]">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>

                <View className="min-w-[140px] flex-1 sm:flex-none">
                  <Select
                    value={SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]}
                    onValueChange={(opt) => opt && setSort(opt.value as SortKey)}
                  >
                    <SelectTrigger size="sm" className="w-full sm:min-w-[175px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>

                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={viewMode}
                  onValueChange={(v) => {
                    if (v === 'list' || v === 'table') setViewMode(v);
                  }}
                >
                  <ToggleGroupItem value="list" accessibilityLabel="List view">
                    <Icon as={LayoutList} size={14} className="text-foreground" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="table" accessibilityLabel="Table view">
                    <Icon as={Table2} size={14} className="text-foreground" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </View>
            </View>

            {/* Status Tabs */}
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Tabs
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <TabsList>
                  <TabsTrigger value="all">
                    <Text>All ({counts.all})</Text>
                  </TabsTrigger>
                  <TabsTrigger value="active">
                    <Text>Active ({counts.active})</Text>
                  </TabsTrigger>
                  <TabsTrigger value="trialing">
                    <Text>Trials ({counts.trialing})</Text>
                  </TabsTrigger>
                  <TabsTrigger value="paused">
                    <Text>Paused ({counts.paused})</Text>
                  </TabsTrigger>
                  <TabsTrigger value="canceled">
                    <Text>Canceled ({counts.canceled})</Text>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {hasFilters ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onPress={() => {
                    setQuery('');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                  }}
                >
                  <Text>Reset filters</Text>
                  <Icon as={X} size={12} className="text-muted-foreground" />
                </Button>
              ) : null}
            </View>
          </FadeInView>

          {visible.length === 0 ? (
            <FadeInView delay={120}>
              <EmptyState
                icon={Search}
                title="No matching subscriptions"
                description="Try clearing your search query or switching status and category filters."
                actionLabel="Reset filters"
                onAction={() => {
                  setQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
              />
            </FadeInView>
          ) : viewMode === 'list' ? (
            <FadeInView delay={120}>
              <ItemGroup className="gap-2">
                {pagedItems.map((sub) => (
                  <SubscriptionRow key={sub.id} subscription={sub} />
                ))}
              </ItemGroup>
            </FadeInView>
          ) : (
            <FadeInView delay={120}>
              <Card className="overflow-hidden py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="flex-[1.7]">
                        <Text>Service</Text>
                      </TableHead>
                      <TableHead className="hidden sm:flex">
                        <Text>Status</Text>
                      </TableHead>
                      <TableHead className="hidden md:flex">
                        <Text>Cycle</Text>
                      </TableHead>
                      <TableHead>
                        <Text>Next Renewal</Text>
                      </TableHead>
                      <TableHead className="items-end">
                        <Text>Price</Text>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedItems.map((sub) => {
                      const d = sub.nextBillingDate
                        ? daysBetween(today, sub.nextBillingDate)
                        : null;
                      return (
                        <Pressable
                          key={sub.id}
                          onPress={() => router.push(`/subscription/${sub.id}`)}
                        >
                          <TableRow>
                            <TableCell className="flex-[1.7] flex-row items-center gap-2.5">
                              <CategoryIcon category={sub.category} size={30} />
                              <View className="flex-1">
                                <Text
                                  numberOfLines={1}
                                  className="text-sm font-medium text-foreground"
                                >
                                  {sub.name}
                                </Text>
                                {sub.paymentMethodLabel ? (
                                  <Text
                                    numberOfLines={1}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {sub.paymentMethodLabel}
                                  </Text>
                                ) : null}
                              </View>
                            </TableCell>
                            <TableCell className="hidden sm:flex">
                              <Badge
                                variant={
                                  sub.status === 'active'
                                    ? 'outline'
                                    : sub.status === 'trialing'
                                      ? 'warning'
                                      : 'secondary'
                                }
                              >
                                <Text>{sub.status}</Text>
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:flex">
                              <Text className="text-xs text-muted-foreground">
                                {intervalLabel(sub.interval)}
                              </Text>
                            </TableCell>
                            <TableCell>
                              <Text
                                className={
                                  d !== null && d >= 0 && d <= 3 && sub.status !== 'canceled'
                                    ? 'text-xs font-medium text-warning'
                                    : 'text-xs text-muted-foreground'
                                }
                              >
                                {sub.status === 'canceled'
                                  ? '—'
                                  : formatDisplayDate(sub.nextBillingDate)}
                              </Text>
                            </TableCell>
                            <TableCell className="items-end">
                              <MoneyText
                                amountCents={sub.amountCents}
                                currency={sub.currency}
                                className="text-sm font-semibold text-foreground"
                              />
                            </TableCell>
                          </TableRow>
                        </Pressable>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            </FadeInView>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 ? (
            <View className="flex-row items-center justify-between pt-1">
              <Text className="text-xs text-muted-foreground">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, visible.length)} of {visible.length}
              </Text>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={safePage <= 1}
                      onPress={() => setPage(Math.max(1, safePage - 1))}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      disabled={safePage >= totalPages}
                      onPress={() => setPage(Math.min(totalPages, safePage + 1))}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
