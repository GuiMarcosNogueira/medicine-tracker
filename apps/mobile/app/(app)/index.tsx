import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName, refreshInventory } from '../../src/stores/inventory.store';
import type { InventoryRow } from '../../src/stores/inventory.store';
import { treatmentStore, refreshTreatments } from '../../src/stores/treatment.store';
import type { TreatmentRow, TreatmentDoseRow } from '../../src/stores/treatment.store';
import {
  getExpiryStatus,
  daysUntilExpiry,
  formatExpiryDate,
  EXPIRY_COLORS,
} from '../../src/utils/expiry';
import { getTodaySlots } from '../../src/utils/treatment';
import { DoseSlotRow } from '../../src/components/DoseSlotRow';
import { AnimatedPressable } from '@medstock/ui';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatTodayLabel(now: Date): string {
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

export default function TodayScreen() {
  const rawItems       = useSelector(inventoryStore.items);
  const rawTreatments  = useSelector(treatmentStore.treatments);
  const rawTodayDoses  = useSelector(treatmentStore.todayDoses);
  const familyIdInv    = useSelector(inventoryStore.familyId);
  const familyIdTr     = useSelector(treatmentStore.familyId);
  const [refreshing, setRefreshing] = useState(false);

  const items      = rawItems      as InventoryRow[];
  const treatments = rawTreatments as TreatmentRow[];
  const todayDoses = rawTodayDoses as TreatmentDoseRow[];

  // ── Today's dose slots ──────────────────────────────────────────────────────
  const todaySlots = useMemo(() => getTodaySlots(treatments, todayDoses), [treatments, todayDoses]);

  const takenCount   = todaySlots.filter(s => s.logged?.status === 'taken').length;
  const totalCount   = todaySlots.length;
  const pendingCount = todaySlots.filter(s => !s.logged && s.scheduledAt <= new Date()).length;

  // ── Stock alerts (expired + critical only) ──────────────────────────────────
  const alertItems = useMemo(() => {
    return items.filter(item => {
      const s = getExpiryStatus(item.expiry_date);
      return s === 'expired' || s === 'critical';
    });
  }, [items]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    const invPromise = familyIdInv ? refreshInventory(familyIdInv) : Promise.resolve();
    const trPromise  = familyIdTr  ? refreshTreatments(familyIdTr) : Promise.resolve();
    void Promise.all([invPromise, trPromise]).finally(() => { setRefreshing(false); });
  }, [familyIdInv, familyIdTr]);

  const hasAnything = totalCount > 0 || alertItems.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Hoje</Text>
          <Text style={styles.dateLabel}>{formatTodayLabel(new Date())}</Text>
        </View>
        <View style={styles.headerActions}>
          <AnimatedPressable
            style={styles.actionChip}
            onPress={() => { router.push('/(app)/inventory/add'); }}
          >
            <Text style={styles.actionChipText}>+ Med.</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.actionChip, styles.actionChipPrimary]}
            onPress={() => { router.push('/(app)/treatments/add'); }}
          >
            <Text style={styles.actionChipTextPrimary}>+ Tratamento</Text>
          </AnimatedPressable>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
        }
        contentContainerStyle={!hasAnything ? styles.emptyContainer : styles.content}
      >
        {/* ── Estado vazio total ───────────────────────────────────────────── */}
        {!hasAnything && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>Tudo em dia!</Text>
            <Text style={styles.emptyText}>
              Nenhuma dose pendente e nenhum medicamento em alerta.
            </Text>
            <View style={styles.emptyActions}>
              <AnimatedPressable
                style={styles.emptyBtn}
                onPress={() => { router.push('/(app)/treatments/add'); }}
              >
                <Text style={styles.emptyBtnText}>Iniciar tratamento</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.emptyBtn, styles.emptyBtnOutline]}
                onPress={() => { router.push('/(app)/inventory/add'); }}
              >
                <Text style={styles.emptyBtnOutlineText}>Adicionar medicamento</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* ── Seção: Doses de Hoje ─────────────────────────────────────────── */}
        {treatments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>DOSES DE HOJE</Text>
              {totalCount > 0 && (
                <View style={[
                  styles.progressBadge,
                  { backgroundColor: takenCount === totalCount ? '#EEFCFB' : '#FFF8EC' },
                ]}>
                  <Text style={[
                    styles.progressBadgeText,
                    { color: takenCount === totalCount ? '#1A9E96' : '#F5A623' },
                  ]}>
                    {takenCount}/{totalCount}
                  </Text>
                </View>
              )}
            </View>

            {todaySlots.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardEmptyText}>Nenhuma dose agendada para hoje.</Text>
                <Pressable onPress={() => { router.push('/(app)/treatments'); }}>
                  <Text style={styles.cardLink}>Ver tratamentos →</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.card}>
                {todaySlots.map((slot, index) => (
                  <Animated.View
                    key={`${slot.treatment.id}-${slot.scheduledAt.toISOString()}`}
                    entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}
                  >
                    {index > 0 && <View style={styles.separator} />}
                    <DoseSlotRow slot={slot} />
                  </Animated.View>
                ))}
                {pendingCount > 0 && (
                  <View style={styles.pendingHint}>
                    <Text style={styles.pendingHintText}>
                      {pendingCount} dose{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Seção: Alertas de Estoque ────────────────────────────────────── */}
        {alertItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ALERTAS DE ESTOQUE</Text>
              <View style={styles.alertCountBadge}>
                <Text style={styles.alertCountText}>{alertItems.length}</Text>
              </View>
            </View>
            <View style={styles.card}>
              {alertItems.map((item, index) => {
                const days   = daysUntilExpiry(item.expiry_date);
                const status = getExpiryStatus(item.expiry_date);
                const color  = EXPIRY_COLORS[status];
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}
                  >
                    {index > 0 && <View style={styles.separator} />}
                    <AnimatedPressable
                      style={styles.alertItem}
                      onPress={() => { router.push(`/(app)/inventory/${item.id}`); }}
                    >
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <View style={styles.alertItemContent}>
                        <Text style={styles.alertItemName}>{getItemDisplayName(item)}</Text>
                        <Text style={styles.alertItemMeta}>
                          {item.quantity} {item.unit} · Venc. {formatExpiryDate(item.expiry_date)}
                        </Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                        <Text style={[styles.badgeText, { color }]}>
                          {days < 0 ? 'Vencido' : `${days}d`}
                        </Text>
                      </View>
                    </AnimatedPressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:             { flex: 1, backgroundColor: '#F6F8F5' },
  header:                { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title:                 { fontSize: 26, fontWeight: '700', color: '#1A1D1A' },
  dateLabel:             { fontSize: 13, color: '#5A625A', marginTop: 2 },
  headerActions:         { flexDirection: 'row', gap: 6, marginTop: 4 },
  actionChip:            { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D9CC' },
  actionChipText:        { color: '#2E332E', fontWeight: '600', fontSize: 13 },
  actionChipPrimary:     { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  actionChipTextPrimary: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  content:               { paddingBottom: 32 },
  emptyContainer:        { flex: 1 },

  // Sections
  section:               { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle:          { fontSize: 11, fontWeight: '700', color: '#9CA59C', letterSpacing: 0.5 },
  progressBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  progressBadgeText:     { fontSize: 12, fontWeight: '700' },
  alertCountBadge:       { backgroundColor: '#FEE9E4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  alertCountText:        { fontSize: 12, fontWeight: '700', color: '#F0735A' },

  // Cards
  card:                  { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E8ECE5' },
  cardEmptyText:         { padding: 16, fontSize: 14, color: '#9CA59C' },
  cardLink:              { paddingHorizontal: 16, paddingBottom: 14, fontSize: 13, color: '#1A9E96', fontWeight: '600' },
  separator:             { height: 1, backgroundColor: '#E8ECE5', marginHorizontal: 16 },

  pendingHint:           { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#E8ECE5', backgroundColor: '#FFFBF0' },
  pendingHintText:       { fontSize: 12, color: '#F5A623', fontWeight: '600' },

  // Alert items
  alertItem:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  dot:                   { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  alertItemContent:      { flex: 1 },
  alertItemName:         { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  alertItemMeta:         { fontSize: 12, color: '#5A625A', marginTop: 2 },
  badge:                 { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
  badgeText:             { fontSize: 12, fontWeight: '700' },

  // Empty state
  emptyBox:              { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:             { fontSize: 48, color: '#1A9E96', marginBottom: 12 },
  emptyTitle:            { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 8 },
  emptyText:             { fontSize: 14, color: '#5A625A', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyActions:          { gap: 10, width: '100%' },
  emptyBtn:              { backgroundColor: '#1A9E96', borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  emptyBtnText:          { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  emptyBtnOutline:       { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1A9E96' },
  emptyBtnOutlineText:   { color: '#1A9E96', fontWeight: '700', fontSize: 15 },
});
