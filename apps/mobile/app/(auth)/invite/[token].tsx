import { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
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
    if (error || !data) {
      Alert.alert('Convite inválido', 'Este convite não existe ou já expirou.');
      return;
    }
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
      Alert.alert('Erro', 'Convite não encontrado.');
      setAccepting(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({ family_id: invite.family_id, profile_id: user.id, role: invite.invited_role });

    if (memberError) {
      Alert.alert('Erro', memberError.message);
      setAccepting(false);
      return;
    }

    await supabase
      .from('family_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    setAccepting(false);
    Alert.alert('Sucesso', 'Você entrou na família!', [
      { text: 'OK', onPress: () => router.replace('/(app)') },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1A9E96" />
      </SafeAreaView>
    );
  }

  if (!inviteInfo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Convite inválido</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/sign-in')}>
            <Text style={styles.btnText}>Ir para o início</Text>
          </Pressable>
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
        <Pressable
          style={[styles.btn, accepting && styles.btnDisabled]}
          onPress={() => { void handleAccept(); }}
          disabled={accepting}
        >
          {accepting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Aceitar convite</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace('/(auth)/sign-in')} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Recusar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F6F8F5', alignItems: 'center', justifyContent: 'center' },
  inner:       { padding: 32, alignItems: 'center', maxWidth: 420, width: '100%' },
  title:       { fontSize: 24, fontWeight: '700', color: '#1A1D1A', marginBottom: 16, letterSpacing: -0.5 },
  body:        { fontSize: 16, color: '#5A625A', textAlign: 'center', lineHeight: 26, marginBottom: 32 },
  highlight:   { fontWeight: '700', color: '#1A9E96' },
  btn:         { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', width: '100%' },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelBtn:   { marginTop: 16 },
  cancelText:  { color: '#5A625A', fontSize: 14 },
});
