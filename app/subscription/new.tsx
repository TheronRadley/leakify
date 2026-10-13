import { Screen } from '@/components/shared/screen';
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
import { addSubscription } from '@/features/subscriptions/store';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as React from 'react';

export default function NewSubscriptionScreen() {
  const router = useRouter();
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
              <BreadcrumbPage className="text-xs font-medium">New Subscription</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          variant="ghost"
          size="sm"
          onPress={() => (router.canGoBack() ? router.back() : router.push('/(tabs)'))}
          accessibilityLabel="Cancel"
        >
          <Icon as={ArrowLeft} size={15} className="text-foreground" />
          <Text>Cancel</Text>
        </Button>
      </FadeInView>

      <FadeInView delay={60}>
        <SubscriptionForm
          submitLabel="Add subscription"
          onSubmit={async (input) => {
            await addSubscription(input);
            router.back();
          }}
        />
      </FadeInView>
    </Screen>
  );
}
