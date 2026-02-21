import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { router, Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { signInSchema } from '@medstock/shared';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn() {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      Alert.alert('Dados inválidos', result.error.errors[0]?.message ?? 'Verifique os campos');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { Alert.alert('Erro ao entrar', error.message); return; }
    router.replace('/(app)');
  }

  async function handleGoogleSignIn() {
    const redirectUrl = makeRedirectUri({ scheme: 'medstock', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) { Alert.alert('Erro', error?.message ?? 'Falha ao iniciar OAuth'); return; }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const url = new URL(result.url);
      const access_token = url.searchParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        router.replace('/(app)');
      }
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>MedStock</Text>
        <Text style={styles.subtitle}>Gestão de medicamentos da família</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail}
          placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="Senha" secureTextEntry autoComplete="password" />
        <Pressable style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={() => { void handleEmailSignIn(); }} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextLight}>Entrar</Text>}
        </Pressable>
        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => { void handleGoogleSignIn(); }}>
          <Text style={styles.btnTextDark}>Entrar com Google</Text>
        </Pressable>
        <Link href="/(auth)/forgot-password" style={styles.link}>Esqueci minha senha</Link>
        <View style={styles.row}>
          <Text style={styles.mutedText}>Não tem conta? </Text>
          <Link href="/(auth)/sign-up" style={styles.link}>Cadastrar</Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  inner: { flex: 1, padding: 24, justifyContent: 'center', maxWidth: 400, alignSelf: 'center', width: '100%' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 32 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: '#fff' },
  btn: { borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  btnPrimary: { backgroundColor: '#2563eb' },
  btnOutline: { borderWidth: 1, borderColor: '#2563eb' },
  btnDisabled: { opacity: 0.6 },
  btnTextLight: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnTextDark: { color: '#2563eb', fontWeight: '600', fontSize: 16 },
  link: { color: '#2563eb', textAlign: 'center', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
  mutedText: { color: '#64748b', fontSize: 14 },
});
