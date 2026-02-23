import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSelector } from '@legendapp/state/react';
import { authStore } from '../../src/stores/auth.store';
import { initInventory, cleanupInventory } from '../../src/stores/inventory.store';
import { registerPushToken } from '../../src/lib/notifications';

const TAB_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: '#1A9E96',
  tabBarInactiveTintColor: '#9CA59C',
  tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E0E4E0' },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

export default function AppLayout() {
  const session = useSelector(authStore.session);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    void initInventory(userId);
    void registerPushToken();
    return () => { cleanupInventory(); };
  }, [session?.user.id]);

  return (
    <SafeAreaProvider>
      <Tabs screenOptions={TAB_OPTIONS}>
        <Tabs.Screen name="index"      options={{ title: 'Início' }} />
        <Tabs.Screen name="inventory"  options={{ title: 'Estoque' }} />
        <Tabs.Screen name="catalog"    options={{ title: 'Catálogo' }} />
        <Tabs.Screen name="settings"   options={{ title: 'Config' }} />
        <Tabs.Screen name="scanner"    options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
