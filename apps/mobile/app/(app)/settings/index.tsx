import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { authStore } from '../../../src/stores/auth.store';
import { supabase } from '../../../src/lib/supabase';
import { cleanupInventory, inventoryStore } from '../../../src/stores/inventory.store';
import { AnimatedPressable, ConfirmDialog } from '@medstock/ui';
import { fonts } from '../../../src/lib/theme';

export default function SettingsScreen() {
  const session = useSelector(authStore.session);
  const familyId = useSelector(inventoryStore.familyId);
  const email = session?.user.email ?? '';
  const fullName =
    (session?.user.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (familyId) void loadFamilyInfo();
  }, [familyId]);

  async function loadFamilyInfo() {
    if (!familyId) return;
    const [familyRes, countRes] = await Promise.all([
      supabase.from('families').select('name').eq('id', familyId).single(),
      supabase.from('family_members').select('*', { count: 'exact', head: true }).eq('family_id', familyId),
    ]);
    if (familyRes.data) setFamilyName(familyRes.data.name);
    if (countRes.count !== null) setMemberCount(countRes.count);
  }

  async function handleSignOut() {
    setSignOutVisible(false);
    cleanupInventory();
    await supabase.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Configurações</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nome</Text>
          <Text style={styles.value}>{fullName || '—'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>
        </View>

        <AnimatedPressable
          style={styles.familyCard}
          onPress={() => { router.push('/(app)/settings/family'); }}
        >
          <View style={styles.familyCardContent}>
            <View>
              <Text style={styles.label}>Grupo familiar</Text>
              <Text style={styles.familyName}>{familyName || '—'}</Text>
              {memberCount > 0 && (
                <Text style={styles.memberCount}>
                  {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                </Text>
              )}
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable style={styles.signOutBtn} onPress={() => { setSignOutVisible(true); }}>
          <Text style={styles.signOutText}>Sair da conta</Text>
        </AnimatedPressable>
      </View>

      <ConfirmDialog
        visible={signOutVisible}
        title="Sair da conta"
        message="Deseja encerrar sua sessão?"
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { void handleSignOut(); }}
        onCancel={() => { setSignOutVisible(false); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F8F5' },
  content:         { flex: 1, padding: 16 },
  title:           { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 20, fontFamily: fonts.heading },
  card:            { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E0E4E0', marginBottom: 12 },
  label:           { fontSize: 12, color: '#5A625A', marginBottom: 2 },
  value:           { fontSize: 15, color: '#1A1D1A', fontWeight: '500', marginBottom: 12 },
  divider:         { height: 1, backgroundColor: '#E8ECE5', marginBottom: 12 },
  familyCard:      { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E4E0', marginBottom: 24 },
  familyCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  familyName:      { fontSize: 15, fontWeight: '600', color: '#1A1D1A', marginTop: 2 },
  memberCount:     { fontSize: 12, color: '#9CA59C', marginTop: 2 },
  arrow:           { fontSize: 22, color: '#9CA59C' },
  signOutBtn:      { borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#F0735A' },
  signOutText:     { color: '#F0735A', fontWeight: '600', fontSize: 15 },
});
