import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName, refreshInventory } from '../../src/stores/inventory.store';
import type { InventoryRow } from '../../src/stores/inventory.store';
import {
  getExpiryStatus,
  daysUntilExpiry,
  formatExpiryDate,
  EXPIRY_COLORS,
  EXPIRY_LABELS,
} from '../../src/utils/expiry';
import type { ExpiryStatus } from '@medstock/shared';
import { AnimatedPressable, DashboardSkeleton } from '@medstock/ui';

type Section = { key: ExpiryStatus; title: string; data: InventoryRow[] };

const STATUS_ORDER: ExpiryStatus[] = ['expired', 'critical', 'warning', 'soon'];

export default function DashboardScreen() {
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];
  const loading = useSelector(inventoryStore.loading);
  const familyId = useSelector(inventoryStore.familyId);
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const groups: Record<ExpiryStatus, InventoryRow[]> = {
      expired: [], critical: [], warning: [], soon: [], ok: [],
    };
    for (const item of items) {
      const status = getExpiryStatus(item.expiry_date);
      groups[status].push(item);
    }
    return STATUS_ORDER
      .map(key => ({ key, title: EXPIRY_LABELS[key], data: groups[key] ?? [] }))
      .filter(s => s.data.length > 0);
  }, [items]);

  const handleRefresh = useCallback(() => {
    if (!familyId) return;
    setRefreshing(true);
    void refreshInventory(familyId).finally(() => { setRefreshing(false); });
  }, [familyId]);

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>MedStock</Text>
        </View>
        <DashboardSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MedStock</Text>
        <View style={styles.headerActions}>
          <AnimatedPressable style={styles.scanBtn} onPress={() => { router.push('/(app)/scanner/ocr'); }}>
            <Text style={styles.scanBtnText}>Escanear</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.addBtn} onPress={() => { router.push('/(app)/inventory/add'); }}>
            <Text style={styles.addBtnText}>+ Adicionar</Text>
          </AnimatedPressable>
        </View>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Estoque vazio</Text>
          <Text style={styles.emptyText}>
            Adicione medicamentos para monitorar o vencimento.
          </Text>
          <AnimatedPressable style={styles.emptyBtn} onPress={() => { router.push('/(app)/inventory/add'); }}>
            <Text style={styles.emptyBtnText}>Adicionar medicamento</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { borderLeftColor: EXPIRY_COLORS[section.key] }]}>
              <Text style={[styles.sectionTitle, { color: EXPIRY_COLORS[section.key] }]}>
                {section.title}
              </Text>
              <Text style={styles.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const days = daysUntilExpiry(item.expiry_date);
            const status = getExpiryStatus(item.expiry_date);
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()}>
                <AnimatedPressable
                  style={styles.item}
                  onPress={() => { router.push(`/(app)/inventory/${item.id}`); }}
                >
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{getItemDisplayName(item)}</Text>
                    <Text style={styles.itemMeta}>
                      {item.quantity} {item.unit} · Venc. {formatExpiryDate(item.expiry_date)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: EXPIRY_COLORS[status] + '20' }]}>
                    <Text style={[styles.badgeText, { color: EXPIRY_COLORS[status] }]}>
                      {days < 0 ? 'Vencido' : `${days}d`}
                    </Text>
                  </View>
                </AnimatedPressable>
              </Animated.View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F6F8F5' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerActions:{ flexDirection: 'row', gap: 8 },
  scanBtn:      { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: '#D1D9CC' },
  scanBtnText:  { color: '#2E332E', fontWeight: '600', fontSize: 14 },
  title:        { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  addBtn:       { backgroundColor: '#1A9E96', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:   { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  list:         { paddingBottom: 20 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#E8ECE5', borderLeftWidth: 3, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700' },
  sectionCount: { fontSize: 13, color: '#5A625A', fontWeight: '600' },
  item:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  itemLeft:     { flex: 1 },
  itemName:     { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  itemMeta:     { fontSize: 12, color: '#5A625A', marginTop: 2 },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  badgeText:    { fontSize: 12, fontWeight: '700' },
  separator:    { height: 1, backgroundColor: '#E8ECE5' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:   { fontSize: 20, fontWeight: '700', color: '#1A1D1A', marginBottom: 8 },
  emptyText:    { fontSize: 14, color: '#5A625A', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  emptyBtn:     { backgroundColor: '#1A9E96', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
