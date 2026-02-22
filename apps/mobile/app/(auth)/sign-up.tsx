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
          placeholder="Nome completo" placeholderTextColor="#9CA59C" autoComplete="name" />
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="Email" placeholderTextColor="#9CA59C" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Senha (mín. 8 caracteres)" placeholderTextColor="#9CA59C" secureTextEntry />
        <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
          placeholder="Confirmar senha" placeholderTextColor="#9CA59C" secureTextEntry />

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => { void handleSignUp(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.btnText}>Cadastrar</Text>}
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
  container: { flex: 1, backgroundColor: '#F6F8F5' },
  inner:     { padding: 24, maxWidth: 420, alignSelf: 'center', width: '100%', paddingTop: 48 },
  title:     { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 24, letterSpacing: -0.5 },
  input:     { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  btn:       { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  link:      { color: '#1A9E96' },
  row:       { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  mutedText: { color: '#5A625A', fontSize: 14 },
});
