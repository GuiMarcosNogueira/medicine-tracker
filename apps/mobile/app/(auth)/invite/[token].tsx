import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';

export default function InviteAcceptScreen() {
  const toast = useToast();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading]     = useState(true);
  const [inviteInfo, setInviteInfo] = useState<{ familyName: string; role: string } | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void loadInvite();
  }, [token]);

  async function loadInvite() {
    const { data, error } = await supabase
      .from('family_invites')
      .select('family_id, invited_role, families(name)')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    setLoading(false);
    if (error || !data) return;
    const familiesData = data.families as unknown as { name: string } | null;
    setInviteInfo({
      familyName: familiesData?.name ?? 'Família',
      role: data.invited_role,
    });
  }

  async function handleAccept() {
    setAccepting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace({ pathname: '/(auth)/sign-in' });
      return;
    }

    const { data: invite } = await supabase
      .from('family_invites')
      .select('family_id, invited_role')
      .eq('token', token)
      .single();

    if (!invite) {
      toast.show('error', 'Erro', 'Convite não encontrado.');
      hapticError();
      setAccepting(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({ family_id: invite.family_id, profile_id: user.id, role: invite.invited_role });

    if (memberError) {
      toast.show('error', 'Erro', memberError.message);
      hapticError();
      setAccepting(false);
      return;
    }

    await supabase
      .from('family_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    setAccepting(false);
    hapticSuccess();
    toast.show('success', 'Bem-vindo!', 'Você entrou na família.');
    router.replace('/(app)');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#22C9BF" />
      </SafeAreaView>
    );
  }

  if (!inviteInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Convite inválido</Text>
          <Text style={styles.body}>Este convite não existe ou já expirou.</Text>
          <AnimatedPressable style={styles.btn} onPress={() => { router.replace('/(auth)/sign-in'); }}>
            <Text style={styles.btnText}>Ir para o início</Text>
          </AnimatedPressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Convite para família</Text>
        <Text style={styles.body}>
          Você foi convidado para entrar em {'\n'}
          <Text style={styles.highlight}>{inviteInfo.familyName}</Text>
          {'\n'}como <Text style={styles.highlight}>{inviteInfo.role}</Text>.
        </Text>
        <AnimatedPressable
          style={[styles.btn, accepting ? styles.btnDisabled : null]}
          onPress={() => { void handleAccept(); }}
          disabled={accepting}
        >
          {accepting
            ? <ActivityIndicator color="#0B3D3B" />
            : <Text style={styles.btnText}>Aceitar convite</Text>
          }
        </AnimatedPressable>
        <AnimatedPressable onPress={() => { router.replace('/(auth)/sign-in'); }} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Recusar</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0B3D3B', alignItems: 'center', justifyContent: 'center' },
  inner:       { padding: 32, alignItems: 'center', maxWidth: 420, width: '100%' },
  title:       { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 16, letterSpacing: -0.5 },
  body:        { fontSize: 16, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 26, marginBottom: 32 },
  highlight:   { fontWeight: '700', color: '#22C9BF' },
  btn:         { backgroundColor: '#22C9BF', borderRadius: 16, padding: 15, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#0B3D3B', fontWeight: '700', fontSize: 16 },
  cancelBtn:   { marginTop: 16 },
  cancelText:  { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
