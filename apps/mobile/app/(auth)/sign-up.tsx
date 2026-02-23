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
  const [fullName, setFullName]             = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading]               = useState(false);
  const [errors, setErrors]                 = useState<Record<string, string>>({});

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

        <TextInput
          style={[styles.input, errors['fullName'] ? styles.inputError : null]}
          value={fullName}
          onChangeText={v => { setFullName(v); clearError('fullName'); }}
          placeholder="Nome completo"
          placeholderTextColor="#9CA59C"
          autoComplete="name"
        />
        {Boolean(errors['fullName']) && <Text style={styles.fieldError}>{errors['fullName']}</Text>}

        <TextInput
          style={[styles.input, errors['email'] ? styles.inputError : null]}
          value={email}
          onChangeText={v => { setEmail(v); clearError('email'); }}
          placeholder="Email"
          placeholderTextColor="#9CA59C"
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
          placeholderTextColor="#9CA59C"
          secureTextEntry
        />
        {Boolean(errors['password']) && <Text style={styles.fieldError}>{errors['password']}</Text>}

        <TextInput
          style={[styles.input, errors['confirmPassword'] ? styles.inputError : null]}
          value={confirmPassword}
          onChangeText={v => { setConfirmPassword(v); clearError('confirmPassword'); }}
          placeholder="Confirmar senha"
          placeholderTextColor="#9CA59C"
          secureTextEntry
        />
        {Boolean(errors['confirmPassword']) && <Text style={styles.fieldError}>{errors['confirmPassword']}</Text>}

        <AnimatedPressable
          style={[styles.btn, loading ? styles.btnDisabled : null]}
          onPress={() => { void handleSignUp(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
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
  container:    { flex: 1, backgroundColor: '#F6F8F5' },
  inner:        { padding: 24, maxWidth: 420, alignSelf: 'center', width: '100%', paddingTop: 48 },
  title:        { fontSize: 28, fontWeight: '700', color: '#1A1D1A', marginBottom: 24, letterSpacing: -0.5 },
  input:        { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputError:   { borderColor: '#F0735A' },
  fieldError:   { color: '#F0735A', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  btn:          { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  link:         { color: '#1A9E96' },
  row:          { textAlign: 'center', marginTop: 20 },
  mutedText:    { color: '#5A625A', fontSize: 14 },
});
