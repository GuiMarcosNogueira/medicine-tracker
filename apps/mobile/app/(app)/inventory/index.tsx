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
        <ActivityIndicator style={styles.loader} color="#1A9E96" />
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
  container:   { flex: 1, backgroundColor: '#F6F8F5' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title:       { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  addBtn:      { backgroundColor: '#1A9E96', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  search:      { margin: 12, borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  loader:      { marginTop: 20 },
  item:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  dot:         { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  itemContent: { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  itemMeta:    { fontSize: 12, color: '#5A625A', marginTop: 2 },
  separator:   { height: 1, backgroundColor: '#E8ECE5' },
  empty:       { padding: 32, alignItems: 'center' },
  emptyText:   { color: '#9CA59C', fontSize: 14 },
  listEmpty:   { flex: 1 },
});
