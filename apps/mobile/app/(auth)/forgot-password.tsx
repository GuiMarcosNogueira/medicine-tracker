import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { forgotPasswordSchema } from '@medstock/shared';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      Alert.alert('Email inválido', result.error.errors[0]?.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'medstock://auth/reset-password',
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    Alert.alert(
      'Email enviado',
      'Verifique sua caixa de entrada para redefinir a senha.',
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Recuperar senha</Text>
        <Text style={styles.subtitle}>Enviaremos um link para redefinir sua senha.</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleReset(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enviar link</Text>}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 400, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#fff',
  },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  backBtn: { alignItems: 'center', marginTop: 16 },
  backText: { color: '#64748b', fontSize: 14 },
});
