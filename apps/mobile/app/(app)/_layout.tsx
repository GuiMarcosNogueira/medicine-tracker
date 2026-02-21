import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSelector } from '@legendapp/state/react';
import { authStore } from '../../src/stores/auth.store';
import { initInventory, cleanupInventory } from '../../src/stores/inventory.store';
import { registerPushToken } from '../../src/lib/notifications';

export default function AppLayout() {
  const session = useSelector(authStore.session);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    void initInventory(userId);
    void registerPushToken();
    return () => { cleanupInventory(); };
  }, [session?.user.id]);

  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <Tabs screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563eb',
        }}
      >
        <Tabs.Screen name="index"           options={{ title: 'Início' }} />
        <Tabs.Screen name="inventory/index" options={{ title: 'Estoque' }} />
        <Tabs.Screen name="catalog/index"   options={{ title: 'Catálogo' }} />
        <Tabs.Screen name="settings/index"  options={{ title: 'Config' }} />
        <Tabs.Screen name="scanner"         options={{ href: null }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
