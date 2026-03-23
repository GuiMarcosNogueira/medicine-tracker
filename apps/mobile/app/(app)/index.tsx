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
import { AnimatedPressable, useTheme, fonts, type Theme } from '@medstock/ui';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatTodayLabel(now: Date): string {
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

export default function TodayScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

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

  const takenCount   = todaySlots.filter(sl => sl.logged?.status === 'taken').length;
  const totalCount   = todaySlots.length;
  const pendingCount = todaySlots.filter(sl => !sl.logged && sl.scheduledAt <= new Date()).length;

  // ── Stock alerts (expired + critical only) ──────────────────────────────────
  const alertItems = useMemo(() => {
    return items.filter(item => {
      const st = getExpiryStatus(item.expiry_date);
      return st === 'expired' || st === 'critical';
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
    <SafeAreaView style={s.container}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Hoje</Text>
          <Text style={s.dateLabel}>{formatTodayLabel(new Date())}</Text>
        </View>
        <View style={s.headerActions}>
          <AnimatedPressable
            style={s.actionChip}
            onPress={() => { router.push('/(app)/inventory/add'); }}
          >
            <Text style={s.actionChipText}>+ Med.</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[s.actionChip, s.actionChipPrimary]}
            onPress={() => { router.push('/(app)/treatments/add'); }}
          >
            <Text style={s.actionChipTextPrimary}>+ Tratamento</Text>
          </AnimatedPressable>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={!hasAnything ? s.emptyContainer : s.content}
      >
        {/* ── Estado vazio total ───────────────────────────────────────────── */}
        {!hasAnything && (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>✓</Text>
            <Text style={s.emptyTitle}>Tudo em dia!</Text>
            <Text style={s.emptyText}>
              Nenhuma dose pendente e nenhum medicamento em alerta.
            </Text>
            <View style={s.emptyActions}>
              <AnimatedPressable
                style={s.emptyBtn}
                onPress={() => { router.push('/(app)/treatments/add'); }}
              >
                <Text style={s.emptyBtnText}>Iniciar tratamento</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[s.emptyBtn, s.emptyBtnOutline]}
                onPress={() => { router.push('/(app)/inventory/add'); }}
              >
                <Text style={s.emptyBtnOutlineText}>Adicionar medicamento</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* ── Seção: Doses de Hoje ─────────────────────────────────────────── */}
        {treatments.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>DOSES DE HOJE</Text>
              {totalCount > 0 && (
                <View style={[
                  s.progressBadge,
                  { backgroundColor: takenCount === totalCount ? theme.primaryLight : theme.amberBg },
                ]}>
                  <Text style={[
                    s.progressBadgeText,
                    { color: takenCount === totalCount ? theme.primary : theme.amber },
                  ]}>
                    {takenCount}/{totalCount}
                  </Text>
                </View>
              )}
            </View>

            {todaySlots.length === 0 ? (
              <View style={s.card}>
                <Text style={s.cardEmptyText}>Nenhuma dose agendada para hoje.</Text>
                <Pressable onPress={() => { router.push('/(app)/treatments'); }}>
                  <Text style={s.cardLink}>Ver tratamentos →</Text>
                </Pressable>
              </View>
            ) : (
              <View style={s.card}>
                {todaySlots.map((slot, index) => (
                  <Animated.View
                    key={`${slot.treatment.id}-${slot.scheduledAt.toISOString()}`}
                    entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}
                  >
                    {index > 0 && <View style={s.separator} />}
                    <DoseSlotRow slot={slot} />
                  </Animated.View>
                ))}
                {pendingCount > 0 && (
                  <View style={s.pendingHint}>
                    <Text style={s.pendingHintText}>
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
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>ALERTAS DE ESTOQUE</Text>
              <View style={s.alertCountBadge}>
                <Text style={s.alertCountText}>{alertItems.length}</Text>
              </View>
            </View>
            <View style={s.card}>
              {alertItems.map((item, index) => {
                const days   = daysUntilExpiry(item.expiry_date);
                const status = getExpiryStatus(item.expiry_date);
                const color  = EXPIRY_COLORS[status];
                return (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}
                  >
                    {index > 0 && <View style={s.separator} />}
                    <AnimatedPressable
                      style={s.alertItem}
                      onPress={() => { router.push(`/(app)/inventory/${item.id}`); }}
                    >
                      <View style={[s.dot, { backgroundColor: color }]} />
                      <View style={s.alertItemContent}>
                        <Text style={s.alertItemName}>{getItemDisplayName(item)}</Text>
                        <Text style={s.alertItemMeta}>
                          {item.quantity} {item.unit} · Venc. {formatExpiryDate(item.expiry_date)}
                        </Text>
                        {Boolean(item.notes) && (
                          <Text style={s.alertItemNotes} numberOfLines={1}>{item.notes}</Text>
                        )}
                      </View>
                      <View style={[s.badge, { backgroundColor: color + '20' }]}>
                        <Text style={[s.badgeText, { color }]}>
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

function styles(t: Theme) {
  return StyleSheet.create({
    container:             { flex: 1, backgroundColor: t.bg },
    header:                { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title:                 { fontSize: 26, fontWeight: '700', color: t.text, fontFamily: fonts.heading },
    dateLabel:             { fontSize: 13, color: t.textSub, marginTop: 2 },
    headerActions:         { flexDirection: 'row', gap: 6, marginTop: 4 },
    actionChip:            { backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: t.borderSub },
    actionChipText:        { color: t.text, fontWeight: '600', fontSize: 13 },
    actionChipPrimary:     { backgroundColor: t.primary, borderColor: t.primary },
    actionChipTextPrimary: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

    content:               { paddingBottom: 32 },
    emptyContainer:        { flex: 1 },

    // Sections
    section:               { marginTop: 16, paddingHorizontal: 16 },
    sectionHeader:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    sectionTitle:          { fontSize: 11, fontWeight: '700', color: t.textMuted, letterSpacing: 0.5 },
    progressBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    progressBadgeText:     { fontSize: 12, fontWeight: '700' },
    alertCountBadge:       { backgroundColor: t.coralBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    alertCountText:        { fontSize: 12, fontWeight: '700', color: t.coral },

    // Cards
    card:                  { backgroundColor: t.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: t.surfaceAlt },
    cardEmptyText:         { padding: 16, fontSize: 14, color: t.textMuted },
    cardLink:              { paddingHorizontal: 16, paddingBottom: 14, fontSize: 13, color: t.primary, fontWeight: '600' },
    separator:             { height: 1, backgroundColor: t.surfaceAlt, marginHorizontal: 16 },

    pendingHint:           { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: t.surfaceAlt, backgroundColor: t.amberBg },
    pendingHintText:       { fontSize: 12, color: t.amber, fontWeight: '600' },

    // Alert items
    alertItem:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    dot:                   { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
    alertItemContent:      { flex: 1 },
    alertItemName:         { fontSize: 14, fontWeight: '600', color: t.text },
    alertItemMeta:         { fontSize: 12, color: t.textSub, marginTop: 2 },
    alertItemNotes:        { fontSize: 11, color: t.textMuted, marginTop: 2, fontStyle: 'italic' },
    badge:                 { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 },
    badgeText:             { fontSize: 12, fontWeight: '700' },

    // Empty state
    emptyBox:              { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyIcon:             { fontSize: 48, color: t.primary, marginBottom: 12 },
    emptyTitle:            { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 8 },
    emptyText:             { fontSize: 14, color: t.textSub, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
    emptyActions:          { gap: 10, width: '100%' },
    emptyBtn:              { backgroundColor: t.primary, borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
    emptyBtnText:          { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
    emptyBtnOutline:       { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.primary },
    emptyBtnOutlineText:   { color: t.primary, fontWeight: '700', fontSize: 15 },
  });
}
