import { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useSession } from '../../src/hooks/useSession';
import { initInventory } from '../../src/stores/inventory.store';
import { AnimatedPressable, useToast, useTheme, type Theme } from '@medstock/ui';
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
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
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
      <SafeAreaView style={s.container}>
        <ActivityIndicator color={theme.primary} style={s.loader} />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.card}>
          <Text style={s.emoji}>✉️</Text>
          <Text style={s.title}>Convite recebido</Text>
          <Text style={s.text}>
            Faça login ou crie uma conta para aceitar o convite para a família.
          </Text>
          <AnimatedPressable
            style={s.primaryBtn}
            onPress={() => { router.replace('/(auth)/sign-in'); }}
          >
            <Text style={s.primaryBtnText}>Entrar na conta</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loadingInfo) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator color={theme.primary} style={s.loader} />
      </SafeAreaView>
    );
  }

  if (notFound || !info) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.card}>
          <Text style={s.emoji}>🔗</Text>
          <Text style={s.title}>Convite inválido</Text>
          <Text style={s.text}>
            Este link de convite não foi encontrado ou expirou.
          </Text>
          <AnimatedPressable style={s.primaryBtn} onPress={() => { router.replace('/(app)'); }}>
            <Text style={s.primaryBtnText}>Ir para o app</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!info.is_valid) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.card}>
          <Text style={s.emoji}>⏰</Text>
          <Text style={s.title}>Convite expirado</Text>
          <Text style={s.text}>
            Este convite expirou ou já foi utilizado. Peça um novo convite ao dono do grupo.
          </Text>
          <AnimatedPressable style={s.primaryBtn} onPress={() => { router.replace('/(app)'); }}>
            <Text style={s.primaryBtnText}>Ir para o app</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.card}>
        <Text style={s.emoji}>👨‍👩‍👧‍👦</Text>
        <Text style={s.title}>Você foi convidado!</Text>
        <Text style={s.text}>Entrar no grupo familiar</Text>
        <Text style={s.familyName}>{info.family_name}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleText}>Papel: {ROLE_LABEL[info.invited_role]}</Text>
        </View>
        <AnimatedPressable
          style={[s.primaryBtn, accepting && s.btnDisabled]}
          onPress={() => { void handleAccept(); }}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.primaryBtnText}>Aceitar convite</Text>
          }
        </AnimatedPressable>
        <AnimatedPressable
          style={s.secondaryBtn}
          onPress={() => { router.replace('/(app)'); }}
        >
          <Text style={s.secondaryBtnText}>Recusar</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: t.bg, justifyContent: 'center' },
    loader:           { marginTop: 60 },
    card:             { margin: 24, backgroundColor: t.surface, borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: t.border },
    emoji:            { fontSize: 48, marginBottom: 16 },
    title:            { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 8, textAlign: 'center' },
    text:             { fontSize: 14, color: t.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
    familyName:       { fontSize: 20, fontWeight: '700', color: t.primary, marginBottom: 12, textAlign: 'center' },
    roleBadge:        { backgroundColor: t.primaryBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 24 },
    roleText:         { fontSize: 13, color: t.primary, fontWeight: '600' },
    primaryBtn:       { backgroundColor: t.primary, borderRadius: 16, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10 },
    primaryBtnText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    btnDisabled:      { opacity: 0.6 },
    secondaryBtn:     { padding: 10 },
    secondaryBtnText: { color: t.textMuted, fontSize: 14 },
  });
}
