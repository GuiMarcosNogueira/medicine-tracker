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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 400, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#fff',
  },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
