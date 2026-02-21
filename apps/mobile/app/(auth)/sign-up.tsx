import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { signUpSchema } from '@medstock/shared';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    const result = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
    if (!result.success) {
      Alert.alert('Dados inválidos', result.error.errors[0]?.message ?? 'Verifique os campos');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Erro ao cadastrar', error.message);
      return;
    }
    Alert.alert(
      'Cadastro realizado!',
      'Verifique seu email para confirmar a conta.',
      [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Criar conta</Text>

        <TextInput style={styles.input} value={fullName} onChangeText={setFullName}
          placeholder="Nome completo" autoComplete="name" />
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Senha (mín. 8 caracteres)" secureTextEntry />
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
          placeholder="Confirmar senha" secureTextEntry />

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleSignUp(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Cadastrar</Text>}
        </Pressable>

        <View style={styles.row}>
          <Text style={styles.mutedText}>Já tem conta? </Text>
          <Link href="/(auth)/sign-in" style={styles.link}>Entrar</Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { padding: 24, maxWidth: 400, alignSelf: 'center', width: '100%', paddingTop: 48 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#fff',
  },
  btn: { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: '#2563eb' },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  mutedText: { color: '#64748b', fontSize: 14 },
});
