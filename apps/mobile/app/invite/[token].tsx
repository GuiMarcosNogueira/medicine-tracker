import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/hooks/useSession';
import { initInventory } from '../../src/stores/inventory.store';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

type InviteRole = 'owner' | 'editor' | 'viewer';

const ROLE_LABEL: Record<InviteRole, string> = {
  owner:  'Dono',
  editor: 'Editor',
  viewer: 'Visualizador',
};

interface InviteInfo {
  family_id:    string;
  family_name:  string;
  invited_role: InviteRole;
  expires_at:   string;
  is_valid:     boolean;
}

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, loading: authLoading } = useSession();
  const toast = useToast();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (authLoading || !session || !token) return;
    void fetchInfo();
  }, [authLoading, session, token]);

  async function fetchInfo() {
    setLoadingInfo(true);
    const { data, error } = await supabase.rpc('get_invite_info', { p_token: token });
    setLoadingInfo(false);
    const rows = data as InviteInfo[] | null;
    if (error || !rows || rows.length === 0) {
      setNotFound(true);
      return;
    }
    setInfo(rows[0] ?? null);
  }

  async function handleAccept() {
    if (!token || !info) return;
    setAccepting(true);
    const { error } = await supabase.rpc('accept_invite', { p_token: token });
    setAccepting(false);
    if (error) {
      toast.show('error', 'Erro', error.message);
      hapticError();
      return;
    }
    hapticSuccess();
    toast.show('success', 'Bem-vindo!', `Você entrou em ${info.family_name}.`);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await initInventory(user.id);
    router.replace('/(app)');
  }

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#1A9E96" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✉️</Text>
          <Text style={styles.title}>Convite recebido</Text>
          <Text style={styles.text}>
            Faça login ou crie uma conta para aceitar o convite para a família.
          </Text>
          <AnimatedPressable
            style={styles.primaryBtn}
            onPress={() => { router.replace('/(auth)/sign-in'); }}
          >
            <Text style={styles.primaryBtnText}>Entrar na conta</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color="#1A9E96" style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (notFound || !info) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🔗</Text>
          <Text style={styles.title}>Convite inválido</Text>
          <Text style={styles.text}>
            Este link de convite não foi encontrado ou expirou.
          </Text>
          <AnimatedPressable style={styles.primaryBtn} onPress={() => { router.replace('/(app)'); }}>
            <Text style={styles.primaryBtnText}>Ir para o app</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!info.is_valid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⏰</Text>
          <Text style={styles.title}>Convite expirado</Text>
          <Text style={styles.text}>
            Este convite expirou ou já foi utilizado. Peça um novo convite ao dono do grupo.
          </Text>
          <AnimatedPressable style={styles.primaryBtn} onPress={() => { router.replace('/(app)'); }}>
            <Text style={styles.primaryBtnText}>Ir para o app</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.title}>Você foi convidado!</Text>
        <Text style={styles.text}>Entrar no grupo familiar</Text>
        <Text style={styles.familyName}>{info.family_name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>Papel: {ROLE_LABEL[info.invited_role]}</Text>
        </View>
        <AnimatedPressable
          style={[styles.primaryBtn, accepting && styles.btnDisabled]}
          onPress={() => { void handleAccept(); }}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.primaryBtnText}>Aceitar convite</Text>
          }
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.secondaryBtn}
          onPress={() => { router.replace('/(app)'); }}
        >
          <Text style={styles.secondaryBtnText}>Recusar</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F8F5', justifyContent: 'center' },
  loader:          { marginTop: 60 },
  card:            { margin: 24, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#E0E4E0' },
  emoji:           { fontSize: 48, marginBottom: 16 },
  title:           { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, textAlign: 'center' },
  text:            { fontSize: 14, color: '#5A625A', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  familyName:      { fontSize: 20, fontWeight: '700', color: '#1A9E96', marginBottom: 12, textAlign: 'center' },
  roleBadge:       { backgroundColor: '#EAF6F5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
  roleText:        { fontSize: 13, color: '#1A9E96', fontWeight: '600' },
  primaryBtn:      { backgroundColor: '#1A9E96', borderRadius: 16, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10 },
  primaryBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnDisabled:     { opacity: 0.6 },
  secondaryBtn:    { padding: 10 },
  secondaryBtnText:{ color: '#9CA59C', fontSize: 14 },
});
