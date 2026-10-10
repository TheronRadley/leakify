import { Screen } from '@/components/shared/screen';
import { EmptyState, LoadingSkeleton } from '@/components/shared/state-views';
import { SubscriptionRow } from '@/components/shared/subscription-row';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CATEGORIES, categoryLabel } from '@/lib/constants';
import { monthlyEquivalentCents } from '@/lib/billing';
import { useSubscriptions } from '@/features/subscriptions/store';
import type { CategoryKey, Subscription } from '@/types';
import { useRouter } from 'expo-router';
import { Plus, Search, SearchX, SlidersHorizontal } from 'lucide-react-native';
import * as React from 'react';
import { FlatList, Pressable, View } from 'react-native';

type SortKey = 'next_billing' | 'price' | 'recent' | 'alpha';
type StatusFilter = 'all' | 'active' | 'trialing' | 'paused' | 'canceled';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'next_billing', label: 'Next billing date' },
  { value: 'price', label: 'Price (high to low)' },
  { value: 'recent', label: 'Recently added' },
  { value: 'alpha', label: 'Alphabetical' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trial' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
];

function sortSubscriptions(subs: Subscription[], key: SortKey): Subscription[] {
  const sorted = [...subs];
  switch (key) {
    case 'next_billing':
      return sorted.sort((a, b) => (a.nextBillingDate ?? '9999').localeCompare(b.nextBillingDate ?? '9999'));
    case 'price':
      return sorted.sort(
        (a, b) =>
          monthlyEquivalentCents(b.amountCents, b.interval) - monthlyEquivalentCents(a.amountCents, a.interval),
      );
    case 'recent':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'alpha':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { subscriptions, status } = useSubscriptions();
  const [query, setQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<SortKey>('next_billing');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CategoryKey | 'all'>('all');

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = subscriptions.filter((s) => {
      if (s.archivedAt) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (q && !`${s.name} ${s.provider ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return sortSubscriptions(filtered, sortKey);
  }, [subscriptions, query, sortKey, statusFilter, categoryFilter]);

  if (status === 'loading' || status === 'idle') return <LoadingSkeleton />;

  return (
    <Screen scroll={false} padded={false} edges={['top']}>
      <View className="gap-3 px-4 pb-2 pt-4">
        <View className="flex-row items-center justify-between">
          <Text variant="h3">Subscriptions</Text>
          <Button size="sm" onPress={() => router.push('/subscription/new')} accessibilityLabel="Add subscription">
            <Icon as={Plus} size={16} className="text-primary-foreground" />
            <Text>Add</Text>
          </Button>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 rounded-md border border-input bg-background px-3">
          <Icon as={Search} size={18} className="text-muted-foreground" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search name or provider"
            clearButtonMode="while-editing"
            className="h-11 flex-1 border-0 native:h-12"
            accessibilityLabel="Search subscriptions"
          />
        </View>

        {/* Sort + status selectors */}
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Select
              value={SORT_OPTIONS.find((o) => o.value === sortKey)!}
              onValueChange={(option) => option && setSortKey(option.value as SortKey)}
            >
              <SelectTrigger accessibilityLabel="Sort subscriptions">
                <View className="flex-row items-center gap-2">
                  <Icon as={SlidersHorizontal} size={14} className="text-muted-foreground" />
                  <SelectValue placeholder="Sort by" />
                </View>
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} label={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </View>
          <View className="flex-1">
            <Select
              value={STATUS_OPTIONS.find((o) => o.value === statusFilter)!}
              onValueChange={(option) => option && setStatusFilter(option.value as StatusFilter)}
            >
              <SelectTrigger accessibilityLabel="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} label={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </View>
        </View>

        {/* Category chips (horizontal) */}
        <FlatList<CategoryKey | 'all'>
          horizontal
          data={['all', ...CATEGORIES.map((c) => c.key)]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 py-1"
          renderItem={({ item }) => {
            const selected = categoryFilter === item;
            return (
              <Pressable
                onPress={() => setCategoryFilter(item)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter category ${item === 'all' ? 'All' : categoryLabel(item as CategoryKey)}`}
                className={
                  selected
                    ? 'rounded-full bg-primary px-3.5 py-1.5'
                    : 'rounded-full border border-border bg-card px-3.5 py-1.5'
                }
              >
                <Text
                  variant="small"
                  className={selected ? 'font-semibold text-primary-foreground' : 'text-muted-foreground'}
                >
                  {item === 'all' ? 'All' : categoryLabel(item as CategoryKey)}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 px-4 pb-24 pt-1"
        renderItem={({ item }) => <SubscriptionRow subscription={item} showNextCharge />}
        ListEmptyComponent={
          subscriptions.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No subscriptions yet"
              description="Add the services you pay for and Leakify will watch their renewals."
              actionLabel="Add subscription"
              onAction={() => router.push('/subscription/new')}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="Nothing matches this search and filter combination. Try widening your filters."
              actionLabel="Clear filters"
              onAction={() => {
                setQuery('');
                setStatusFilter('all');
                setCategoryFilter('all');
              }}
            />
          )
        }
      />
    </Screen>
  );
}
