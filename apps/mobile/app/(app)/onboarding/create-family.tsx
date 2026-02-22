import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { familySchema } from '@medstock/shared';

export default function CreateFamilyScreen() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const result = familySchema.safeParse({ name });
    if (!result.success) {
      Alert.alert('Nome inválido', result.error.errors[0]?.message);
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/(auth)/sign-in'); return; }

    // Create family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ name: result.data.name, owner_id: user.id })
      .select()
      .single();

    if (familyError || !family) {
      Alert.alert('Erro', familyError?.message ?? 'Falha ao criar família');
      setLoading(false);
      return;
    }

    // Add owner as family member
    const { error: memberError } = await supabase
      .from('family_members')
      .insert({ family_id: family.id, profile_id: user.id, role: 'owner' });

    setLoading(false);
    if (memberError) {
      Alert.alert('Erro', memberError.message);
      return;
    }

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
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Família Silva"
          maxLength={100}
        />
        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleCreate(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Criar família</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F5' },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#5A625A', marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16,
    padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A',
  },
  btn: { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
