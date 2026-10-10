import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { formatDisplayDate, isValidISODate, parseISODate, toISODate } from '@/lib/dates';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as React from 'react';
import { Platform, View } from 'react-native';

/**
 * Platform date picker field.
 * - Android: tap opens the native dialog directly.
 * - iOS: tap opens an inline spinner panel.
 * - Web: the community picker has no web build, so a validated YYYY-MM-DD
 *   text input is used instead.
 * Value is an ISO calendar date string ("" when unset).
 */
export function DatePickerField({
  value,
  onChange,
  placeholder = 'Select date',
  testID,
}: {
  value: string;
  onChange: (isoDateOrEmpty: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState(value);
  const [textError, setTextError] = React.useState<string | null>(null);
  const date = parseISODate(value);

  const isUnsupported = Platform.OS === 'web';

  // Resync the text input when the field value changes (render-phase adjust pattern).
  const [prevValue, setPrevValue] = React.useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setTextValue(value);
  }

  const commitText = () => {
    const trimmed = textValue.trim();
    if (trimmed === '') {
      setTextError(null);
      onChange('');
      return;
    }
    if (isValidISODate(trimmed)) {
      setTextError(null);
      onChange(trimmed);
    } else {
      setTextError('Use YYYY-MM-DD, e.g. 2026-10-21.');
    }
  };

  if (isUnsupported) {
    return (
      <View className="gap-1">
        <Input
          value={textValue}
          onChangeText={setTextValue}
          onBlur={commitText}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={`${placeholder} (format YYYY-MM-DD)`}
          testID={testID}
        />
        {textError ? (
          <Text variant="small" className="text-destructive" accessibilityRole="alert">
            {textError}
          </Text>
        ) : value ? (
          <Text variant="small" className="text-muted-foreground">
            {formatDisplayDate(value)}
          </Text>
        ) : null}
      </View>
    );
  }

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') return;
    if (selected) onChange(toISODate(selected));
  };

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-start"
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={value ? `Selected date ${formatDisplayDate(value)}. Change date` : placeholder}
          testID={testID}
        >
          <Text className={value ? 'text-foreground' : 'text-muted-foreground'}>
            {value ? formatDisplayDate(value) : placeholder}
          </Text>
        </Button>
        {value ? (
          <Button variant="ghost" size="sm" onPress={() => onChange('')} accessibilityLabel="Clear date">
            <Text className="text-muted-foreground">Clear</Text>
          </Button>
        ) : null}
      </View>
      {open ? (
        <DateTimePicker
          value={date ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
