import { Screen } from '@/components/shared/screen';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { isSupabaseConfigured } from '@/services/supabase';
import { Stack } from 'expo-router';
import { CloudCog, Database, FileText, Fingerprint, Lock, ShieldCheck } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

const SECTIONS: { icon: Parameters<typeof Icon>[0]['as']; title: string; body: string }[] = [
  {
    icon: Database,
    title: 'What Leakify stores',
    body: 'Only what you type in: subscription names, amounts, currencies, billing dates, categories, payment-method labels (never card numbers), notes, reminder settings, and your profile preferences.',
  },
  {
    icon: Fingerprint,
    title: 'Where it lives',
    body: 'In local and demo mode, everything stays in on-device storage and never leaves your phone. In cloud mode (when configured), the same records live in a Supabase Postgres database with row-level security: each user can only read and write their own rows, enforced at the database.',
  },
  {
    icon: Lock,
    title: 'What we never do',
    body: 'We never ask for bank passwords, never store banking credentials, never sell data, and never send transaction details to external services. There is no silent financial-data analytics: the app ships with no analytics SDK at all.',
  },
  {
    icon: ShieldCheck,
    title: 'Your controls',
    body: 'Export everything as JSON, delete all data permanently, and sign out at any time from Settings. Demo data lives in a fully separate scope and can be cleared with one tap.',
  },
  {
    icon: FileText,
    title: 'Notifications',
    body: 'Renewal reminders are on-device local notifications computed from your saved dates. Nothing is shared with a push server by default.',
  },
];

export default function PrivacyScreen() {
  const { dataMode } = useAuth();
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Privacy at Leakify' }} />
      <View className="gap-1 pb-4 pt-4">
        <Text variant="h3">Privacy at Leakify</Text>
        <Text variant="muted" className="leading-5">
          {`Current mode: ${dataMode ?? 'unknown'}${dataMode === 'supabase' && isSupabaseConfigured ? ' (cloud sync on)' : ''}.`}
        </Text>
      </View>
      <View className="gap-3 pb-10">
        {SECTIONS.map((section) => (
          <Card key={section.title} className="gap-2 p-4">
            <View className="flex-row items-center gap-2.5">
              <View className="rounded-lg bg-accent p-1.5">
                <Icon as={section.icon} size={18} className="text-accent-foreground" />
              </View>
              <Text className="font-semibold">{section.title}</Text>
            </View>
            <Text variant="small" className="leading-5 text-muted-foreground">
              {section.body}
            </Text>
          </Card>
        ))}
        <Card className="gap-2 p-4">
          <View className="flex-row items-center gap-2.5">
            <View className="rounded-lg bg-accent p-1.5">
              <Icon as={CloudCog} size={18} className="text-accent-foreground" />
            </View>
            <Text className="font-semibold">Bank connections</Text>
          </View>
          <Text variant="small" className="leading-5 text-muted-foreground">
            Leakify currently has no bank integration enabled. If one is added later, it will
            require your explicit consent, clearly name the provider, and never store your
            banking credentials on device or server.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
