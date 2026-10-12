import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="recover" />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
