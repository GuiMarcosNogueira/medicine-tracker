import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
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
      <View style={styles.inner}>
        <Text style={styles.title}>Criar família</Text>
        <Text style={styles.subtitle}>
          Dê um nome para o grupo familiar que irá compartilhar o estoque.
        </Text>
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Criar família</Text>}
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F6F8F5' },
  inner:      { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },
  title:      { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, letterSpacing: -0.5 },
  subtitle:   { fontSize: 14, color: '#5A625A', marginBottom: 24, lineHeight: 20 },
  input:      { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputError: { borderColor: '#F0735A' },
  fieldError: { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  btn:        { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center' },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
