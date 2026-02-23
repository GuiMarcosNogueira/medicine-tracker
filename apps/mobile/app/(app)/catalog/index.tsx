import { useState, useEffect, useRef } from 'react';
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
import { AnimatedPressable } from '@medstock/ui';

export default function CatalogSearchScreen() {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Catálogo</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar medicamento, princípio ativo..."
          placeholderTextColor="#9CA59C"
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#1A9E96" />}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
            <AnimatedPressable
              style={styles.item}
              onPress={() => { router.push(`/(app)/catalog/${item.id}`); }}
            >
              <Text style={styles.itemName}>{item.product_name}</Text>
              {Boolean(item.active_ingredient) && (
                <Text style={styles.itemSub}>{item.active_ingredient}</Text>
              )}
              {Boolean(item.pharma_form_friendly ?? item.pharmaceutical_form ?? item.presentation_dosage ?? item.concentration) && (
                <Text style={styles.itemForm}>
                  {[
                    item.pharma_form_friendly ?? item.pharmaceutical_form,
                    item.presentation_dosage ?? item.concentration,
                    item.quantity_volume ?? (item.quantity_count != null ? `${item.quantity_count} unid.` : null),
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
              {Boolean(item.atc_description) && (
                <Text style={styles.itemAtc} numberOfLines={1}>{item.atc_description}</Text>
              )}
              <View style={styles.itemMeta}>
                {Boolean(item.manufacturer) && (
                  <Text style={styles.metaManuf} numberOfLines={1}>{item.manufacturer}</Text>
                )}
                {item.reference_price !== null && (
                  <Text style={styles.metaPrice}>
                    R$ {item.reference_price.toFixed(2).replace('.', ',')}
                  </Text>
                )}
              </View>
            </AnimatedPressable>
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading && query.length >= 2 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum resultado encontrado.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={results.length === 0 ? styles.listEmpty : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F6F8F5' },
  header:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title:      { fontSize: 26, fontWeight: '700', color: '#1A1D1A', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16,
    padding: 12, fontSize: 16, backgroundColor: '#FFFFFF', color: '#1A1D1A',
  },
  loader:     { marginTop: 16 },
  item:       { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  itemName:   { fontSize: 15, fontWeight: '600', color: '#1A1D1A' },
  itemSub:    { fontSize: 13, color: '#5A625A', marginTop: 2 },
  itemForm:   { fontSize: 12, color: '#1A9E96', fontWeight: '500', marginTop: 3 },
  itemAtc:    { fontSize: 11, color: '#9CA59C', marginTop: 2 },
  itemMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaManuf:  { fontSize: 12, color: '#9CA59C', flex: 1 },
  metaPrice:  { fontSize: 12, color: '#1A9E96', fontWeight: '600' },
  separator:  { height: 1, backgroundColor: '#E8ECE5' },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyText:  { fontSize: 14, color: '#9CA59C' },
  listEmpty:  { flex: 1 },
});
