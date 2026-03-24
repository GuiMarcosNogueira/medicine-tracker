import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { authStore } from '../../../src/stores/auth.store';
import { supabase } from '../../../src/lib/supabase';
import { cleanupInventory, inventoryStore } from '../../../src/stores/inventory.store';
import { preferencesStore, setThemePreference } from '../../../src/stores/preferences.store';
import { AnimatedPressable, ConfirmDialog, useTheme, fonts, type Theme, type ThemePreference } from '@medstock/ui';

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'light',  label: '☀ Claro'   },
  { key: 'dark',   label: '☾ Escuro'  },
  { key: 'system', label: '⊙ Sistema' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const session = useSelector(authStore.session);
  const familyId = useSelector(inventoryStore.familyId);
  const currentPref = useSelector(preferencesStore.theme);
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
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>Configurações</Text>

        <View style={s.card}>
          <Text style={s.label}>Nome</Text>
          <Text style={s.value}>{fullName || '—'}</Text>
          <View style={s.divider} />
          <Text style={s.label}>Email</Text>
          <Text style={s.value}>{email}</Text>
        </View>

        <AnimatedPressable
          style={s.familyCard}
          onPress={() => { router.push('/(app)/settings/family'); }}
        >
          <View style={s.familyCardContent}>
            <View>
              <Text style={s.label}>Grupo familiar</Text>
              <Text style={s.familyName}>{familyName || '—'}</Text>
              {memberCount > 0 && (
                <Text style={s.memberCount}>
                  {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
                </Text>
              )}
            </View>
            <Text style={s.arrow}>›</Text>
          </View>
        </AnimatedPressable>

        <View style={s.card}>
          <Text style={s.label}>Aparência</Text>
          <View style={s.themeRow}>
            {THEME_OPTIONS.map(({ key, label }) => {
              const active = currentPref === key;
              return (
                <AnimatedPressable
                  key={key}
                  style={[s.themeBtn, active && s.themeBtnActive]}
                  onPress={() => { void setThemePreference(key); }}
                >
                  <Text style={[s.themeBtnText, active && s.themeBtnTextActive]}>{label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        <AnimatedPressable style={s.signOutBtn} onPress={() => { setSignOutVisible(true); }}>
          <Text style={s.signOutText}>Sair da conta</Text>
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

function styles(t: Theme) {
  return StyleSheet.create({
    container:         { flex: 1, backgroundColor: t.bg },
    content:           { flex: 1, padding: 16 },
    title:             { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 20, fontFamily: fonts.heading },
    card:              { backgroundColor: t.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.border, marginBottom: 12 },
    label:             { fontSize: 12, color: t.textSub, marginBottom: 2 },
    value:             { fontSize: 15, color: t.text, fontWeight: '500', marginBottom: 12 },
    divider:           { height: 1, backgroundColor: t.surfaceAlt, marginBottom: 12 },
    familyCard:        { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border, marginBottom: 12 },
    familyCardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    familyName:        { fontSize: 15, fontWeight: '600', color: t.text, marginTop: 2 },
    memberCount:       { fontSize: 12, color: t.textMuted, marginTop: 2 },
    arrow:             { fontSize: 22, color: t.textMuted },
    themeRow:          { flexDirection: 'row', gap: 8, marginTop: 10 },
    themeBtn:          { flex: 1, borderWidth: 1, borderColor: t.borderSub, borderRadius: 12, paddingVertical: 8, alignItems: 'center', backgroundColor: t.bg },
    themeBtnActive:    { borderColor: t.primary, backgroundColor: t.primaryBg },
    themeBtnText:      { fontSize: 13, fontWeight: '600', color: t.textSub },
    themeBtnTextActive:{ color: t.primary },
    signOutBtn:        { borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: t.coral, marginTop: 12 },
    signOutText:       { color: t.coral, fontWeight: '600', fontSize: 15 },
  });
}
