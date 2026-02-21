import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { authStore } from '../../../src/stores/auth.store';
import { supabase } from '../../../src/lib/supabase';
import { cleanupInventory } from '../../../src/stores/inventory.store';

export default function SettingsScreen() {
  const session = useSelector(authStore.session);
  const email = session?.user.email ?? '';
  const fullName =
    (session?.user.user_metadata as { full_name?: string } | undefined)?.full_name ?? '';

  function handleSignOut() {
    Alert.alert('Sair', 'Deseja encerrar sua sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            cleanupInventory();
            await supabase.auth.signOut();
            router.replace('/(auth)/sign-in');
          })();
        },
      },
    ]);
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

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8fafc' },
  content:     { flex: 1, padding: 16 },
  title:       { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 24 },
  label:       { fontSize: 12, color: '#64748b', marginBottom: 2 },
  value:       { fontSize: 15, color: '#1e293b', fontWeight: '500', marginBottom: 12 },
  divider:     { height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 },
  signOutBtn:  { borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  signOutText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
