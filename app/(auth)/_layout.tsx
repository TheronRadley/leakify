import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { FadeInView } from '@/components/ui/motion';
import { Text } from '@/components/ui/text';
import { router, Slot } from 'expo-router';
import { Droplets } from 'lucide-react-native';
import * as React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthLayout() {
  return (
    <SafeAreaView className="flex-1 bg-muted/40">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow items-center justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView delay={0} className="w-full max-w-sm gap-6">
            {/* shadcn login-03 style brand header */}
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              accessibilityRole="button"
              accessibilityLabel="Leakify home"
              className="flex-row items-center justify-center gap-2.5 self-center"
            >
              <View className="h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Icon as={Droplets} size={15} className="text-primary-foreground" />
              </View>
              <Text className="text-base font-semibold tracking-tight text-foreground">
                Leakify
              </Text>
              <Badge variant="outline">
                <Text>Tracker</Text>
              </Badge>
            </Pressable>

            <FadeInView delay={60} className="w-full">
              <Slot />
            </FadeInView>

            <FadeInView delay={120} className="items-center px-4">
              <Text className="text-center text-xs leading-4 text-muted-foreground">
                Your subscription ledger stays private and can be used completely offline at any
                time.
              </Text>
            </FadeInView>
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
