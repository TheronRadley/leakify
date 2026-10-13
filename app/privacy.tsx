import { Screen } from '@/components/shared/screen';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth/auth-context';
import { isSupabaseConfigured } from '@/services/supabase';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CloudCog,
  Database,
  FileText,
  Fingerprint,
  Lock,
  ShieldCheck,
} from 'lucide-react-native';
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
  const router = useRouter();
  const { dataMode } = useAuth();
  return (
    <Screen edges={['top', 'bottom']} className="gap-5">
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.push('/(tabs)/settings')}>
                <Text className="text-xs text-muted-foreground">Settings</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-xs font-medium">Privacy at Leakify</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          variant="ghost"
          size="sm"
          onPress={() => (router.canGoBack() ? router.back() : router.push('/(tabs)/settings'))}
          accessibilityLabel="Back"
        >
          <Icon as={ArrowLeft} size={15} className="text-foreground" />
          <Text>Back</Text>
        </Button>
      </FadeInView>

      <FadeInView delay={60} className="gap-5">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Privacy at Leakify</CardTitle>
            <CardDescription>
              {`Current mode: ${dataMode ?? 'unknown'}${dataMode === 'supabase' && isSupabaseConfigured ? ' (cloud sync on)' : ''}.`}
            </CardDescription>
            <CardAction>
              <Badge variant="outline">
                <Text>{dataMode ?? 'local'}</Text>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-2.5">
              {SECTIONS.map((section) => (
                <Item
                  key={section.title}
                  variant="outline"
                  size="sm"
                  className="rounded-lg bg-muted/20"
                >
                  <ItemMedia variant="icon">
                    <Icon as={section.icon} size={16} className="text-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="font-semibold">{section.title}</ItemTitle>
                    <ItemDescription className="text-xs leading-5">{section.body}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Architecture & Bank Connections</CardTitle>
            <CardDescription>Technical details on third-party integrations</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible defaultValue="bank">
              <AccordionItem value="bank">
                <AccordionTrigger>
                  <View className="flex-row items-center gap-2">
                    <Icon as={CloudCog} size={15} className="text-muted-foreground" />
                    <Text className="font-medium">Bank connections</Text>
                  </View>
                </AccordionTrigger>
                <AccordionContent>
                  <Text variant="small" className="text-xs leading-5 text-muted-foreground">
                    Leakify currently has no bank integration enabled. If one is added later, it
                    will require your explicit consent, clearly name the provider, and never store
                    your banking credentials on device or server.
                  </Text>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </FadeInView>
    </Screen>
  );
}
