import { Alert, AlertDescription } from '@/components/ui/alert';
import { FieldSeparator } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Text as RNText } from '@/components/ui/text';
import { Link as RouterLink, type LinkProps } from 'expo-router';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';
import * as React from 'react';
import { type TextInputProps } from 'react-native';

/** Inline navigation link styled as interactive shadcn/ui text. */
export function Link({ href, children }: { href: LinkProps['href']; children: string }) {
  return (
    <RouterLink href={href} asChild>
      <RNText
        variant="muted"
        className="font-medium text-foreground underline underline-offset-4 web:hover:text-primary"
        accessibilityRole="link"
      >
        {children}
      </RNText>
    </RouterLink>
  );
}

export const Text = RNText;

export function OrDivider({ label = 'Or continue with' }: { label?: string }) {
  return <FieldSeparator className="my-1">{label}</FieldSeparator>;
}

export function PasswordInput(props: TextInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <InputGroup>
      <InputGroupInput {...props} secureTextEntry={!visible} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          variant="ghost"
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible((v) => !v)}
        >
          <Icon as={visible ? EyeOff : Eye} size={15} className="text-muted-foreground" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" icon={AlertCircle}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function InfoBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert variant="default" icon={CheckCircle2}>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function FieldErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <RNText variant="small" className="text-sm text-destructive" accessibilityRole="alert">
      {message}
    </RNText>
  );
}
