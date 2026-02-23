import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../src/lib/supabase';

// This call is required when this page is opened as an OAuth popup on web.
// It detects the auth session, closes the popup, and sends the URL back to the opener.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  useEffect(() => {
    // Fallback for full-page redirect (e.g. mobile deep link or direct navigation).
    // When opened as a popup, maybeCompleteAuthSession() above handles it instead.
    if (Platform.OS !== 'web') return;

    const locationHash = (globalThis as unknown as { location?: { hash?: string } }).location?.hash ?? '';
    const hash = locationHash.startsWith('#') ? locationHash.slice(1) : locationHash;
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      void supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
        router.replace(error ? '/(auth)/sign-in' : '/(app)');
      });
    } else {
      router.replace('/(auth)/sign-in');
    }
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1A9E96" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8F5' },
});
