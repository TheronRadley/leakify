import { Screen } from '@/components/shared/screen';
import { ErrorState } from '@/components/shared/state-views';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { SubscriptionForm } from '@/features/subscriptions/components/subscription-form';
import { updateSubscription, useSubscriptionById } from '@/features/subscriptions/store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as React from 'react';

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const existing = useSubscriptionById(id);

  if (!existing) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState
          title="Subscription not found"
          message="It may have been deleted. Go back and refresh your list."
          onRetry={() => router.back()}
          retryLabel="Go back"
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} className="gap-5">
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.push('/(tabs)/subscriptions')}>
                <Text className="text-xs text-muted-foreground">Subscriptions</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.push(`/subscription/${existing.id}`)}>
                <Text className="text-xs text-muted-foreground">{existing.name}</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-medium">Edit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Cancel"
        >
          <Icon as={ArrowLeft} size={15} className="text-foreground" />
          <Text>Cancel</Text>
        </Button>
      </FadeInView>

      <FadeInView delay={60}>
        <SubscriptionForm
          existing={existing}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await updateSubscription(existing.id, input);
            router.back();
          }}
        />
      </FadeInView>
    </Screen>
  );
}
