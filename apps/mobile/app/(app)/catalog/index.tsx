import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import type { MedicationSearchResult } from '@medstock/shared';

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
    setLoading(false);
    if (!error && data) {
      setResults(data as unknown as MedicationSearchResult[]);
    }
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
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#2563eb" />}

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => router.push(`/(app)/catalog/${item.id}`)}
          >
            <Text style={styles.itemName}>{item.product_name}</Text>
            {Boolean(item.active_ingredient) && (
              <Text style={styles.itemSub}>{item.active_ingredient}</Text>
            )}
            <View style={styles.itemMeta}>
              {Boolean(item.manufacturer) && (
                <Text style={styles.metaManuf}>{item.manufacturer}</Text>
              )}
              {item.reference_price !== null && (
                <Text style={styles.metaPrice}>
                  R$ {item.reference_price.toFixed(2).replace('.', ',')}
                </Text>
              )}
            </View>
          </Pressable>
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
  container:  { flex: 1, backgroundColor: '#f8fafc' },
  header:     { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title:      { fontSize: 26, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    padding: 12, fontSize: 16, backgroundColor: '#fff',
  },
  loader:     { marginTop: 16 },
  item:       { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  itemName:   { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  itemSub:    { fontSize: 13, color: '#475569', marginTop: 2 },
  itemMeta:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  metaManuf:  { fontSize: 12, color: '#94a3b8', flex: 1 },
  metaPrice:  { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  separator:  { height: 1, backgroundColor: '#f1f5f9' },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48 },
  emptyText:  { fontSize: 14, color: '#94a3b8' },
  listEmpty:  { flex: 1 },
});
