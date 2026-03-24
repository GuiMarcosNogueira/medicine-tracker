import { useMemo, useState } from 'react';
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
import { AnimatedPressable, useToast, useTheme, type Theme } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';

type InviteRole = 'viewer' | 'editor';

export default function InviteScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <AnimatedPressable onPress={() => { router.back(); }} style={s.backBtn}>
          <Text style={s.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={s.title}>Convidar membro</Text>
      </View>

      <View style={s.content}>
        {!inviteLink ? (
          <>
            <Text style={s.label}>Permissão do convidado</Text>
            <View style={s.roleRow}>
              {(['viewer', 'editor'] as InviteRole[]).map(r => (
                <AnimatedPressable
                  key={r}
                  style={[s.roleChip, role === r && s.roleChipActive]}
                  onPress={() => { setRole(r); }}
                >
                  <Text style={[s.roleChipTitle, role === r && s.roleChipTitleActive]}>
                    {r === 'viewer' ? 'Visualizador' : 'Editor'}
                  </Text>
                  <Text style={[s.roleChipSub, role === r && s.roleChipSubActive]}>
                    {r === 'viewer' ? 'Apenas leitura' : 'Pode adicionar e editar'}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>

            <Text style={s.label}>Email do convidado (opcional)</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="fulano@exemplo.com"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={s.hint}>O link gerado é válido por 7 dias.</Text>

            <AnimatedPressable
              style={[s.btn, loading && s.btnDisabled]}
              onPress={() => { void handleGenerate(); }}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Gerar link de convite</Text>
              }
            </AnimatedPressable>
          </>
        ) : (
          <>
            <View style={s.successTop}>
              <Text style={s.successEmoji}>🔗</Text>
              <Text style={s.successTitle}>Link criado!</Text>
              <Text style={s.successSub}>
                Compartilhe com o membro que deseja convidar. O link expira em 7 dias.
              </Text>
            </View>

            <View style={s.linkBox}>
              <Text style={s.linkText} selectable>{inviteLink}</Text>
            </View>

            <AnimatedPressable style={s.btn} onPress={() => { void handleShare(); }}>
              <Text style={s.btnText}>
                {Platform.OS === 'web' ? 'Copiar link' : 'Compartilhar link'}
              </Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={s.secondaryBtn}
              onPress={() => { setInviteLink(null); setEmail(''); }}
            >
              <Text style={s.secondaryText}>Gerar outro convite</Text>
            </AnimatedPressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:          { flex: 1, backgroundColor: t.bg },
    header:             { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
    backBtn:            { paddingRight: 4 },
    backText:           { color: t.primary, fontSize: 15 },
    title:              { fontSize: 22, fontWeight: '700', color: t.text },
    content:            { flex: 1, padding: 16 },
    label:              { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 8 },
    roleRow:            { flexDirection: 'row', gap: 12, marginBottom: 24 },
    roleChip:           { flex: 1, borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 14, backgroundColor: t.surface },
    roleChipActive:     { borderColor: t.primary, backgroundColor: t.primaryBg },
    roleChipTitle:      { fontSize: 14, fontWeight: '700', color: t.textSub, marginBottom: 3 },
    roleChipTitleActive:{ color: t.primary },
    roleChipSub:        { fontSize: 12, color: t.textMuted },
    roleChipSubActive:  { color: t.primary },
    input:              { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, marginBottom: 6, fontSize: 15, backgroundColor: t.surface, color: t.text },
    hint:               { fontSize: 12, color: t.textMuted, marginBottom: 24 },
    btn:                { backgroundColor: t.primary, borderRadius: 16, padding: 15, alignItems: 'center' },
    btnDisabled:        { opacity: 0.6 },
    btnText:            { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    successTop:         { alignItems: 'center', marginBottom: 24, marginTop: 12 },
    successEmoji:       { fontSize: 52, marginBottom: 12 },
    successTitle:       { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 6 },
    successSub:         { fontSize: 14, color: t.textSub, textAlign: 'center', lineHeight: 20 },
    linkBox:            { backgroundColor: t.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.borderSub, marginBottom: 16 },
    linkText:           { fontSize: 13, color: t.text },
    secondaryBtn:       { alignItems: 'center', marginTop: 16 },
    secondaryText:      { color: t.primary, fontSize: 14, fontWeight: '600' },
  });
}
