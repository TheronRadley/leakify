import { DatePickerField } from '@/components/shared/date-picker-field';
import { FormField } from '@/components/shared/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

  const presetKey = intervalToPresetKey({ every: intervalEvery, unit: intervalUnit });

  const [remindersEnabled, setRemindersEnabled] = React.useState(existing?.reminders.enabled ?? true);
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
    <View className="gap-5 pb-10">
      <Controller
        control={control}
        name="name"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField label="Subscription name" error={errors.name?.message}>
            <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Netflix" autoFocus={!existing} />
          </FormField>
        )}
      />

      <Controller
        control={control}
        name="provider"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField label="Provider / brand" optional error={errors.provider?.message}>
            <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. Netflix Inc." />
          </FormField>
        )}
      />

      <View className="flex-row gap-3">
        <Controller
          control={control}
          name="amount"
          render={({ field: { value, onChange, onBlur } }) => (
            <FormField label="Amount" error={errors.amount?.message} className="flex-1">
              <Input
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="15.49"
                keyboardType="decimal-pad"
              />
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
      <FormField label="Billing frequency" hint={presetKey === 'custom' ? 'Define your own interval below.' : undefined}>
        <View className="gap-3">
          <Select
            value={{ value: presetKey, label: INTERVAL_PRESETS.find((p) => p.key === presetKey)!.label }}
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
                    onChangeText={(text) => onChange(parseInt(text.replace(/[^0-9]/g, ''), 10) || 0)}
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
                      value={{ value, label: UNIT_OPTIONS.find((u) => u.value === value)!.label }}
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
            <Text variant="small" className="text-destructive" accessibilityRole="alert">
              {errors.intervalEvery.message}
            </Text>
          ) : null}
        </View>
      </FormField>

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

      <View className="flex-row gap-3">
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <FormField label="Category" error={errors.category?.message} className="flex-1">
              <Select
                value={{ value, label: CATEGORIES.find((c) => c.key === value)?.label ?? value }}
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
            <FormField label="Status" error={errors.status?.message} className="flex-1">
              <Select
                value={{ value, label: STATUS_OPTIONS.find((s) => s.value === value)!.label }}
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
            <Input value={value} onChangeText={onChange} onBlur={onBlur} placeholder="Visa •••• 4242" />
          </FormField>
        )}
      />

      <Controller
        control={control}
        name="cancellationUrl"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField label="Cancellation link" optional error={errors.cancellationUrl?.message}>
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
            <Textarea value={value} onChangeText={onChange} onBlur={onBlur} placeholder="e.g. shared with family, billed to work card" />
          </FormField>
        )}
      />

      <Separator />

      {/* Reminders */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-medium">Reminders</Text>
            <Text variant="small" className="text-muted-foreground">
              Uses your default lead times from Settings unless customized.
            </Text>
          </View>
          <Switch
            checked={remindersEnabled}
            onCheckedChange={setRemindersEnabled}
            accessibilityLabel="Enable reminders for this subscription"
          />
        </View>
        {existing ? (
          <ReminderLeadEditor existing={existing} remindersEnabled={remindersEnabled} />
        ) : null}
      </View>

      {serverError ? (
        <Text variant="small" className="text-destructive" accessibilityRole="alert">
          {serverError}
        </Text>
      ) : null}

      <Button loading={isSubmitting} onPress={() => void submit()} accessibilityLabel={submitLabel}>
        <Text>{submitLabel}</Text>
      </Button>
    </View>
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

  // Adjust state during render (React-recommended "previous props" pattern):
  // resync the draft when the store refreshes the subscription.
  const [prevReminders, setPrevReminders] = React.useState(existing.reminders);
  if (prevReminders !== existing.reminders) {
    setPrevReminders(existing.reminders);
    setDraft(existing.reminders);
  }

  const toggle = (list: number[], days: number, apply: (next: number[]) => void) => {
    const next = list.includes(days) ? list.filter((d) => d !== days) : [...list, days].sort((a, b) => b - a);
    apply(next);
    setSaved(false);
  };

  return (
    <View className="gap-2.5 rounded-md border border-border p-3" accessibilityState={{ disabled: !remindersEnabled }}>
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
                toggle(draft.renewalLeadDays, days, (next) => setDraft((d) => ({ ...d, renewalLeadDays: next })))
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
                toggle(draft.trialLeadDays, days, (next) => setDraft((d) => ({ ...d, trialLeadDays: next })))
              }
              accessibilityLabel={`Trial reminder ${days} days before`}
            />
            <Label>{days === 0 ? 'Same day' : `${days}d before`}</Label>
          </View>
        ))}
      </View>
      <ReminderLeadSave draft={draft} existing={existing} onSaved={() => setSaved(true)} saved={saved} />
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
      <Text variant="small" className="pt-1 font-semibold text-primary" accessibilityLiveRegion="polite">
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
