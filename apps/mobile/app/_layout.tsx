import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';

// During Expo Router's static web rendering (SSR), useLayoutEffect cannot
// run (no DOM). React Navigation and react-native-safe-area-context use it
// internally, producing noisy warnings. Replacing it with useEffect on the
// server is safe — effects don't run during SSR anyway.
if (typeof (globalThis as Record<string, unknown>).window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (React as any).useLayoutEffect = React.useEffect;
}
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastProvider } from '@medstock/ui';
import { initAuth } from '../src/stores/auth.store';

export default function RootLayout() {
  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
