import { CurrencyTotalsText } from '@/components/shared/money';
import { Screen } from '@/components/shared/screen';
import { EmptyState, LoadingSkeleton } from '@/components/shared/state-views';
import { SubscriptionRow } from '@/components/shared/subscription-row';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ItemGroup } from '@/components/ui/item';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { detectLeaks, LeakFindingUI } from '@/features/subscriptions/leaks-ui';
import { useDataStore } from '@/features/subscriptions/store';
import {
  potentialSavingsByCurrency,
  upcomingChargesByCurrency,
} from '@/lib/billing';
import { todayISO } from '@/lib/dates';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  PiggyBank,
  Sparkles,
  TrendingDown,
} from 'lucide-react-native';
import * as React from 'react';

export default function SavingsScreen() {
  const router = useRouter();
  const { subscriptions, status } = useDataStore();
  const today = todayISO();

  const liveSubs = React.useMemo(
    () => subscriptions.filter((s) => !s.archivedAt),
    [subscriptions],
  );
  const cancelCandidates = React.useMemo(
    () => liveSubs.filter((s) => s.isCancelCandidate && s.status !== 'canceled'),
    [liveSubs],
  );
  const potentialSavings = React.useMemo(
    () => potentialSavingsByCurrency(liveSubs),
    [liveSubs],
  );
  const leaks = React.useMemo(
    () =>
      detectLeaks({
        subscriptions: liveSubs,
        refISO: today,
        upcoming7dTotals: upcomingChargesByCurrency(liveSubs, today, 7),
      }),
    [liveSubs, today],
  );

  if (status === 'loading' || status === 'idle') {
    return (
      <Screen>
        <LoadingSkeleton cards={3} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} className="gap-6">
      <FadeInView delay={0} className="flex-row flex-wrap items-center justify-between gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink onPress={() => router.back()}>
                <Text className="text-sm text-muted-foreground">Overview</Text>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Savings Audit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Icon as={ArrowLeft} size={15} className="text-foreground" />
          <Text>Back</Text>
        </Button>
      </FadeInView>

      <FadeInView delay={40} className="gap-1">
        <Text className="text-2xl font-semibold tracking-tight text-foreground">
          Savings Opportunities
        </Text>
        <Text className="text-sm text-muted-foreground">
          Automated audit of duplicate categories, cancellation candidates, and expiring trials.
        </Text>
      </FadeInView>

      {/* Summary Banner Card */}
      <FadeInView delay={80}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardDescription className="text-xs font-medium">
              Estimated Monthly Savings
            </CardDescription>
            <CurrencyTotalsText
              totals={potentialSavings}
              placeholder="$0.00"
              className="text-3xl font-semibold tracking-tight text-success"
            />
            <CardAction className="right-5">
              <Badge variant="success" className="gap-1">
                <Icon as={TrendingDown} size={12} className="text-success" />
                <Text>{leaks.length} signals</Text>
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="border-t border-border px-5 pt-4">
            <Text className="text-xs text-muted-foreground">
              Derived from subscriptions marked as cancellation candidates and detected leak signals.
            </Text>
          </CardFooter>
        </Card>
      </FadeInView>

      {cancelCandidates.length > 0 ? (
        <FadeInView delay={110}>
          <Card className="py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-base">Cancellation Candidates</CardTitle>
              <CardDescription>
                Subscriptions you marked for cancellation review.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ItemGroup className="gap-2">
                {cancelCandidates.map((sub) => (
                  <SubscriptionRow key={sub.id} subscription={sub} />
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </FadeInView>
      ) : null}

      {leaks.length === 0 && cancelCandidates.length === 0 ? (
        <FadeInView delay={120}>
          <EmptyState
            icon={PiggyBank}
            title="No obvious leaks detected"
            description="Your active subscriptions don't show duplicate category overlaps or cancellation candidates right now."
            actionLabel="View subscriptions"
            onAction={() => router.push('/(tabs)/subscriptions')}
          />
        </FadeInView>
      ) : leaks.length > 0 ? (
        <FadeInView delay={140}>
          <Card className="py-5">
            <CardHeader className="px-5">
              <CardTitle className="text-base">Detected Leak Signals</CardTitle>
              <CardDescription>
                Overlapping services, price increases, and trials expiring soon.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5">
              <ItemGroup className="gap-2.5">
                {leaks.map((finding) => (
                  <LeakFindingUI key={finding.id} finding={finding} />
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </FadeInView>
      ) : null}

      {/* Savings Playbook Accordion */}
      <FadeInView delay={180}>
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Leak Reduction Playbook</CardTitle>
            <CardDescription>
              How Leakify calculates and prioritizes your recurring savings.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <Accordion type="single" collapsible defaultValue="annual">
              <AccordionItem value="annual">
                <AccordionTrigger>
                  <Text>Switch high-retention monthly tools to annual billing</Text>
                </AccordionTrigger>
                <AccordionContent>
                  <Text className="text-xs leading-5 text-muted-foreground">
                    Most SaaS and productivity services offer 2 months free (~16–20% discount) when
                    billed yearly. Only switch tools you have used consistently for at least 3
                    months.
                  </Text>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="rotate">
                <AccordionTrigger>
                  <Text>Rotate overlapping entertainment & streaming plans</Text>
                </AccordionTrigger>
                <AccordionContent>
                  <Text className="text-xs leading-5 text-muted-foreground">
                    Instead of paying for 3–4 video or music services simultaneously, keep one primary
                    service active and rotate the others monthly as new seasons drop.
                  </Text>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="trials">
                <AccordionTrigger>
                  <Text>Cancel free trials 48 hours before conversion</Text>
                </AccordionTrigger>
                <AccordionContent>
                  <Text className="text-xs leading-5 text-muted-foreground">
                    Enable Leakify renewal reminders at least 3 days before a trial ends so you never
                    get locked into an unwanted annual or monthly renewal.
                  </Text>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </FadeInView>

      <FadeInView delay={220}>
        <Alert>
          <Icon as={Sparkles} size={16} className="text-foreground" />
          <AlertTitle>Pro tip: Save direct cancellation links</AlertTitle>
          <AlertDescription>
            Store each provider&apos;s billing portal URL on the subscription detail screen so you can
            cancel or downgrade in two taps.
          </AlertDescription>
        </Alert>
      </FadeInView>
    </Screen>
  );
}
