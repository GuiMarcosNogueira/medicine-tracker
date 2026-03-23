import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, type Theme } from '@medstock/ui';

export default function NotFoundScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  return (
    <SafeAreaView style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>Página não encontrada</Text>
        <Link href="/" style={s.link}>
          Voltar ao início
        </Link>
      </View>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    content:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    title:     { fontSize: 20, fontWeight: 'bold', color: t.text, marginBottom: 16 },
    link:      { color: t.primary, fontSize: 16 },
  });
}
