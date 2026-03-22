import { useEffect, useMemo } from 'react';
import { Tabs, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSelector } from '@legendapp/state/react';
import { Ionicons } from '@expo/vector-icons';
import { authStore } from '../../src/stores/auth.store';
import { initInventory, cleanupInventory } from '../../src/stores/inventory.store';
import { initTreatments, cleanupTreatments, treatmentStore } from '../../src/stores/treatment.store';
import type { TreatmentRow, TreatmentDoseRow } from '../../src/stores/treatment.store';
import { registerPushToken } from '../../src/lib/notifications';
import { getTodaySlots } from '../../src/utils/treatment';
import { fonts } from '../../src/lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconsName, nameActive: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? nameActive : name} size={22} color={color} />
  );
}

const TAB_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: '#1A9E96',
  tabBarInactiveTintColor: '#9CA59C',
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E0E4E0',
    height: 60,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, fontFamily: fonts.bodySemi },
};

export default function AppLayout() {
  const session        = useSelector(authStore.session);
  const rawTreatments  = useSelector(treatmentStore.treatments);
  const rawTodayDoses  = useSelector(treatmentStore.todayDoses);

  const pendingCount = useMemo(() => {
    const treatments = rawTreatments as TreatmentRow[];
    const todayDoses = rawTodayDoses as TreatmentDoseRow[];
    const now = new Date();
    const slots = getTodaySlots(treatments, todayDoses, now);
    return slots.filter(s => !s.logged && s.scheduledAt <= now).length;
  }, [rawTreatments, rawTodayDoses]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    void initInventory(userId);
    void initTreatments(userId);
    void registerPushToken();
    return () => { cleanupInventory(); cleanupTreatments(); };
  }, [session?.user.id]);

  return (
    <SafeAreaProvider>
      <Tabs screenOptions={TAB_OPTIONS}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Hoje',
            tabBarIcon: tabIcon('home-outline', 'home'),
            ...(pendingCount > 0 ? {
              tabBarBadge: pendingCount,
              tabBarBadgeStyle: { backgroundColor: '#F0735A', fontSize: 10 },
            } : {}),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Estoque',
            tabBarIcon: tabIcon('medkit-outline', 'medkit'),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate('/(app)/inventory');
            },
          }}
        />
        <Tabs.Screen
          name="treatments"
          options={{
            title: 'Tratamentos',
            tabBarIcon: tabIcon('pulse-outline', 'pulse'),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.navigate('/(app)/treatments');
            },
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Perfil',
            tabBarIcon: tabIcon('person-circle-outline', 'person-circle'),
          }}
        />
        <Tabs.Screen name="catalog" options={{ href: null }} />
        <Tabs.Screen name="scanner" options={{ href: null }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
