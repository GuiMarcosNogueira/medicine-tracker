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
          placeholderTextColor="#9CA59C"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleReset(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Enviar link</Text>}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F5' },
  inner:     { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },
  title:     { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 8, letterSpacing: -0.5 },
  subtitle:  { fontSize: 14, color: '#5A625A', marginBottom: 24, lineHeight: 20 },
  input:     { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  btn:       { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  backBtn:   { alignItems: 'center', marginTop: 16 },
  backText:  { color: '#5A625A', fontSize: 14 },
});
