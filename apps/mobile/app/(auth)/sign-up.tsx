import { useState } from 'react';
import { Text, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Link } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { signUpSchema } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

export default function SignUpScreen() {
  const toast = useToast();
  const [fullName, setFullName]               = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]                 = useState(false);
  const [errors, setErrors]                   = useState<Record<string, string>>({});

  function clearError(field: string) {
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSignUp() {
    const result = signUpSchema.safeParse({ fullName, email, password, confirmPassword });
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      toast.show('error', 'Erro ao cadastrar', error.message);
      hapticError();
      return;
    }
    hapticSuccess();
    toast.show('success', 'Cadastro realizado!', 'Verifique seu email para confirmar a conta.');
    router.replace('/(auth)/sign-in');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Junte-se ao MedStock e gerencie seus medicamentos.</Text>

        <TextInput
          style={[styles.input, errors['fullName'] ? styles.inputError : null]}
          value={fullName}
          onChangeText={v => { setFullName(v); clearError('fullName'); }}
          placeholder="Nome completo"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoComplete="name"
        />
        {Boolean(errors['fullName']) && <Text style={styles.fieldError}>{errors['fullName']}</Text>}

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
          placeholder="Senha (mín. 8 caracteres)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
        />
        {Boolean(errors['password']) && <Text style={styles.fieldError}>{errors['password']}</Text>}

        <TextInput
          style={[styles.input, errors['confirmPassword'] ? styles.inputError : null]}
          value={confirmPassword}
          onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
          placeholder="Confirmar senha"
          placeholderTextColor="rgba(255,255,255,0.35)"
          secureTextEntry
        />
        {Boolean(errors['confirmPassword']) && <Text style={styles.fieldError}>{errors['confirmPassword']}</Text>}

        <AnimatedPressable
          style={[styles.btn, loading ? styles.btnDisabled : null]}
          onPress={() => { void handleSignUp(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B3D3B" />
            : <Text style={styles.btnText}>Cadastrar</Text>
          }
        </AnimatedPressable>

        <Text style={styles.row}>
          <Text style={styles.mutedText}>Já tem conta? </Text>
          <Link href="/(auth)/sign-in" style={styles.link}>Entrar</Link>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0B3D3B' },
  inner:       { padding: 28, maxWidth: 420, alignSelf: 'center', width: '100%', paddingTop: 52 },
  title:       { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:    { fontSize: 14, color: '#A0EDE8', marginBottom: 32, fontWeight: '300' },
  input:       { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' },
  inputError:  { borderColor: '#F4937F' },
  fieldError:  { color: '#F4937F', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  btn:         { backgroundColor: '#22C9BF', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8, marginBottom: 10 },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: '#0B3D3B', fontWeight: '700', fontSize: 16 },
  link:        { color: '#5EDDD5' },
  row:         { textAlign: 'center', marginTop: 8 },
  mutedText:   { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
});
