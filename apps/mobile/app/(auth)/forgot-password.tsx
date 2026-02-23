import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { forgotPasswordSchema } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../src/lib/haptics';

export default function ForgotPasswordScreen() {
  const toast = useToast();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  async function handleReset() {
    const result = forgotPasswordSchema.safeParse({ email });
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'medstock://auth/reset-password',
    });
    setLoading(false);
    if (error) {
      toast.show('error', 'Erro', error.message);
      hapticError();
      return;
    }
    hapticSuccess();
    toast.show('success', 'Email enviado', 'Verifique sua caixa de entrada.');
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.title}>Recuperar senha</Text>
        <Text style={styles.subtitle}>Enviaremos um link para redefinir sua senha.</Text>

        <TextInput
          style={[styles.input, errors['email'] ? styles.inputError : null]}
          value={email}
          onChangeText={v => { setEmail(v); if (errors['email']) setErrors({}); }}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.35)"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {Boolean(errors['email']) && <Text style={styles.fieldError}>{errors['email']}</Text>}

        <AnimatedPressable
          style={[styles.btn, loading ? styles.btnDisabled : null]}
          onPress={() => { void handleReset(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B3D3B" />
            : <Text style={styles.btnText}>Enviar link</Text>
          }
        </AnimatedPressable>

        <AnimatedPressable onPress={() => { router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>Voltar</Text>
        </AnimatedPressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#0B3D3B' },
  inner:      { flex: 1, padding: 28, justifyContent: 'center', maxWidth: 420, alignSelf: 'center', width: '100%' },
  title:      { fontSize: 32, fontWeight: '700', color: '#FFFFFF', marginBottom: 6, letterSpacing: -0.5 },
  subtitle:   { fontSize: 14, color: '#A0EDE8', marginBottom: 32, fontWeight: '300' },
  input:      { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, marginBottom: 4, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' },
  inputError: { borderColor: '#F4937F' },
  fieldError: { color: '#F4937F', fontSize: 12, marginBottom: 8, marginLeft: 4 },
  btn:        { backgroundColor: '#22C9BF', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 4, marginBottom: 4 },
  btnDisabled:{ opacity: 0.6 },
  btnText:    { color: '#0B3D3B', fontWeight: '700', fontSize: 16 },
  backBtn:    { alignItems: 'center', marginTop: 16 },
  backText:   { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
});
