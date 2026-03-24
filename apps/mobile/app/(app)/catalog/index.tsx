import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { cacheMedicationResults, localSearchMedications } from '../../../src/lib/local-db';
import type { MedicationSearchResult } from '@medstock/shared';
import { AnimatedPressable, useTheme, type Theme } from '@medstock/ui';

export default function CatalogSearchScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(() => {
      void search(query.trim());
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  async function search(q: string) {
    setLoading(true);
    const { data, error } = await supabase.rpc('search_medications', {
      query: q,
      result_limit: 20,
    });
    if (!error && data) {
      const hits = data as unknown as MedicationSearchResult[];
      setResults(hits);
      void cacheMedicationResults(hits).catch(() => undefined);
    } else {
      try {
        setResults(await localSearchMedications(q));
      } catch {
        setResults([]);
      }
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Catálogo</Text>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar medicamento, princípio ativo..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {loading && <ActivityIndicator style={s.loader} color={theme.primary} />}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
            <AnimatedPressable
              style={s.item}
              onPress={() => { router.push(`/(app)/catalog/${item.id}`); }}
            >
              <Text style={s.itemName}>{item.product_name}</Text>
              {Boolean(item.active_ingredient) && (
                <Text style={s.itemSub}>{item.active_ingredient}</Text>
              )}
              {Boolean(item.pharma_form_friendly ?? item.pharmaceutical_form ?? item.presentation_dosage ?? item.concentration) && (
                <Text style={s.itemForm}>
                  {[
                    item.pharma_form_friendly ?? item.pharmaceutical_form,
                    item.presentation_dosage ?? item.concentration,
                    item.quantity_volume ?? (item.quantity_count != null ? `${item.quantity_count} unid.` : null),
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
              {Boolean(item.atc_description) && (
                <Text style={s.itemAtc} numberOfLines={1}>{item.atc_description}</Text>
              )}
              <View style={s.itemMeta}>
                {Boolean(item.manufacturer) && (
                  <Text style={s.metaManuf} numberOfLines={1}>{item.manufacturer}</Text>
                )}
                {item.reference_price !== null && (
                  <Text style={s.metaPrice}>
                    R$ {item.reference_price.toFixed(2).replace('.', ',')}
                  </Text>
                )}
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          !loading && query.length >= 2 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhum resultado encontrado.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={results.length === 0 ? s.listEmpty : undefined}
      />
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: t.bg },
    header:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title:      { fontSize: 26, fontWeight: '700', color: t.text, marginBottom: 8 },
    input: {
      borderWidth: 1, borderColor: t.borderSub, borderRadius: 16,
      padding: 12, fontSize: 16, backgroundColor: t.surface, color: t.text,
    },
    loader:     { marginTop: 16 },
    item:       { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: t.surface },
    itemName:   { fontSize: 15, fontWeight: '600', color: t.text },
    itemSub:    { fontSize: 13, color: t.textSub, marginTop: 2 },
    itemForm:   { fontSize: 12, color: t.primary, fontWeight: '500', marginTop: 3 },
    itemAtc:    { fontSize: 11, color: t.textMuted, marginTop: 2 },
    itemMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    metaManuf:  { fontSize: 12, color: t.textMuted, flex: 1 },
    metaPrice:  { fontSize: 12, color: t.primary, fontWeight: '600' },
    separator:  { height: 1, backgroundColor: t.surfaceAlt },
    empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
    emptyText:  { fontSize: 14, color: t.textMuted },
    listEmpty:  { flex: 1 },
  });
}
