import { Screen } from '@/components/shared/screen';
import { SubscriptionForm } from '@/features/subscriptions/components/subscription-form';
import { addSubscription } from '@/features/subscriptions/store';
import { useRouter } from 'expo-router';
import * as React from 'react';

export default function NewSubscriptionScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <SubscriptionForm
        submitLabel="Add subscription"
        onSubmit={async (input) => {
          await addSubscription(input);
          router.back();
        }}
      />
    </Screen>
  );
}
