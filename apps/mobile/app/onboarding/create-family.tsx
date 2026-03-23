import { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { familySchema } from '@medstock/shared';
import { AnimatedPressable, useToast, useTheme, type Theme } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';
import { initInventory } from '../../src/stores/inventory.store';

export default function CreateFamilyScreen() {
  const toast = useToast();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleCreate() {
    const result = familySchema.safeParse({ name });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      hapticError();
      return;
    }
    setErrors({});
    setLoading(true);

    const { error: familyError } = await supabase
      .rpc('create_family_with_owner', { p_name: result.data.name });

    setLoading(false);
    if (familyError) {
      toast.show('error', 'Erro', familyError.message);
      hapticError();
      return;
    }

    hapticSuccess();
    // Re-initialize inventory store so familyId is populated before navigating.
    // The (app)/_layout.tsx already ran initInventory when this screen mounted
    // (before the family existed), so familyId was null. Calling it again here
    // ensures the store is ready immediately when the user lands on (app).
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await initInventory(user.id);
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled">
        <View style={s.iconContainer}>
          <Text style={s.icon}>💊</Text>
        </View>

        <Text style={s.title}>Bem-vindo ao MedStock!</Text>
        <Text style={s.subtitle}>
          Para começar, crie seu grupo familiar.
        </Text>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>Como funciona</Text>
          <Text style={s.infoItem}>{'•  '}O grupo familiar compartilha um estoque de medicamentos.</Text>
          <Text style={s.infoItem}>{'•  '}Você pode convidar outros membros depois.</Text>
          <Text style={s.infoItem}>{'•  '}Alertas de vencimento são enviados para todos.</Text>
        </View>

        <Text style={s.label}>Nome do grupo</Text>
        <TextInput
          style={[s.input, errors['name'] ? s.inputError : null]}
          value={name}
          onChangeText={v => { setName(v); if (errors['name']) setErrors({}); }}
          placeholder="Ex: Família Silva"
          placeholderTextColor={theme.textMuted}
          maxLength={100}
        />
        {Boolean(errors['name']) && <Text style={s.fieldError}>{errors['name']}</Text>}

        <AnimatedPressable
          style={[s.btn, loading && s.btnDisabled]}
          onPress={() => { void handleCreate(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Criar grupo e começar</Text>
          }
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:     { flex: 1, backgroundColor: t.bg },
    inner:         { padding: 28, maxWidth: 480, alignSelf: 'center', width: '100%', paddingTop: 40 },
    iconContainer: { alignItems: 'center', marginBottom: 20 },
    icon:          { fontSize: 56 },
    title:         { fontSize: 28, fontWeight: '700', color: t.text, marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' },
    subtitle:      { fontSize: 15, color: t.textSub, marginBottom: 24, lineHeight: 22, textAlign: 'center' },
    infoCard:      { backgroundColor: t.primaryBg, borderRadius: 16, padding: 18, marginBottom: 28, gap: 8 },
    infoTitle:     { fontSize: 13, fontWeight: '700', color: t.primary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    infoItem:      { fontSize: 14, color: t.text, lineHeight: 20 },
    label:         { fontSize: 13, fontWeight: '600', color: t.textSub, marginBottom: 6, marginLeft: 2 },
    input:         { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: t.surface, color: t.text },
    inputError:    { borderColor: t.coral },
    fieldError:    { color: t.coral, fontSize: 12, marginBottom: 12, marginLeft: 4 },
    btn:           { backgroundColor: t.primary, borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
    btnDisabled:   { opacity: 0.6 },
    btnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  });
}
