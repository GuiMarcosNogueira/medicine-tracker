import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { supabase } from '../../../src/lib/supabase';
import { inventoryStore } from '../../../src/stores/inventory.store';
import { authStore } from '../../../src/stores/auth.store';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';

type InviteRole = 'viewer' | 'editor';

export default function InviteScreen() {
  const toast = useToast();
  const familyId = useSelector(inventoryStore.familyId);
  const userId = useSelector(authStore.session)?.user.id;
  const [role, setRole] = useState<InviteRole>('viewer');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function handleGenerate() {
    if (!familyId || !userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('family_invites')
      .insert({
        family_id:    familyId,
        invited_role: role,
        invited_by:   userId,
        ...(email.trim() ? { invited_email: email.trim() } : {}),
      })
      .select('token')
      .single();

    setLoading(false);
    if (error || !data) {
      toast.show('error', 'Erro', error?.message ?? 'Falha ao gerar convite');
      hapticError();
      return;
    }

    hapticSuccess();
    const token = data.token as string;
    const origin =
      Platform.OS === 'web'
        ? (globalThis as unknown as { location?: { origin?: string } }).location?.origin ?? ''
        : 'medstock:/';
    setInviteLink(`${origin}/invite/${token}`);
  }

  async function handleShare() {
    if (!inviteLink) return;
    if (Platform.OS !== 'web') {
      try { await Share.share({ message: inviteLink }); } catch { /* cancelled */ }
    } else {
      const clip = (globalThis as unknown as {
        navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } }
      }).navigator?.clipboard;
      if (clip?.writeText) {
        await clip.writeText(inviteLink);
        toast.show('success', 'Copiado!', 'Link copiado para a área de transferência.');
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => { router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={styles.title}>Convidar membro</Text>
      </View>

      <View style={styles.content}>
        {!inviteLink ? (
          <>
            <Text style={styles.label}>Permissão do convidado</Text>
            <View style={styles.roleRow}>
              {(['viewer', 'editor'] as InviteRole[]).map(r => (
                <AnimatedPressable
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => { setRole(r); }}
                >
                  <Text style={[styles.roleChipTitle, role === r && styles.roleChipTitleActive]}>
                    {r === 'viewer' ? 'Visualizador' : 'Editor'}
                  </Text>
                  <Text style={[styles.roleChipSub, role === r && styles.roleChipSubActive]}>
                    {r === 'viewer' ? 'Apenas leitura' : 'Pode adicionar e editar'}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={styles.label}>Email do convidado (opcional)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="fulano@exemplo.com"
              placeholderTextColor="#9CA59C"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.hint}>O link gerado é válido por 7 dias.</Text>

            <AnimatedPressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => { void handleGenerate(); }}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Gerar link de convite</Text>
              }
            </AnimatedPressable>
          </>
        ) : (
          <>
            <View style={styles.successTop}>
              <Text style={styles.successEmoji}>🔗</Text>
              <Text style={styles.successTitle}>Link criado!</Text>
              <Text style={styles.successSub}>
                Compartilhe com o membro que deseja convidar. O link expira em 7 dias.
              </Text>
            </View>

            <View style={styles.linkBox}>
              <Text style={styles.linkText} selectable>{inviteLink}</Text>
            </View>

            <AnimatedPressable style={styles.btn} onPress={() => { void handleShare(); }}>
              <Text style={styles.btnText}>
                {Platform.OS === 'web' ? 'Copiar link' : 'Compartilhar link'}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={styles.secondaryBtn}
              onPress={() => { setInviteLink(null); setEmail(''); }}
            >
              <Text style={styles.secondaryText}>Gerar outro convite</Text>
            </AnimatedPressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F6F8F5' },
  header:             { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn:            { paddingRight: 4 },
  backText:           { color: '#1A9E96', fontSize: 15 },
  title:              { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  content:            { flex: 1, padding: 16 },
  label:              { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 8 },
  roleRow:            { flexDirection: 'row', gap: 12, marginBottom: 24 },
  roleChip:           { flex: 1, borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, backgroundColor: '#FFFFFF' },
  roleChipActive:     { borderColor: '#1A9E96', backgroundColor: '#EAF6F5' },
  roleChipTitle:      { fontSize: 14, fontWeight: '700', color: '#5A625A', marginBottom: 3 },
  roleChipTitleActive:{ color: '#1A9E96' },
  roleChipSub:        { fontSize: 12, color: '#9CA59C' },
  roleChipSubActive:  { color: '#1A9E96' },
  input:              { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 6, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  hint:               { fontSize: 12, color: '#9CA59C', marginBottom: 24 },
  btn:                { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center' },
  btnDisabled:        { opacity: 0.6 },
  btnText:            { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  successTop:         { alignItems: 'center', marginBottom: 24, marginTop: 12 },
  successEmoji:       { fontSize: 52, marginBottom: 12 },
  successTitle:       { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 6 },
  successSub:         { fontSize: 14, color: '#5A625A', textAlign: 'center', lineHeight: 20 },
  linkBox:            { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#D1D9CC', marginBottom: 16 },
  linkText:           { fontSize: 13, color: '#1A1D1A' },
  secondaryBtn:       { alignItems: 'center', marginTop: 16 },
  secondaryText:      { color: '#1A9E96', fontSize: 14, fontWeight: '600' },
});
