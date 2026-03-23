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
import { AnimatedPressable, ConfirmDialog, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

void formatDoseTime;

type Tab = 'active' | 'paused' | 'completed' | 'adherence';

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

// ─── Active treatment row ──────────────────────────────────────────────────────

function ActiveTreatmentRow({
  treatment,
  todayDoses,
  onDelete,
}: {
  treatment: TreatmentRow;
  todayDoses: TreatmentDoseRow[];
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const swipeRef = useRef<Swipeable>(null);
  const rem = daysRemaining(treatment);
  const isWeb = Platform.OS === 'web';

  const todayProgress = useMemo(() => {
    const slots = getTodaySlots([treatment], todayDoses);
    if (slots.length === 0) return null;
    const taken = slots.filter(sl => sl.logged?.status === 'taken').length;
    return { taken, total: slots.length };
  }, [treatment, todayDoses]);

  const row = (
    <Pressable
      style={s.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={s.treatmentContent}>
        <Text style={s.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={s.treatmentMetaRow}>
          <Text style={s.treatmentMeta}>
            {treatment.person_name} · {formatFrequency(treatment.frequency_hours)}
            {rem !== null ? ` · ${rem >= 0 ? `${rem}d restantes` : 'concluído'}` : ''}
          </Text>
          {todayProgress !== null && (
            <View style={[
              s.progressPill,
              { backgroundColor: todayProgress.taken === todayProgress.total ? theme.primaryLight : theme.amberBg },
            ]}>
              <Text style={[
                s.progressPillText,
                { color: todayProgress.taken === todayProgress.total ? theme.primary : theme.amber },
              ]}>
                {todayProgress.taken}/{todayProgress.total} hoje
              </Text>
            </View>
          )}
        </View>
      </View>
      {!isWeb && <Text style={s.chevron}>›</Text>}
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={s.webRow}>
        {row}
        <Pressable style={s.webDeleteBtn} onPress={() => { onDelete(treatment.id); }}>
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
          onPress={() => { swipeRef.current?.close(); onDelete(treatment.id); }}
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

// ─── Paused treatment row ──────────────────────────────────────────────────────

function PausedTreatmentRow({
  treatment,
  onResume,
}: {
  treatment: TreatmentRow;
  onResume: (id: string) => void;
}) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  return (
    <Pressable
      style={s.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={s.treatmentContent}>
        <Text style={s.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={s.treatmentMetaRow}>
          <Text style={s.treatmentMeta}>
            {treatment.person_name} · {formatFrequency(treatment.frequency_hours)}
          </Text>
          <View style={s.badgeAmber}>
            <Text style={s.badgeAmberText}>Pausado</Text>
          </View>
        </View>
      </View>
      <Pressable
        style={s.resumeBtn}
        onPress={(e) => { e.stopPropagation?.(); onResume(treatment.id); }}
      >
        <Text style={s.resumeBtnText}>Retomar</Text>
      </Pressable>
    </Pressable>
  );
}

// ─── Completed treatment row ───────────────────────────────────────────────────

function CompletedTreatmentRow({
  treatment,
  onReactivate,
  onDelete,
}: {
  treatment: TreatmentRow;
  onReactivate: (t: TreatmentRow) => void;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const swipeRef = useRef<Swipeable>(null);
  const period = treatment.end_date
    ? `${formatDatePT(treatment.start_date)} → ${formatDatePT(treatment.end_date)}`
    : `desde ${formatDatePT(treatment.start_date)}`;

  const row = (
    <Pressable
      style={s.treatmentItem}
      onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
    >
      <View style={s.treatmentContent}>
        <Text style={s.treatmentName} numberOfLines={1}>{treatment.medication_name}</Text>
        <View style={s.treatmentMetaRow}>
          <Text style={s.treatmentMeta}>{treatment.person_name} · {period}</Text>
          <View style={s.badgeGray}>
            <Text style={s.badgeGrayText}>Concluído</Text>
          </View>
        </View>
      </View>
      <View style={s.completedActions}>
        <Pressable
          style={s.reactivateBtn}
          onPress={(e) => { e.stopPropagation?.(); onReactivate(treatment); }}
        >
          <Text style={s.reactivateBtnText}>Reativar</Text>
        </Pressable>
        {Platform.OS === 'web' && (
          <Pressable style={s.webDeleteBtn} onPress={() => { onDelete(treatment.id); }}>
            <Text style={s.webDeleteText}>✕</Text>
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
          style={s.deleteAction}
          onPress={() => { swipeRef.current?.close(); onDelete(treatment.id); }}
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

// ─── Adherence tab ─────────────────────────────────────────────────────────────

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
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

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
      <View style={s.loadingCenter}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (perStats.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>Nenhum dado de aderência disponível.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.adherenceContainer}>
      <View style={s.adherenceOverallCard}>
        <Text style={s.adherenceOverallPct}>{overall.pct}%</Text>
        <Text style={s.adherenceOverallLabel}>aderência geral</Text>
        <Text style={s.adherenceOverallSub}>
          {allTreatments.length} tratamento{allTreatments.length !== 1 ? 's' : ''} · {overall.totalTaken} de {overall.totalDoses} doses
        </Text>
      </View>

      {perStats.map(({ treatment, stats }) => (
        <Pressable
          key={treatment.id}
          style={s.adherenceCard}
          onPress={() => { router.push(`/(app)/treatments/${treatment.id}`); }}
        >
          <View style={s.adherenceCardHeader}>
            <Text style={s.adherenceCardName} numberOfLines={1}>{treatment.medication_name}</Text>
            <Text style={[
              s.adherenceCardPct,
              { color: stats.pct >= 80 ? theme.primary : stats.pct >= 50 ? theme.amber : theme.coral },
            ]}>
              {stats.pct}%
            </Text>
          </View>
          <View style={s.progressBarBg}>
            <View style={[
              s.progressBarFill,
              {
                width: `${stats.pct}%` as `${number}%`,
                backgroundColor: stats.pct >= 80 ? theme.primary : stats.pct >= 50 ? theme.amber : theme.coral,
              },
            ]} />
          </View>
          <Text style={s.adherenceCardSub}>
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

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function TreatmentsScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const toast               = useToast();
  const rawTreatments       = useSelector(treatmentStore.treatments);
  const rawPaused           = useSelector(treatmentStore.pausedTreatments);
  const rawCompleted        = useSelector(treatmentStore.completedTreatments);
  const rawTodayDoses       = useSelector(treatmentStore.todayDoses);
  const rawAdherenceDoses   = useSelector(treatmentStore.adherenceDoses);
  const adherenceLoading    = useSelector(treatmentStore.adherenceLoading);
  const loading             = useSelector(treatmentStore.loading);
  const familyId            = useSelector(treatmentStore.familyId);

  const treatments          = rawTreatments as TreatmentRow[];
  const pausedTreatments    = rawPaused as TreatmentRow[];
  const completedTreatments = rawCompleted as TreatmentRow[];
  const todayDoses          = rawTodayDoses as TreatmentDoseRow[];
  const adherenceDoses      = rawAdherenceDoses as Record<string, TreatmentDoseRow[]>;

  const [tab, setTab]               = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<TreatmentRow | null>(null);
  const [reactivateDate, setReactivateDate]     = useState('');

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
    adherenceLoadedRef.current = false;
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Tratamentos</Text>
        <AnimatedPressable
          style={s.addBtn}
          onPress={() => { router.push('/(app)/treatments/add'); }}
        >
          <Text style={s.addBtnText}>+ Novo</Text>
        </AnimatedPressable>
      </View>

      <View style={s.tabBar}>
        {TAB_LABELS.map(({ key, label }) => (
          <Pressable
            key={key}
            style={s.tabItem}
            onPress={() => { setTab(key); }}
          >
            <Text style={[s.tabLabel, tab === key && s.tabLabelActive]}>
              {label}
            </Text>
            {tab === key && <View style={s.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {tab === 'active' && (
        <FlatList
          data={treatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
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
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <Text style={s.emptyText}>Nenhum tratamento ativo.</Text>
              </View>
            ) : null
          }
          contentContainerStyle={treatments.length === 0 ? s.listEmpty : undefined}
        />
      )}

      {tab === 'paused' && (
        <FlatList
          data={pausedTreatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).springify()}>
              <PausedTreatmentRow
                treatment={item}
                onResume={id => { void handleResume(id); }}
              />
            </Animated.View>
          )}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhum tratamento pausado.</Text>
            </View>
          }
          contentContainerStyle={pausedTreatments.length === 0 ? s.listEmpty : undefined}
        />
      )}

      {tab === 'completed' && (
        <FlatList
          data={completedTreatments}
          keyExtractor={t => t.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
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
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyText}>Nenhum tratamento concluído.</Text>
            </View>
          }
          contentContainerStyle={completedTreatments.length === 0 ? s.listEmpty : undefined}
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

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remover tratamento"
        message="O histórico de doses será mantido, mas o tratamento será removido da lista."
        confirmLabel="Remover"
        destructive
        onConfirm={() => { void handleDelete(deleteTarget ?? ''); }}
        onCancel={() => { setDeleteTarget(null); }}
      />

      <Modal transparent animationType="fade" visible={reactivateTarget !== null} onRequestClose={() => { setReactivateTarget(null); }}>
        <View style={s.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setReactivateTarget(null); }} />
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reativar {reactivateTarget?.medication_name}</Text>
            <Text style={s.modalLabel}>Nova data de início</Text>
            <View style={s.dateRow}>
              <TextInput
                style={s.dateInput}
                value={reactivateDate}
                onChangeText={setReactivateDate}
                placeholder="AAAA-MM-DD"
                keyboardType="numeric"
                maxLength={10}
                placeholderTextColor={theme.textMuted}
              />
              <Pressable style={s.todayBtn} onPress={() => { setReactivateDate(todayISO()); }}>
                <Text style={s.todayBtnText}>Hoje</Text>
              </Pressable>
            </View>
            <View style={s.modalActions}>
              <Pressable style={s.modalCancelBtn} onPress={() => { setReactivateTarget(null); }}>
                <Text style={s.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={s.modalConfirmBtn} onPress={() => { void handleReactivate(); }}>
                <Text style={s.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: t.bg },
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    title:            { fontSize: 22, fontWeight: '700', color: t.text, fontFamily: fonts.heading },
    addBtn:           { backgroundColor: t.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7 },
    addBtnText:       { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    tabBar:           { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.surfaceAlt, backgroundColor: t.surface },
    tabItem:          { flex: 1, alignItems: 'center', paddingVertical: 10 },
    tabLabel:         { fontSize: 13, fontWeight: '600', color: t.textMuted },
    tabLabelActive:   { color: t.primary },
    tabUnderline:     { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, backgroundColor: t.primary, borderRadius: 1 },

    treatmentItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: t.surface },
    treatmentContent: { flex: 1 },
    treatmentName:    { fontSize: 14, fontWeight: '600', color: t.text },
    treatmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
    treatmentMeta:    { fontSize: 12, color: t.textSub },
    chevron:          { fontSize: 20, color: t.textMuted, marginLeft: 8 },

    progressPill:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    progressPillText: { fontSize: 11, fontWeight: '700' },

    badgeAmber:       { backgroundColor: t.amberBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    badgeAmberText:   { fontSize: 11, fontWeight: '700', color: t.amber },
    badgeGray:        { backgroundColor: t.surfaceAlt, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    badgeGrayText:    { fontSize: 11, fontWeight: '700', color: t.textSub },

    resumeBtn:        { backgroundColor: t.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
    resumeBtnText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

    completedActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    reactivateBtn:    { backgroundColor: t.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
    reactivateBtnText:{ color: t.primary, fontWeight: '700', fontSize: 12 },

    webRow:           { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface },
    webDeleteBtn:     { paddingHorizontal: 16, paddingVertical: 14, justifyContent: 'center' },
    webDeleteText:    { color: t.coral, fontWeight: '700', fontSize: 16 },

    deleteAction:     { width: 80, backgroundColor: t.coral, alignItems: 'center', justifyContent: 'center' },
    deleteActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

    separator:        { height: 1, backgroundColor: t.surfaceAlt },
    empty:            { padding: 32, alignItems: 'center' },
    emptyText:        { color: t.textMuted, fontSize: 14 },
    listEmpty:        { flex: 1 },
    loadingCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

    adherenceContainer: { padding: 16, gap: 12 },
    adherenceOverallCard: {
      backgroundColor: t.primary,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      marginBottom: 4,
    },
    adherenceOverallPct:   { fontSize: 48, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2 },
    adherenceOverallLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    adherenceOverallSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
    adherenceCard: {
      backgroundColor: t.surface,
      borderRadius: 16,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    adherenceCardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    adherenceCardName:    { fontSize: 14, fontWeight: '600', color: t.text, flex: 1 },
    adherenceCardPct:     { fontSize: 16, fontWeight: '800', marginLeft: 8 },
    progressBarBg:        { height: 6, backgroundColor: t.surfaceAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
    progressBarFill:      { height: 6, borderRadius: 3 },
    adherenceCardSub:     { fontSize: 11, color: t.textMuted },

    modalBackdrop:    { flex: 1, backgroundColor: t.isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 32 },
    modalCard:        { backgroundColor: t.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
    modalTitle:       { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 16 },
    modalLabel:       { fontSize: 13, fontWeight: '600', color: t.textSub, marginBottom: 8 },
    dateRow:          { flexDirection: 'row', gap: 8, marginBottom: 20 },
    dateInput:        { flex: 1, borderWidth: 1, borderColor: t.borderSub, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: t.text, backgroundColor: t.bg },
    todayBtn:         { backgroundColor: t.surfaceAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
    todayBtnText:     { fontSize: 13, fontWeight: '600', color: t.textSub },
    modalActions:     { flexDirection: 'row', gap: 10 },
    modalCancelBtn:   { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: t.borderSub, backgroundColor: t.bg },
    modalCancelText:  { color: t.textSub, fontWeight: '600', fontSize: 15 },
    modalConfirmBtn:  { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: t.primary },
    modalConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  });
}
