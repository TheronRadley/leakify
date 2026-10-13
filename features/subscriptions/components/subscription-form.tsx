import { DatePickerField } from '@/components/shared/date-picker-field';
import { FormField } from '@/components/shared/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { updateSubscription, useDataStore } from '@/features/subscriptions/store';
import { INTERVAL_PRESETS, intervalToPresetKey } from '@/lib/billing';
import { CATEGORIES, SUPPORTED_CURRENCIES } from '@/lib/constants';
import { decimalToMinorUnits, minorUnitsToDecimal } from '@/lib/currency';
import {
  subscriptionFormSchema,
  type SubscriptionFormInputValues,
  type SubscriptionFormValues,
} from '@/lib/validation';
import type { SubscriptionInput } from '@/services/repository';
import type { Subscription } from '@/types';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react-native';
import * as React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Free trial' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
] as const;

const UNIT_OPTIONS = [
  { value: 'day', label: 'day(s)' },
  { value: 'week', label: 'week(s)' },
  { value: 'month', label: 'month(s)' },
  { value: 'year', label: 'year(s)' },
] as const;

export interface SubscriptionFormProps {
  existing?: Subscription | null;
  onSubmit: (input: SubscriptionInput) => Promise<void>;
  submitLabel: string;
}

export function SubscriptionForm({ existing, onSubmit, submitLabel }: SubscriptionFormProps) {
  const { notificationSettings, profile } = useDataStore();

  const defaults: SubscriptionFormInputValues = React.useMemo(() => {
    if (existing) {
      return {
        name: existing.name,
        provider: existing.provider ?? '',
        amount: minorUnitsToDecimal(existing.amountCents, existing.currency),
        currency: existing.currency,
        intervalEvery: existing.interval.every,
        intervalUnit: existing.interval.unit,
        startDate: existing.startDate ?? '',
        nextBillingDate: existing.nextBillingDate ?? '',
        trialEndDate: existing.trialEndDate ?? '',
        category: existing.category,
        status: existing.status,
        paymentMethodLabel: existing.paymentMethodLabel ?? '',
        cancellationUrl: existing.cancellationUrl ?? '',
        notes: existing.notes ?? '',
      };
    }
    return {
      name: '',
      provider: '',
      amount: '',
      currency: profile?.preferredCurrency ?? 'USD',
      intervalEvery: 1,
      intervalUnit: 'month' as const,
      startDate: '',
      nextBillingDate: '',
      trialEndDate: '',
      category: 'streaming' as const,
      status: 'active' as const,
      paymentMethodLabel: '',
      cancellationUrl: '',
      notes: '',
    };
  }, [existing, profile]);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormInputValues, unknown, SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: defaults,
  });

  const intervalEvery = useWatch({ control, name: 'intervalEvery' });
  const intervalUnit = useWatch({ control, name: 'intervalUnit' });
  const statusValue = useWatch({ control, name: 'status' });
  const currencyValue = useWatch({ control, name: 'currency' });

  const presetKey = intervalToPresetKey({ every: intervalEvery, unit: intervalUnit });

  const [remindersEnabled, setRemindersEnabled] = React.useState(
    existing?.reminders.enabled ?? true,
  );
  const [serverError, setServerError] = React.useState<string | null>(null);

  const applyPreset = (key: string) => {
    const preset = INTERVAL_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    if (preset.key === 'custom') {
      setValue('intervalEvery', 2);
      setValue('intervalUnit', 'month');
      return;
    }
    setValue('intervalEvery', preset.every);
    setValue('intervalUnit', preset.unit);
  };

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const amountCents = decimalToMinorUnits(values.amount, values.currency);
    if (amountCents === null || amountCents <= 0) {
      setServerError('Enter a valid amount for the selected currency.');
      return;
    }
    const input: SubscriptionInput = {
      name: values.name.trim(),
      provider: values.provider.trim() || null,
      category: values.category,
      amountCents,
      currency: values.currency,
      interval: { every: values.intervalEvery, unit: values.intervalUnit },
      startDate: values.startDate,
      nextBillingDate: values.nextBillingDate,
      trialEndDate: values.trialEndDate,
      status: values.status,
      paymentMethodLabel: values.paymentMethodLabel.trim() || null,
      cancellationUrl: values.cancellationUrl.trim() || null,
      cancellationNotes: existing?.cancellationNotes ?? null,
      notes: values.notes.trim() || null,
      reminders: existing?.reminders ?? {
        enabled: remindersEnabled,
        renewalLeadDays: notificationSettings.renewalLeadDays,
        trialLeadDays: notificationSettings.trialLeadDays,
      },
      flaggedUnused: existing?.flaggedUnused ?? false,
      isCancelCandidate: existing?.isCancelCandidate ?? false,
    };
    if (existing) {
      input.reminders = { ...existing.reminders, enabled: remindersEnabled };
    }
    try {
      await onSubmit(input);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    }
  });

  return (
    <FieldSet className="gap-5 pb-10">
      <Card className="gap-5 py-5">
        <CardHeader className="pb-0">
          <CardTitle>Service & Billing</CardTitle>
          <CardDescription>
            Core details used to calculate your monthly and annual recurring spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField label="Subscription name" error={errors.name?.message}>
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Netflix"
                    autoFocus={!existing}
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="provider"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField label="Provider / brand" optional error={errors.provider?.message}>
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. Netflix Inc."
                  />
                </FormField>
              )}
            />

            <View className="flex-row gap-3">
              <Controller
                control={control}
                name="amount"
                render={({ field: { value, onChange, onBlur } }) => (
                  <FormField label="Amount" error={errors.amount?.message} className="flex-1">
                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <InputGroupText>{currencyValue || 'USD'}</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="15.49"
                        keyboardType="decimal-pad"
                      />
                    </InputGroup>
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="currency"
                render={({ field: { value, onChange } }) => (
                  <FormField label="Currency" error={errors.currency?.message} className="w-32">
                    <Select
                      value={{ value, label: value }}
                      onValueChange={(option) => option && onChange(option.value)}
                    >
                      <SelectTrigger accessibilityLabel="Currency">
                        <SelectValue placeholder="USD" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code} label={`${c.code}`}>
                            {c.code} — {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />
            </View>

            {/* Billing frequency */}
            <FormField
              label="Billing frequency"
              hint={presetKey === 'custom' ? 'Define your own interval below.' : undefined}
            >
              <View className="gap-3">
                <Select
                  value={{
                    value: presetKey,
                    label: INTERVAL_PRESETS.find((p) => p.key === presetKey)!.label,
                  }}
                  onValueChange={(option) => option && applyPreset(option.value)}
                >
                  <SelectTrigger accessibilityLabel="Billing frequency">
                    <SelectValue placeholder="How often" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_PRESETS.map((p) => (
                      <SelectItem key={p.key} value={p.key} label={p.label}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {presetKey === 'custom' ? (
                  <View className="flex-row items-center gap-3">
                    <Text variant="small" className="text-muted-foreground">
                      Every
                    </Text>
                    <Controller
                      control={control}
                      name="intervalEvery"
                      render={({ field: { value, onChange } }) => (
                        <Input
                          value={String(value ?? '')}
                          onChangeText={(text) =>
                            onChange(parseInt(text.replace(/[^0-9]/g, ''), 10) || 0)
                          }
                          keyboardType="number-pad"
                          className="w-20 text-center"
                          accessibilityLabel="Repeat every N"
                        />
                      )}
                    />
                    <Controller
                      control={control}
                      name="intervalUnit"
                      render={({ field: { value, onChange } }) => (
                        <View className="flex-1">
                          <Select
                            value={{
                              value,
                              label: UNIT_OPTIONS.find((u) => u.value === value)!.label,
                            }}
                            onValueChange={(option) => option && onChange(option.value)}
                          >
                            <SelectTrigger accessibilityLabel="Interval unit">
                              <SelectValue placeholder="unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {UNIT_OPTIONS.map((u) => (
                                <SelectItem key={u.value} value={u.value} label={u.label}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </View>
                      )}
                    />
                  </View>
                ) : null}
                {errors.intervalEvery?.message ? (
                  <FieldError errors={[{ message: errors.intervalEvery.message }]} />
                ) : null}
              </View>
            </FormField>

            <View className="flex-col gap-4 sm:flex-row sm:gap-3">
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <FormField label="Category" error={errors.category?.message} className="sm:flex-1">
                    <Select
                      value={{
                        value,
                        label: CATEGORIES.find((c) => c.key === value)?.label ?? value,
                      }}
                      onValueChange={(option) => option && onChange(option.value)}
                    >
                      <SelectTrigger accessibilityLabel="Category">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.key} value={c.key} label={c.label}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="status"
                render={({ field: { value, onChange } }) => (
                  <FormField label="Status" error={errors.status?.message} className="sm:flex-1">
                    <Select
                      value={{
                        value,
                        label: STATUS_OPTIONS.find((s) => s.value === value)!.label,
                      }}
                      onValueChange={(option) => option && onChange(option.value)}
                    >
                      <SelectTrigger accessibilityLabel="Status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s.value} value={s.value} label={s.label}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />
            </View>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card className="gap-5 py-5">
        <CardHeader className="pb-0">
          <CardTitle>Dates & Metadata</CardTitle>
          <CardDescription>
            Billing dates, payment label, cancellation link, and notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-4">
            <Controller
              control={control}
              name="nextBillingDate"
              render={({ field: { value, onChange } }) => (
                <FormField
                  label="Next billing date"
                  optional
                  error={errors.nextBillingDate?.message}
                  hint="Needed for upcoming-charge forecasts and reminders."
                >
                  <DatePickerField value={value} onChange={onChange} testID="next-billing-date" />
                </FormField>
              )}
            />

            {statusValue === 'trialing' ? (
              <Controller
                control={control}
                name="trialEndDate"
                render={({ field: { value, onChange } }) => (
                  <FormField
                    label="Free trial ends"
                    error={errors.trialEndDate?.message}
                    hint="Leakify reminds you before the trial converts to a paid plan."
                  >
                    <DatePickerField value={value} onChange={onChange} testID="trial-end-date" />
                  </FormField>
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="startDate"
              render={({ field: { value, onChange } }) => (
                <FormField label="Start date" optional error={errors.startDate?.message}>
                  <DatePickerField value={value} onChange={onChange} />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="paymentMethodLabel"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  label="Payment method"
                  optional
                  error={errors.paymentMethodLabel?.message}
                  hint="A label like “Visa •••• 4242”. Never enter full card numbers or bank passwords."
                >
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Visa •••• 4242"
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="cancellationUrl"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField
                  label="Cancellation link"
                  optional
                  error={errors.cancellationUrl?.message}
                >
                  <Input
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="https://provider.com/cancel"
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="notes"
              render={({ field: { value, onChange, onBlur } }) => (
                <FormField label="Notes" optional error={errors.notes?.message}>
                  <Textarea
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="e.g. shared with family, billed to work card"
                  />
                </FormField>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Reminders */}
      <Card className="gap-4 py-5">
        <CardHeader className="pb-0">
          <CardTitle>Reminders</CardTitle>
          <CardDescription>
            Uses your default lead times from Settings unless customized.
          </CardDescription>
        </CardHeader>
        <CardContent className="gap-3">
          <Field
            orientation="horizontal"
            className="rounded-lg border border-border bg-muted/20 p-3.5"
          >
            <FieldContent>
              <FieldLabel>Enable reminders for this subscription</FieldLabel>
              <FieldDescription className="text-xs">
                Receive local alerts before renewal or trial expiration
              </FieldDescription>
            </FieldContent>
            <Switch
              checked={remindersEnabled}
              onCheckedChange={setRemindersEnabled}
              accessibilityLabel="Enable reminders for this subscription"
            />
          </Field>
          {existing ? (
            <ReminderLeadEditor existing={existing} remindersEnabled={remindersEnabled} />
          ) : null}
        </CardContent>
      </Card>

      {serverError ? (
        <Alert variant="destructive" icon={AlertCircle}>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <Button loading={isSubmitting} onPress={() => void submit()} accessibilityLabel={submitLabel}>
        <Text>{submitLabel}</Text>
      </Button>
    </FieldSet>
  );
}

/** Per-subscription lead-time editing for existing subscriptions. */
function ReminderLeadEditor({
  existing,
  remindersEnabled,
}: {
  existing: Subscription;
  remindersEnabled: boolean;
}) {
  const [draft, setDraft] = React.useState(existing.reminders);
  const [saved, setSaved] = React.useState(false);

  const [prevReminders, setPrevReminders] = React.useState(existing.reminders);
  if (prevReminders !== existing.reminders) {
    setPrevReminders(existing.reminders);
    setDraft(existing.reminders);
  }

  const toggle = (list: number[], days: number, apply: (next: number[]) => void) => {
    const next = list.includes(days)
      ? list.filter((d) => d !== days)
      : [...list, days].sort((a, b) => b - a);
    apply(next);
    setSaved(false);
  };

  return (
    <View
      className="gap-2.5 rounded-lg border border-border p-3.5"
      accessibilityState={{ disabled: !remindersEnabled }}
    >
      <Text variant="small" className="font-semibold text-muted-foreground">
        Renewal reminders
      </Text>
      <View className="flex-row flex-wrap gap-x-5 gap-y-2">
        {[7, 3, 1, 0].map((days) => (
          <View key={days} className="flex-row items-center gap-2">
            <Checkbox
              checked={draft.renewalLeadDays.includes(days)}
              disabled={!remindersEnabled}
              onCheckedChange={() =>
                toggle(draft.renewalLeadDays, days, (next) =>
                  setDraft((d) => ({ ...d, renewalLeadDays: next })),
                )
              }
              accessibilityLabel={`Renewal reminder ${days} days before`}
            />
            <Label>{days === 0 ? 'Same day' : `${days}d before`}</Label>
          </View>
        ))}
      </View>
      <Text variant="small" className="font-semibold text-muted-foreground">
        Trial reminders
      </Text>
      <View className="flex-row flex-wrap gap-x-5 gap-y-2">
        {[3, 1, 0].map((days) => (
          <View key={days} className="flex-row items-center gap-2">
            <Checkbox
              checked={draft.trialLeadDays.includes(days)}
              disabled={!remindersEnabled}
              onCheckedChange={() =>
                toggle(draft.trialLeadDays, days, (next) =>
                  setDraft((d) => ({ ...d, trialLeadDays: next })),
                )
              }
              accessibilityLabel={`Trial reminder ${days} days before`}
            />
            <Label>{days === 0 ? 'Same day' : `${days}d before`}</Label>
          </View>
        ))}
      </View>
      <ReminderLeadSave
        draft={draft}
        existing={existing}
        onSaved={() => setSaved(true)}
        saved={saved}
      />
    </View>
  );
}

function ReminderLeadSave({
  draft,
  existing,
  onSaved,
  saved,
}: {
  draft: Subscription['reminders'];
  existing: Subscription;
  onSaved: () => void;
  saved: boolean;
}) {
  const changed =
    draft.renewalLeadDays.join(',') !== existing.reminders.renewalLeadDays.join(',') ||
    draft.trialLeadDays.join(',') !== existing.reminders.trialLeadDays.join(',');
  if (!changed) {
    return saved ? (
      <Text
        variant="small"
        className="pt-1 font-semibold text-primary"
        accessibilityLiveRegion="polite"
      >
        Reminder preferences saved.
      </Text>
    ) : null;
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onPress={async () => {
        await updateSubscription(existing.id, {
          reminders: {
            ...existing.reminders,
            renewalLeadDays: draft.renewalLeadDays,
            trialLeadDays: draft.trialLeadDays,
          },
        });
        onSaved();
      }}
      accessibilityLabel="Save reminder preferences"
    >
      <Text>Save reminder preferences</Text>
    </Button>
  );
}
