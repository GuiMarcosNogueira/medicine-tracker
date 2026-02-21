import { useState, useMemo } from 'react';
import type { InventoryRow } from '../../../src/stores/inventory.store';
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
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName } from '../../../src/stores/inventory.store';
import { getExpiryStatus, formatExpiryDate, EXPIRY_COLORS } from '../../../src/utils/expiry';

export default function InventoryListScreen() {
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];
  const loading = useSelector(inventoryStore.loading);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item => {
      const name = getItemDisplayName(item).toLowerCase();
      const sub = (item.medications?.active_ingredient ?? '').toLowerCase();
      return name.includes(q) || sub.includes(q);
    });
  }, [items, search]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Estoque</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/(app)/inventory/add')}>
          <Text style={styles.addBtnText}>+ Adicionar</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome..."
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {loading && items.length === 0 && (
        <ActivityIndicator style={styles.loader} color="#2563eb" />
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const status = getExpiryStatus(item.expiry_date);
          return (
            <Pressable
              style={styles.item}
              onPress={() => router.push(`/(app)/inventory/${item.id}`)}
            >
              <View style={[styles.dot, { backgroundColor: EXPIRY_COLORS[status] }]} />
              <View style={styles.itemContent}>
                <Text style={styles.itemName}>{getItemDisplayName(item)}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} {item.unit} · Venc. {formatExpiryDate(item.expiry_date)}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {search ? 'Nenhum item encontrado.' : 'Estoque vazio.'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={filtered.length === 0 ? styles.listEmpty : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f8fafc' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title:       { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  addBtn:      { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:  { color: '#fff', fontWeight: '600', fontSize: 14 },
  search:      { margin: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, fontSize: 15, backgroundColor: '#fff' },
  loader:      { marginTop: 20 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  dot:         { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  itemContent: { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemMeta:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  separator:   { height: 1, backgroundColor: '#f1f5f9' },
  empty:       { padding: 32, alignItems: 'center' },
  emptyText:   { color: '#94a3b8', fontSize: 14 },
  listEmpty:   { flex: 1 },
});
