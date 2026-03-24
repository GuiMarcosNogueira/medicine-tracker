import { useState, useMemo, useCallback, useRef } from 'react';
import type { InventoryRow } from '../../../src/stores/inventory.store';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName, softDeleteItem, refreshInventory } from '../../../src/stores/inventory.store';
import { getExpiryStatus, formatExpiryDate, EXPIRY_COLORS } from '../../../src/utils/expiry';
import { AnimatedPressable, InventoryListSkeleton, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function InventoryItem({ item, onDelete, theme, s }: { item: InventoryRow; onDelete: (id: string) => void; theme: Theme; s: ReturnType<typeof styles> }) {
  const swipeRef = useRef<Swipeable>(null);
  const status = getExpiryStatus(item.expiry_date);

  const descParts = [
    item.manufacturer,
    item.pharma_form_friendly ?? item.pharmaceutical_form,
    item.presentation_dosage,
    item.active_ingredient,
  ].filter(Boolean);

  const indications = item.indications ?? [];
  const visibleTags = indications.slice(0, 3);
  const extraCount = indications.length - visibleTags.length;

  const row = (
    <Pressable
      style={s.item}
      onPress={() => { router.push(`/(app)/inventory/${item.id}`); }}
    >
      <View style={[s.dot, { backgroundColor: EXPIRY_COLORS[status] }]} />
      <View style={s.itemContent}>
        <Text style={s.itemName}>{getItemDisplayName(item)}</Text>
        {descParts.length > 0 && (
          <Text style={s.itemDesc} numberOfLines={1}>{descParts.join(' · ')}</Text>
        )}
        <Text style={s.itemMeta}>
          {item.quantity} {item.unit} · Venc. {formatExpiryDate(item.expiry_date)}
        </Text>
        {visibleTags.length > 0 && (
          <View style={s.tagRow}>
            {visibleTags.map(tag => (
              <View key={tag} style={s.tag}>
                <Text style={s.tagText}>{tag}</Text>
              </View>
            ))}
            {extraCount > 0 && (
              <View style={s.tag}>
                <Text style={s.tagText}>+{extraCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );

  // On web, Swipeable gesture handlers are registered at the root and intercept
  // pointer events globally — breaking buttons on other tabs/screens.
  // Use a plain visible delete button instead.
  if (Platform.OS === 'web') {
    return (
      <View style={s.webRow}>
        {row}
        <Pressable style={s.webDeleteBtn} onPress={() => { onDelete(item.id); }}>
          <Text style={s.webDeleteText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <Pressable
          style={s.deleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete(item.id); }}
        >
          <Text style={s.deleteActionText}>Remover</Text>
        </Pressable>
      )}
      overshootRight={false}
    >
      {row}
    </Swipeable>
  );
}

export default function InventoryListScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const toast = useToast();
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];
  const loading = useSelector(inventoryStore.loading);
  const familyId = useSelector(inventoryStore.familyId);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = normalize(search);
    return items.filter(item => {
      const name = normalize(getItemDisplayName(item));
      const sub  = normalize(item.active_ingredient ?? '');
      const tags = (item.indications ?? []).some(ind => normalize(ind).includes(q));
      return name.includes(q) || sub.includes(q) || tags;
    });
  }, [items, search]);

  const handleRefresh = useCallback(() => {
    if (!familyId) return;
    setRefreshing(true);
    void refreshInventory(familyId).finally(() => { setRefreshing(false); });
  }, [familyId]);

  async function handleDelete(id: string) {
    hapticMedium();
    const err = await softDeleteItem(id);
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Removido', 'Item removido do estoque.');
    }
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Estoque</Text>
        <AnimatedPressable style={s.addBtn} onPress={() => { router.push('/(app)/inventory/add'); }}>
          <Text style={s.addBtnText}>+ Adicionar</Text>
        </AnimatedPressable>
      </View>

      <TextInput
        style={s.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar por nome, sintoma..."
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {loading && items.length === 0 && <InventoryListSkeleton />}

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
            <InventoryItem item={item} onDelete={id => { void handleDelete(id); }} theme={theme} s={s} />
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={s.separator} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>
                {search ? 'Nenhum item encontrado.' : 'Estoque vazio.'}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={filtered.length === 0 ? s.listEmpty : undefined}
      />
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: t.bg },
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
    title:            { fontSize: 22, fontWeight: '700', color: t.text, fontFamily: fonts.heading },
    addBtn:           { backgroundColor: t.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    search:           { margin: 12, borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, fontSize: 15, backgroundColor: t.surface, color: t.text },
    item:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: t.surface },
    dot:              { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    itemContent:      { flex: 1 },
    itemName:         { fontSize: 14, fontWeight: '600', color: t.text },
    itemDesc:         { fontSize: 11, color: t.primary, marginTop: 2 },
    itemMeta:         { fontSize: 12, color: t.textSub, marginTop: 2 },
    deleteAction:     { width: 80, backgroundColor: t.coral, alignItems: 'center', justifyContent: 'center' },
    deleteActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    webRow:           { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface },
    webDeleteBtn:     { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
    webDeleteText:    { color: t.coral, fontWeight: '700', fontSize: 16 },
    separator:        { height: 1, backgroundColor: t.surfaceAlt },
    empty:            { padding: 32, alignItems: 'center' },
    emptyText:        { color: t.textMuted, fontSize: 14 },
    listEmpty:        { flex: 1 },
    tagRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
    tag:              { backgroundColor: t.primaryBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
    tagText:          { fontSize: 10, color: t.primary, fontWeight: '600' },
  });
}
