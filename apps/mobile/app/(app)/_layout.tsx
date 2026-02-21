import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function AppLayout() {
  // Web sidebar layout will be implemented in Phase 4.
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
        <Tabs.Screen name="index" options={{ title: 'Início' }} />
        <Tabs.Screen name="inventory/index" options={{ title: 'Estoque' }} />
        <Tabs.Screen name="catalog/index" options={{ title: 'Catálogo' }} />
        <Tabs.Screen name="settings/index" options={{ title: 'Config' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
