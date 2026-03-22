import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import {
  treatmentStore,
  softDeleteTreatment,
  refreshTreatments,
  updateTreatmentStatus,
  reactivateTreatment,
  loadAdherenceData,
} from '../../../src/stores/treatment.store';
import type { TreatmentRow, TreatmentDoseRow } from '../../../src/stores/treatment.store';
import {
  formatFrequency,
  formatDoseTime,
  daysRemaining,
  getTodaySlots,
  getAdherenceStats,
} from '../../../src/utils/treatment';
import { AnimatedPressable, ConfirmDialog, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

// suppress unused import warning — formatDoseTime is used in DoseSlotRow (shared component)
void formatDoseTime;

type Tab = 'active' | 'paused' | 'completed' | 'adherence';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDatePT(dateStr: string): string {
  const parts = dateStr.split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

// ─── Active treatment row (unchanged) ─────────────────────────────────────────

function ActiveTreatmentRow({
  treatment,
  todayDoses,
  onDelete,
}: {
  treatment: TreatmentRow;
  todayDoses: TreatmentDoseRow[];
  onDelete: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const rem = daysRemaining(treatment);
  const isWeb = Platform.OS === 'web';

  const todayProgress = useMemo(() => {
    const slots = getTodaySlots([treatment], todayDoses);
    if (slots.length === 0) return null;
    const taken = slots.filter(s => s.logged?.status === 'taken').length;
    return { taken, total: slots.length };
  }, [treatment, todayDoses]);

  const row = (
    <Pressable
      style={styles.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={styles.treatmentContent}>
        <Text style={styles.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={styles.treatmentMetaRow}>
          <Text style={styles.treatmentMeta}>
            {treatment.person_name} · {formatFrequency(treatment.frequency_hours)}
            {rem !== null ? ` · ${rem >= 0 ? `${rem}d restantes` : 'concluído'}` : ''}
          </Text>
          {todayProgress !== null && (
            <View style={[
              styles.progressPill,
              { backgroundColor: todayProgress.taken === todayProgress.total ? '#EEFCFB' : '#FFF8EC' },
            ]}>
              <Text style={[
                styles.progressPillText,
                { color: todayProgress.taken === todayProgress.total ? '#1A9E96' : '#F5A623' },
              ]}>
                {todayProgress.taken}/{todayProgress.total} hoje
              </Text>
            </View>
          )}
        </View>
      </View>
      {!isWeb && <Text style={styles.chevron}>›</Text>}
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

// ─── Paused treatment row ─────────────────────────────────────────────────────

function PausedTreatmentRow({
  treatment,
  onResume,
}: {
  treatment: TreatmentRow;
  onResume: (id: string) => void;
}) {
  return (
    <Pressable
      style={styles.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={styles.treatmentContent}>
        <Text style={styles.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={styles.treatmentMetaRow}>
          <Text style={styles.treatmentMeta}>
            {treatment.person_name} · {formatFrequency(treatment.frequency_hours)}
          </Text>
          <View style={styles.badgeAmber}>
            <Text style={styles.badgeAmberText}>Pausado</Text>
          </View>
        </View>
      </View>
      <Pressable
        style={styles.resumeBtn}
        onPress={(e) => { e.stopPropagation?.(); onResume(treatment.id); }}
      >
        <Text style={styles.resumeBtnText}>Retomar</Text>
      </Pressable>
    </Pressable>
  );
}

// ─── Completed treatment row ──────────────────────────────────────────────────

function CompletedTreatmentRow({
  treatment,
  onReactivate,
  onDelete,
}: {
  treatment: TreatmentRow;
  onReactivate: (t: TreatmentRow) => void;
  onDelete: (id: string) => void;
}) {
  const swipeRef = useRef<Swipeable>(null);
  const period = treatment.end_date
    ? `${formatDatePT(treatment.start_date)} → ${formatDatePT(treatment.end_date)}`
    : `desde ${formatDatePT(treatment.start_date)}`;

  const row = (
    <Pressable
      style={styles.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={styles.treatmentContent}>
        <Text style={styles.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={styles.treatmentMetaRow}>
          <Text style={styles.treatmentMeta}>{treatment.person_name} · {period}</Text>
          <View style={styles.badgeGray}>
            <Text style={styles.badgeGrayText}>Concluído</Text>
          </View>
        </View>
      </View>
      <View style={styles.completedActions}>
        <Pressable
          style={styles.reactivateBtn}
          onPress={(e) => { e.stopPropagation?.(); onReactivate(treatment); }}
        >
          <Text style={styles.reactivateBtnText}>Reativar</Text>
        </Pressable>
        {Platform.OS === 'web' && (
          <Pressable style={styles.webDeleteBtn} onPress={() => { onDelete(treatment.id); }}>
            <Text style={styles.webDeleteText}>✕</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );

  if (Platform.OS === 'web') return row;

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

// ─── Adherence tab ────────────────────────────────────────────────────────────

function AdherenceTab({
  treatments,
  pausedTreatments,
  completedTreatments,
  adherenceDoses,
  adherenceLoading,
}: {
  treatments: TreatmentRow[];
  pausedTreatments: TreatmentRow[];
  completedTreatments: TreatmentRow[];
  adherenceDoses: Record<string, TreatmentDoseRow[]>;
  adherenceLoading: boolean;
}) {
  const allTreatments = useMemo(
    () => [...treatments, ...pausedTreatments, ...completedTreatments],
    [treatments, pausedTreatments, completedTreatments],
  );

  const perStats = useMemo(() => {
    return allTreatments
      .map(t => ({
        treatment: t,
        stats: getAdherenceStats(t, adherenceDoses[t.id] ?? []),
      }))
      .filter(({ stats }) => stats.total > 0)
      .sort((a, b) => b.stats.pct - a.stats.pct);
  }, [allTreatments, adherenceDoses]);

  const overall = useMemo(() => {
    let totalTaken = 0;
    let totalDoses = 0;
    for (const { stats } of perStats) {
      totalTaken += stats.taken;
      totalDoses += stats.total;
    }
    const pct = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;
    return { pct, totalTaken, totalDoses };
  }, [perStats]);

  if (adherenceLoading) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator color="#1A9E96" size="large" />
      </View>
    );
  }

  if (perStats.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhum dado de aderência disponível.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.adherenceContainer}>
      {/* Overall card */}
      <View style={styles.adherenceOverallCard}>
        <Text style={styles.adherenceOverallPct}>{overall.pct}%</Text>
        <Text style={styles.adherenceOverallLabel}>aderência geral</Text>
        <Text style={styles.adherenceOverallSub}>
          {allTreatments.length} tratamento{allTreatments.length !== 1 ? 's' : ''} · {overall.totalTaken} de {overall.totalDoses} doses
        </Text>
      </View>

      {/* Per-treatment cards */}
      {perStats.map(({ treatment, stats }) => (
        <Pressable
          key={treatment.id}
          style={styles.adherenceCard}
          onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
        >
          <View style={styles.adherenceCardHeader}>
            <Text style={styles.adherenceCardName} numberOfLines={1}>{treatment.medication_name}</Text>
            <Text style={[
              styles.adherenceCardPct,
              { color: stats.pct >= 80 ? '#1A9E96' : stats.pct >= 50 ? '#F5A623' : '#F0735A' },
            ]}>
              {stats.pct}%
            </Text>
          </View>
          {/* Progress bar */}
          <View style={styles.progressBarBg}>
            <View style={[
              styles.progressBarFill,
              {
                width: `${stats.pct}%` as `${number}%`,
                backgroundColor: stats.pct >= 80 ? '#1A9E96' : stats.pct >= 50 ? '#F5A623' : '#F0735A',
              },
            ]} />
          </View>
          <Text style={styles.adherenceCardSub}>
            {treatment.person_name} · {stats.taken}/{stats.total} doses ·{' '}
            {treatment.end_date
              ? `${formatDatePT(treatment.start_date)} → ${formatDatePT(treatment.end_date)}`
              : `desde ${formatDatePT(treatment.start_date)}`}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TreatmentsScreen() {
  const toast               = useToast();
  const rawTreatments       = useSelector(treatmentStore.treatments);
  const rawPaused           = useSelector(treatmentStore.pausedTreatments);
  const rawCompleted        = useSelector(treatmentStore.completedTreatments);
  const rawTodayDoses       = useSelector(treatmentStore.todayDoses);
  const rawAdherenceDoses   = useSelector(treatmentStore.adherenceDoses);
  const adherenceLoading    = useSelector(treatmentStore.adherenceLoading);
  const loading             = useSelector(treatmentStore.loading);
  const familyId            = useSelector(treatmentStore.familyId);

  const treatments        = rawTreatments as TreatmentRow[];
  const pausedTreatments  = rawPaused as TreatmentRow[];
  const completedTreatments = rawCompleted as TreatmentRow[];
  const todayDoses        = rawTodayDoses as TreatmentDoseRow[];
  const adherenceDoses    = rawAdherenceDoses as Record<string, TreatmentDoseRow[]>;

  const [tab, setTab]               = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Reactivate dialog
  const [reactivateTarget, setReactivateTarget] = useState<TreatmentRow | null>(null);
  const [reactivateDate, setReactivateDate]     = useState('');

  // Load adherence data when entering completed or adherence tab (lazy, once)
  const adherenceLoadedRef = useRef(false);
  useEffect(() => {
    if ((tab === 'completed' || tab === 'adherence') && !adherenceLoadedRef.current) {
      adherenceLoadedRef.current = true;
      void loadAdherenceData();
    }
  }, [tab]);

  const handleRefresh = useCallback(() => {
    if (!familyId) return;
    setRefreshing(true);
    adherenceLoadedRef.current = false; // force reload on manual refresh
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
    setDeleteTarget(null);
  }

  async function handleResume(id: string) {
    hapticMedium();
    const err = await updateTreatmentStatus(id, 'active');
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Retomado', 'Tratamento reativado.');
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reactivateDate)) {
      toast.show('error', 'Data inválida', 'Use o formato AAAA-MM-DD.');
      return;
    }
    hapticMedium();
    const err = await reactivateTreatment(reactivateTarget.id, reactivateDate);
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Reativado', `${reactivateTarget.medication_name} iniciado como novo ciclo.`);
      setReactivateTarget(null);
    }
  }

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: 'active',    label: 'Ativos' },
    { key: 'paused',    label: 'Pausados' },
    { key: 'completed', label: 'Concluídos' },
    { key: 'adherence', label: 'Aderência' },
  ];

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

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TAB_LABELS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={styles.tabItem}
            onPress={() => { setTab(key); }}
          >
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>
              {label}
            </Text>
            {tab === key && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      {tab === 'active' && (
        <FlatList
          data={treatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <ActiveTreatmentRow
                treatment={item}
                todayDoses={todayDoses}
                onDelete={id => { setDeleteTarget(id); }}
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

      {tab === 'paused' && (
        <FlatList
          data={pausedTreatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <PausedTreatmentRow
                treatment={item}
                onResume={id => { void handleResume(id); }}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum tratamento pausado.</Text>
            </View>
          }
          contentContainerStyle={pausedTreatments.length === 0 ? styles.listEmpty : undefined}
        />
      )}

      {tab === 'completed' && (
        <FlatList
          data={completedTreatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#1A9E96" />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <CompletedTreatmentRow
                treatment={item}
                onReactivate={t => { setReactivateTarget(t); setReactivateDate(todayISO()); }}
                onDelete={id => { setDeleteTarget(id); }}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum tratamento concluído.</Text>
            </View>
          }
          contentContainerStyle={completedTreatments.length === 0 ? styles.listEmpty : undefined}
        />
      )}

      {tab === 'adherence' && (
        <AdherenceTab
          treatments={treatments}
          pausedTreatments={pausedTreatments}
          completedTreatments={completedTreatments}
          adherenceDoses={adherenceDoses}
          adherenceLoading={adherenceLoading as boolean}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remover tratamento"
        message="O histórico de doses será mantido, mas o tratamento será removido da lista."
        confirmLabel="Remover"
        destructive
        onConfirm={() => { void handleDelete(deleteTarget ?? ''); }}
        onCancel={() => { setDeleteTarget(null); }}
      />

      {/* Reactivate dialog */}
      <Modal transparent animationType="fade" visible={reactivateTarget !== null} onRequestClose={() => { setReactivateTarget(null); }}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setReactivateTarget(null); }} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reativar {reactivateTarget?.medication_name}</Text>
            <Text style={styles.modalLabel}>Nova data de início</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={styles.dateInput}
                value={reactivateDate}
                onChangeText={setReactivateDate}
                placeholder="AAAA-MM-DD"
                keyboardType="numeric"
                maxLength={10}
              />
              <Pressable style={styles.todayBtn} onPress={() => { setReactivateDate(todayISO()); }}>
                <Text style={styles.todayBtnText}>Hoje</Text>
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => { setReactivateTarget(null); }}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={() => { void handleReactivate(); }}>
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F6F8F5' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title:            { fontSize: 22, fontWeight: '700', color: '#1A1D1A' },
  addBtn:           { backgroundColor: '#1A9E96', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Tab bar
  tabBar:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E8ECE5', backgroundColor: '#FFFFFF' },
  tabItem:          { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel:         { fontSize: 13, fontWeight: '600', color: '#9CA59C' },
  tabLabelActive:   { color: '#1A9E96' },
  tabUnderline:     { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: '#1A9E96', borderRadius: 1 },

  // Treatment list rows
  treatmentItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  treatmentContent: { flex: 1 },
  treatmentName:    { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  treatmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  treatmentMeta:    { fontSize: 12, color: '#5A625A' },
  chevron:          { fontSize: 20, color: '#9CA59C', marginLeft: 8 },

  progressPill:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  progressPillText: { fontSize: 11, fontWeight: '700' },

  // Badges
  badgeAmber:       { backgroundColor: '#FFF8EC', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeAmberText:   { fontSize: 11, fontWeight: '700', color: '#F5A623' },
  badgeGray:        { backgroundColor: '#F0F0EE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeGrayText:    { fontSize: 11, fontWeight: '700', color: '#7A827A' },

  // Paused row
  resumeBtn:        { backgroundColor: '#1A9E96', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  resumeBtnText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // Completed row
  completedActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactivateBtn:    { backgroundColor: '#EEFCFB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  reactivateBtnText:{ color: '#1A9E96', fontWeight: '700', fontSize: 12 },

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
  loadingCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Adherence tab
  adherenceContainer: { padding: 16, gap: 12 },
  adherenceOverallCard: {
    backgroundColor: '#1A9E96',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 4,
  },
  adherenceOverallPct:   { fontSize: 48, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2 },
  adherenceOverallLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  adherenceOverallSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  adherenceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  adherenceCardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  adherenceCardName:    { fontSize: 14, fontWeight: '600', color: '#1A1D1A', flex: 1 },
  adherenceCardPct:     { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  progressBarBg:        { height: 6, backgroundColor: '#E8ECE5', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill:      { height: 6, borderRadius: 3 },
  adherenceCardSub:     { fontSize: 11, color: '#9CA59C' },

  // Reactivate modal
  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard:        { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: '#1A1D1A', marginBottom: 16 },
  modalLabel:       { fontSize: 13, fontWeight: '600', color: '#5A625A', marginBottom: 8 },
  dateRow:          { flexDirection: 'row', gap: 8, marginBottom: 20 },
  dateInput:        { flex: 1, borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1A1D1A', backgroundColor: '#F6F8F5' },
  todayBtn:         { backgroundColor: '#E8ECE5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  todayBtnText:     { fontSize: 13, fontWeight: '600', color: '#5A625A' },
  modalActions:     { flexDirection: 'row', gap: 10 },
  modalCancelBtn:   { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC', backgroundColor: '#F6F8F5' },
  modalCancelText:  { color: '#5A625A', fontWeight: '600', fontSize: 15 },
  modalConfirmBtn:  { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: '#1A9E96' },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
