import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { router, Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { signInSchema } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const toast = useToast();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  function clearError(field: string) {
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleEmailSignIn() {
    const result = signInSchema.safeParse({ email, password });
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.show('error', 'Erro ao entrar', error.message);
      hapticError();
      return;
    }
    hapticSuccess();
    router.replace('/(app)');
  }

  async function handleGoogleSignIn() {
    const redirectUrl = makeRedirectUri({ scheme: 'medstock', path: 'auth/callback' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      toast.show('error', 'Erro', error?.message ?? 'Falha ao iniciar OAuth');
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
    if (result.type === 'success') {
      const url = new URL(result.url);
      // Supabase returns tokens in the hash fragment (#access_token=...) on web
      const hashParams = new URLSearchParams(url.hash.slice(1));
      const access_token  = url.searchParams.get('access_token') ?? hashParams.get('access_token');
      const refresh_token = url.searchParams.get('refresh_token') ?? hashParams.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        hapticSuccess();
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
          style={[styles.input, errors['email'] ? styles.inputError : null]}
          value={email}
          onChangeText={v => { setEmail(v); clearError('email'); }}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {Boolean(errors['email']) && <Text style={styles.fieldError}>{errors['email']}</Text>}

        <TextInput
          style={[styles.input, errors['password'] ? styles.inputError : null]}
          value={password}
          onChangeText={v => { setPassword(v); clearError('password'); }}
          placeholder="Senha"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
          autoComplete="password"
        />
        {Boolean(errors['password']) && <Text style={styles.fieldError}>{errors['password']}</Text>}

        <AnimatedPressable
          style={[styles.btn, styles.btnPrimary, loading ? styles.btnDisabled : null]}
          onPress={() => { void handleEmailSignIn(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B3D3B" />
            : <Text style={styles.btnTextDark}>Entrar</Text>
          }
        </AnimatedPressable>

        <AnimatedPressable
          style={[styles.btn, styles.btnOutline]}
          onPress={() => { void handleGoogleSignIn(); }}
        >
          <Text style={styles.btnTextLight}>Entrar com Google</Text>
        </AnimatedPressable>

        <Link href="/(auth)/forgot-password" style={styles.link}>Esqueci minha senha</Link>
        <Text style={styles.row}>
          <Text style={styles.mutedText}>Não tem conta? </Text>
          <Link href="/(auth)/sign-up" style={styles.link}>Cadastrar</Link>
        </Text>
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

  input:        { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' },
  inputError:   { borderColor: '#F0735A' },
  fieldError:   { color: '#F4937F', fontSize: 12, marginBottom: 8, marginLeft: 4 },

  btn:          { borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 10 },
  btnPrimary:   { backgroundColor: '#22C9BF' },
  btnOutline:   { borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)' },
  btnDisabled:  { opacity: 0.6 },
  btnTextDark:  { color: '#0B3D3B', fontWeight: '700', fontSize: 16 },
  btnTextLight: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 16 },

  link:         { color: '#5EDDD5', textAlign: 'center', marginTop: 6, fontSize: 14 },
  row:          { textAlign: 'center', marginTop: 20 },
  mutedText:    { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
