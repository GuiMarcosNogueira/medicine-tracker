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
        <View style={styles.logoWrap}>
          <View style={styles.logoBg}>
            <View style={styles.crossV} />
            <View style={styles.crossH} />
          </View>
        </View>

        <Text style={styles.title}>MedStock</Text>
        <Text style={styles.subtitle}>Gestão de medicamentos da família</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Senha"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
          autoComplete="password"
        />

        <Pressable
          style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
          onPress={() => { void handleEmailSignIn(); }}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#0B3D3B" /> : <Text style={styles.btnTextDark}>Entrar</Text>}
        </Pressable>

        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => { void handleGoogleSignIn(); }}>
          <Text style={styles.btnTextLight}>Entrar com Google</Text>
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
  container:    { flex: 1, backgroundColor: '#0B3D3B' },
  inner:        { flex: 1, padding: 28, justifyContent: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },

  logoWrap:     { alignItems: 'center', marginBottom: 24 },
  logoBg:       { width: 64, height: 64, borderRadius: 16, backgroundColor: '#22C9BF', alignItems: 'center', justifyContent: 'center' },
  crossV:       { position: 'absolute', width: 10, height: 32, borderRadius: 3, backgroundColor: '#0B3D3B' },
  crossH:       { position: 'absolute', width: 32, height: 10, borderRadius: 3, backgroundColor: '#0B3D3B' },

  title:        { fontSize: 36, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:     { fontSize: 14, color: '#A0EDE8', textAlign: 'center', marginBottom: 36, fontWeight: '300' },

  input:        { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, marginBottom: 12, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' },

  btn:          { borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimary:   { backgroundColor: '#22C9BF' },
  btnOutline:   { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  btnDisabled:  { opacity: 0.6 },
  btnTextDark:  { color: '#0B3D3B', fontWeight: '700', fontSize: 16 },
  btnTextLight: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 16 },

  link:         { color: '#5EDDD5', textAlign: 'center', marginTop: 6, fontSize: 14 },
  row:          { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  mutedText:    { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
