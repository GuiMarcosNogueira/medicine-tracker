import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initAuth } from '../src/stores/auth.store';

export default function RootLayout() {
  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
