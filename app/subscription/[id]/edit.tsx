import { Screen } from '@/components/shared/screen';
import { ErrorState } from '@/components/shared/state-views';
import { SubscriptionForm } from '@/features/subscriptions/components/subscription-form';
import { updateSubscription, useSubscriptionById } from '@/features/subscriptions/store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const existing = useSubscriptionById(id);

  if (!existing) {
    return (
      <ErrorState
        title="Subscription not found"
        message="It may have been deleted. Go back and refresh your list."
        onRetry={() => router.back()}
        retryLabel="Go back"
      />
    );
  }

  return (
    <Screen edges={['bottom']}>
      <SubscriptionForm
        existing={existing}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await updateSubscription(existing.id, input);
          router.back();
        }}
      />
    </Screen>
  );
}
