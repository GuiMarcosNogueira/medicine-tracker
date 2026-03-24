import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { ToastProvider, ThemeProvider } from '@medstock/ui';
import { useSelector } from '@legendapp/state/react';
import { initAuth } from '../src/stores/auth.store';
import { preferencesStore, initPreferences } from '../src/stores/preferences.store';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Fraunces-Bold':         Fraunces_700Bold,
    'DMSans-Regular':        DMSans_400Regular,
    'DMSans-Medium':         DMSans_500Medium,
    'DMSans-SemiBold':       DMSans_600SemiBold,
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
  });

  const preference = useSelector(preferencesStore.theme);
  const loaded     = useSelector(preferencesStore.loaded);

  useEffect(() => {
    const unsubscribe = initAuth();
    return unsubscribe;
  }, []);

  useEffect(() => {
    void initPreferences();
  }, []);

  useEffect(() => {
    if (fontsLoaded && loaded) void SplashScreen.hideAsync();
  }, [fontsLoaded, loaded]);

  if (!fontsLoaded || !loaded) return null;

  return (
    <ThemeProvider preference={preference}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <ToastProvider>
            <StatusBar style={preference === 'dark' ? 'light' : preference === 'light' ? 'dark' : 'auto'} />
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
