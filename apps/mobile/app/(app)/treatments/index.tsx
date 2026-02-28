import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import {
  treatmentStore,
  logDose,
  softDeleteTreatment,
  refreshTreatments,
} from '../../../src/stores/treatment.store';
import {
  getTodaySlots,
  formatFrequency,
  formatDoseTime,
  daysRemaining,
} from '../../../src/utils/treatment';
import type { TreatmentRow, TreatmentDoseRow } from '../../../src/stores/treatment.store';
import type { DoseSlot } from '../../../src/utils/treatment';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

// ─── Today dose slot row ──────────────────────────────────────────────────────

function DoseSlotRow({ slot }: { slot: DoseSlot }) {
  const { treatment, scheduledAt, logged } = slot;
  const isPast = scheduledAt <= new Date();
  const toast = useToast();

  async function handleLog(status: 'taken' | 'skipped') {
    hapticMedium();
    const err = await logDose(treatment.id, scheduledAt, status);
    if (err) toast.show('error', 'Erro', err);
  }

  return (
    <View style={styles.slotRow}>
      <View style={styles.slotLeft}>
        <Text style={styles.slotTime}>{formatDoseTime(scheduledAt)}</Text>
        <View style={styles.slotInfo}>
          <Text style={styles.slotName} numberOfLines={1}>{treatment.medication_name}</Text>
          <Text style={styles.slotDose}>
            {treatment.dose_quantity} {treatment.dose_unit}
            {treatment.presentation_dosage ? ` · ${treatment.presentation_dosage}` : ''}
          </Text>
        </View>
      </View>

      {logged ? (
        <View style={[
          styles.loggedBadge,
          { backgroundColor: logged.status === 'taken' ? '#EEFCFB' : '#FEE9E4' },
        ]}>
          <Text style={[
            styles.loggedBadgeText,
            { color: logged.status === 'taken' ? '#1A9E96' : '#F0735A' },
          ]}>
            {logged.status === 'taken' ? '✓ Tomado' : '✕ Pulado'}
          </Text>
        </View>
      ) : (
        <View style={styles.slotActions}>
          <Pressable
            style={[styles.actionBtn, styles.takenBtn]}
            onPress={() => { void handleLog('taken'); }}
            disabled={!isPast}
          >
            <Text style={styles.takenBtnText}>Tomar</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.skipBtn]}
            onPress={() => { void handleLog('skipped'); }}
          >
            <Text style={styles.skipBtnText}>Pular</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Treatment list row ───────────────────────────────────────────────────────

function TreatmentRow({
  treatment,
  onDelete,
}: {
  treatment: TreatmentRow;
  onDelete: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const rem = daysRemaining(treatment);

  const row = (
    <Pressable
      style={styles.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={styles.treatmentContent}>
        <Text style={styles.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <Text style={styles.treatmentMeta}>
          {treatment.person_name} · {formatFrequency(treatment.frequency_hours)}
          {rem !== null ? ` · ${rem >= 0 ? `${rem}d restantes` : 'concluído'}` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRow}>
        {row}
        <Pressable style={styles.webDeleteBtn} onPress={() => { onDelete(treatment.id); }}>
          <Text style={styles.webDeleteText}>✕</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <Pressable
          style={styles.deleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete(treatment.id); }}
        >
          <Text style={styles.deleteActionText}>Remover</Text>
        </Pressable>
      )}
      overshootRight={false}
    >
      {row}
    </Swipeable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type Tab = 'today' | 'all';

export default function TreatmentsScreen() {
  const toast = useToast();
  const rawTreatments = useSelector(treatmentStore.treatments);
  const rawTodayDoses = useSelector(treatmentStore.todayDoses);
  const treatments = rawTreatments as TreatmentRow[];
  const todayDoses = rawTodayDoses as TreatmentDoseRow[];
  const loading = useSelector(treatmentStore.loading);
  const familyId = useSelector(treatmentStore.familyId);
  const [tab, setTab] = useState<Tab>('today');
  const [refreshing, setRefreshing] = useState(false);

  const todaySlots = useMemo(
    () => getTodaySlots(treatments, todayDoses),
    [treatments, todayDoses],
  );

  const handleRefresh = useCallback(() => {
    if (!familyId) return;
    setRefreshing(true);
    void refreshTreatments(familyId).finally(() => { setRefreshing(false); });
  }, [familyId]);

  async function handleDelete(id: string) {
    hapticMedium();
    const err = await softDeleteTreatment(id);
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Removido', 'Tratamento removido.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tratamentos</Text>
        <AnimatedPressable
          style={styles.addBtn}
          onPress={() => { router.push('/(app)/treatments/add'); }}
        >
          <Text style={styles.addBtnText}>+ Novo</Text>
        </AnimatedPressable>
      </View>

      {/* Tab toggle */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, tab === 'today' && styles.tabBtnActive]}
          onPress={() => { setTab('today'); }}
        >
          <Text style={[styles.tabBtnText, tab === 'today' && styles.tabBtnTextActive]}>
            Hoje
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === 'all' && styles.tabBtnActive]}
          onPress={() => { setTab('all'); }}
        >
          <Text style={[styles.tabBtnText, tab === 'all' && styles.tabBtnTextActive]}>
            Tratamentos
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {tab === 'today' ? (
        <FlatList
          data={todaySlots}
          keyExtractor={slot => `${slot.treatment.id}-${slot.scheduledAt.toISOString()}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <DoseSlotRow slot={item} />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  Nenhuma dose agendada para hoje.
                </Text>
              </View>
            ) : null
          }
          contentContainerStyle={todaySlots.length === 0 ? styles.listEmpty : undefined}
        />
      ) : (
        <FlatList
          data={treatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <TreatmentRow
                treatment={item}
                onDelete={id => { void handleDelete(id); }}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhum tratamento ativo.</Text>
              </View>
            ) : null
          }
          contentContainerStyle={treatments.length === 0 ? styles.listEmpty : undefined}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F6F8F5' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  title:            { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  addBtn:           { backgroundColor: '#1A9E96', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  tabBar:           { flexDirection: 'row', marginHorizontal: 16, marginVertical: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 3, borderWidth: 1, borderColor: '#E8ECE5' },
  tabBtn:           { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabBtnActive:     { backgroundColor: '#1A9E96' },
  tabBtnText:       { fontSize: 13, fontWeight: '600', color: '#5A625A' },
  tabBtnTextActive: { color: '#FFFFFF' },

  // Today slots
  slotRow:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  slotLeft:         { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotTime:         { fontSize: 16, fontWeight: '700', color: '#1A9E96', width: 42 },
  slotInfo:         { flex: 1 },
  slotName:         { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  slotDose:         { fontSize: 12, color: '#5A625A', marginTop: 1 },
  slotActions:      { flexDirection: 'row', gap: 6 },
  actionBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  takenBtn:         { backgroundColor: '#1A9E96' },
  takenBtnText:     { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  skipBtn:          { backgroundColor: '#F6F8F5', borderWidth: 1, borderColor: '#D1D9CC' },
  skipBtnText:      { color: '#5A625A', fontSize: 12, fontWeight: '600' },
  loggedBadge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  loggedBadgeText:  { fontSize: 12, fontWeight: '700' },

  // Treatment list rows
  treatmentItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  treatmentContent: { flex: 1 },
  treatmentName:    { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  treatmentMeta:    { fontSize: 12, color: '#5A625A', marginTop: 2 },
  chevron:          { fontSize: 20, color: '#9CA59C', marginLeft: 8 },

  // Web delete
  webRow:           { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF' },
  webDeleteBtn:     { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
  webDeleteText:    { color: '#F0735A', fontWeight: '700', fontSize: 16 },

  // Swipe delete
  deleteAction:     { width: 80, backgroundColor: '#F0735A', alignItems: 'center', justifyContent: 'center' },
  deleteActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  separator:        { height: 1, backgroundColor: '#E8ECE5' },
  empty:            { padding: 32, alignItems: 'center' },
  emptyText:        { color: '#9CA59C', fontSize: 14 },
  listEmpty:        { flex: 1 },
});
