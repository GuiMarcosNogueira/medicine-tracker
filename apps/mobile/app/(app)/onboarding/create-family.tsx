import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { familySchema } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';

export default function CreateFamilyScreen() {
  const toast = useToast();
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/sign-in'); return; }

    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: result.data.name, owner_id: user.id })
      .select()
      .single();

    if (familyError || !family) {
      toast.show('error', 'Erro', familyError?.message ?? 'Falha ao criar família');
      hapticError();
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('family_members')
      .insert({ family_id: family.id, profile_id: user.id, role: 'owner' });

    setLoading(false);
    if (memberError) {
      toast.show('error', 'Erro', memberError.message);
      hapticError();
      return;
    }

    hapticSuccess();
    router.replace('/(app)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>💊</Text>
        </View>

        <Text style={styles.title}>Bem-vindo ao MedStock!</Text>
        <Text style={styles.subtitle}>
          Para começar, crie seu grupo familiar.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Como funciona</Text>
          <Text style={styles.infoItem}>{'•  '}O grupo familiar compartilha um estoque de medicamentos.</Text>
          <Text style={styles.infoItem}>{'•  '}Você pode convidar outros membros depois.</Text>
          <Text style={styles.infoItem}>{'•  '}Alertas de vencimento são enviados para todos.</Text>
        </View>

        <Text style={styles.label}>Nome do grupo</Text>
        <TextInput
          style={[styles.input, errors['name'] ? styles.inputError : null]}
          value={name}
          onChangeText={v => { setName(v); if (errors['name']) setErrors({}); }}
          placeholder="Ex: Família Silva"
          placeholderTextColor="#9CA59C"
          maxLength={100}
        />
        {Boolean(errors['name']) && <Text style={styles.fieldError}>{errors['name']}</Text>}

        <AnimatedPressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleCreate(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Criar grupo e começar</Text>
          }
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F6F8F5' },
  inner:         { padding: 28, maxWidth: 480, alignSelf: 'center', width: '100%', paddingTop: 40 },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  icon:          { fontSize: 56 },
  title:         { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' },
  subtitle:      { fontSize: 15, color: '#5A625A', marginBottom: 24, lineHeight: 22, textAlign: 'center' },
  infoCard:      { backgroundColor: '#EAF6F5', borderRadius: 16, padding: 18, marginBottom: 28, gap: 8 },
  infoTitle:     { fontSize: 13, fontWeight: '700', color: '#1A9E96', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoItem:      { fontSize: 14, color: '#2D3B2D', lineHeight: 20 },
  label:         { fontSize: 13, fontWeight: '600', color: '#4A534A', marginBottom: 6, marginLeft: 2 },
  input:         { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputError:    { borderColor: '#F0735A' },
  fieldError:    { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  btn:           { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled:   { opacity: 0.6 },
  btnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
