import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { supabase } from '../../../src/lib/supabase';
import { treatmentStore, logDose, updateTreatmentStatus, softDeleteTreatment } from '../../../src/stores/treatment.store';
import type { TreatmentRow, TreatmentDoseRow } from '../../../src/stores/treatment.store';
import {
  computeScheduledDoses,
  getTodaySlots,
  getAdherenceStats,
  formatFrequency,
  formatDoseTime,
  daysRemaining,
} from '../../../src/utils/treatment';
import type { DoseSlot } from '../../../src/utils/treatment';
import { AnimatedPressable, ConfirmDialog, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

function DoseSlotRow({
  slot,
  onLog,
}: {
  slot: DoseSlot;
  onLog: (scheduledAt: Date, status: 'taken' | 'skipped') => Promise<void>;
}) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { scheduledAt, logged } = slot;
  const isPast = scheduledAt <= new Date();

  return (
    <View style={s.slotRow}>
      <Text style={s.slotTime}>{formatDoseTime(scheduledAt)}</Text>
      {logged ? (
        <View style={[
          s.loggedBadge,
          { backgroundColor: logged.status === 'taken' ? theme.primaryLight : theme.coralBg },
        ]}>
          <Text style={[
            s.loggedBadgeText,
            { color: logged.status === 'taken' ? theme.primary : theme.coral },
          ]}>
            {logged.status === 'taken' ? '✓ Tomado' : '✕ Pulado'}
          </Text>
        </View>
      ) : (
        <View style={s.slotActions}>
          <Pressable
            style={[s.actionBtn, s.takenBtn]}
            onPress={() => { void onLog(scheduledAt, 'taken'); }}
            disabled={!isPast}
          >
            <Text style={s.takenBtnText}>Tomar</Text>
          </Pressable>
          <Pressable
            style={[s.actionBtn, s.skipBtn]}
            onPress={() => { void onLog(scheduledAt, 'skipped'); }}
          >
            <Text style={s.skipBtnText}>Pular</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function AdherenceCard({ pct, taken, total }: { pct: number; taken: number; total: number }) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  return (
    <View style={s.adherenceCard}>
      <View style={s.adherenceRow}>
        <Text style={s.adherenceLabel}>Adesão ao tratamento</Text>
        <Text style={s.adherencePct}>{pct}%</Text>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <Text style={s.adherenceSub}>{taken} de {total} doses tomadas</Text>
    </View>
  );
}

export default function TreatmentDetailScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const rawTreatments  = useSelector(treatmentStore.treatments);
  const rawPaused      = useSelector(treatmentStore.pausedTreatments);
  const rawCompleted   = useSelector(treatmentStore.completedTreatments);
  const rawTodayDoses  = useSelector(treatmentStore.todayDoses);
  const todayDoses     = rawTodayDoses as TreatmentDoseRow[];

  const treatment = useMemo(() => {
    const all = [
      ...(rawTreatments as TreatmentRow[]),
      ...(rawPaused as TreatmentRow[]),
      ...(rawCompleted as TreatmentRow[]),
    ];
    return all.find(t => t.id === id) ?? null;
  }, [rawTreatments, rawPaused, rawCompleted, id]);

  const [allDoses, setAllDoses] = useState<TreatmentDoseRow[]>([]);
  const [loadingDoses, setLoadingDoses] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadingDoses(true);
    void supabase
      .from('treatment_doses')
      .select('*')
      .eq('treatment_id', id)
      .order('scheduled_at', { ascending: false })
      .then(({ data }) => {
        setAllDoses((data ?? []) as unknown as TreatmentDoseRow[]);
        setLoadingDoses(false);
      });
  }, [id]);

  const todaySlots = useMemo(() => {
    if (!treatment) return [];
    return getTodaySlots([treatment], todayDoses);
  }, [treatment, todayDoses]);

  const stats = useMemo(() => {
    if (!treatment) return null;
    return getAdherenceStats(treatment, allDoses);
  }, [treatment, allDoses]);

  async function handleLog(scheduledAt: Date, status: 'taken' | 'skipped') {
    if (!treatment) return;
    hapticMedium();
    const err = await logDose(treatment.id, scheduledAt, status);
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      const { data } = await supabase
        .from('treatment_doses')
        .select('*')
        .eq('treatment_id', treatment.id)
        .order('scheduled_at', { ascending: false });
      if (data) setAllDoses(data as unknown as TreatmentDoseRow[]);
    }
  }

  async function handleStatusToggle() {
    if (!treatment) return;
    hapticMedium();
    const newStatus = treatment.status === 'active' ? 'paused' : 'active';
    const err = await updateTreatmentStatus(treatment.id, newStatus);
    if (err) toast.show('error', 'Erro', err);
    else toast.show('success', newStatus === 'active' ? 'Retomado' : 'Pausado', '');
  }

  async function handleComplete() {
    if (!treatment) return;
    hapticMedium();
    const err = await updateTreatmentStatus(treatment.id, 'completed');
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Concluído', 'Tratamento marcado como concluído.');
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/treatments');
    }
  }

  async function handleDelete() {
    if (!treatment) return;
    hapticMedium();
    const err = await softDeleteTreatment(treatment.id);
    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Removido', 'Tratamento removido.');
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/treatments');
    }
  }

  if (!treatment) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <AnimatedPressable onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/treatments');
          }}>
            <Text style={s.backText}>← Voltar</Text>
          </AnimatedPressable>
        </View>
        <View style={s.centered}>
          <Text style={s.notFoundText}>Tratamento não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rem = daysRemaining(treatment);
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDoses = computeScheduledDoses(treatment, now, endOfWeek).slice(0, 5);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <AnimatedPressable onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/treatments');
        }}>
          <Text style={s.backText}>← Voltar</Text>
        </AnimatedPressable>
        <View style={[s.statusBadge, { backgroundColor: treatment.status === 'active' ? theme.primaryLight : theme.amberBg }]}>
          <Text style={[s.statusText, { color: treatment.status === 'active' ? theme.primary : theme.amber }]}>
            {treatment.status === 'active' ? 'Ativo' : treatment.status === 'paused' ? 'Pausado' : 'Concluído'}
          </Text>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Text style={s.medName}>{treatment.medication_name}</Text>
        {treatment.presentation_dosage && (
          <Text style={s.medSub}>{treatment.presentation_dosage}</Text>
        )}
        <Text style={s.metaLine}>
          {treatment.person_name} · {treatment.dose_quantity} {treatment.dose_unit}
          {' '}· {formatFrequency(treatment.frequency_hours)}
          {rem !== null ? ` · ${rem >= 0 ? `${rem}d restantes` : 'Prazo encerrado'}` : ''}
        </Text>
        {treatment.notes && (
          <Text style={s.notes}>{treatment.notes}</Text>
        )}

        {stats && stats.total > 0 && (
          <AdherenceCard pct={stats.pct} taken={stats.taken} total={stats.total} />
        )}

        {todaySlots.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Doses de hoje</Text>
            {todaySlots.map(slot => (
              <DoseSlotRow
                key={slot.scheduledAt.toISOString()}
                slot={slot}
                onLog={handleLog}
              />
            ))}
          </View>
        )}

        {upcomingDoses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Próximas doses</Text>
            {upcomingDoses.map(d => (
              <View key={d.toISOString()} style={s.scheduleRow}>
                <Text style={s.scheduleDate}>
                  {d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <Text style={s.scheduleTime}>{formatDoseTime(d)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Histórico</Text>
          {loadingDoses ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
          ) : allDoses.length === 0 ? (
            <Text style={s.emptyText}>Nenhuma dose registrada ainda.</Text>
          ) : (
            allDoses.map(dose => (
              <View key={dose.id} style={s.historyRow}>
                <View style={[
                  s.historyIcon,
                  { backgroundColor: dose.status === 'taken' ? theme.primaryLight : theme.coralBg },
                ]}>
                  <Text style={{ color: dose.status === 'taken' ? theme.primary : theme.coral, fontWeight: '700' }}>
                    {dose.status === 'taken' ? '✓' : '✕'}
                  </Text>
                </View>
                <View style={s.historyInfo}>
                  <Text style={s.historyStatus}>
                    {dose.status === 'taken' ? 'Tomado' : 'Pulado'}
                  </Text>
                  <Text style={s.historyDate}>
                    {new Date(dose.scheduled_at).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.actions}>
          <Pressable
            style={[s.actionBtnLg, s.pauseBtn]}
            onPress={() => { void handleStatusToggle(); }}
          >
            <Text style={s.pauseBtnText}>
              {treatment.status === 'active' ? 'Pausar' : 'Retomar'}
            </Text>
          </Pressable>
          <Pressable
            style={[s.actionBtnLg, s.completeBtn, treatment.status === 'completed' && s.completeBtnDisabled]}
            onPress={() => { void handleComplete(); }}
            disabled={treatment.status === 'completed'}
          >
            <Text style={[s.completeBtnText, treatment.status === 'completed' && s.completeBtnTextDisabled]}>
              {treatment.status === 'completed' ? 'Concluído' : 'Concluir'}
            </Text>
          </Pressable>
          <Pressable
            style={[s.actionBtnLg, s.deleteBtn]}
            onPress={() => { setShowDeleteDialog(true); }}
          >
            <Text style={s.deleteBtnText}>Excluir</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showDeleteDialog}
        title="Excluir tratamento?"
        message="Esta ação não pode ser desfeita. O histórico de doses será removido."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { setShowDeleteDialog(false); void handleDelete(); }}
        onCancel={() => { setShowDeleteDialog(false); }}
      />
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: t.bg },
    header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backText:         { fontSize: 15, color: t.primary, fontWeight: '600' },
    statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    statusText:       { fontSize: 12, fontWeight: '700' },

    scroll:           { flex: 1 },
    scrollContent:    { paddingHorizontal: 16, paddingBottom: 40 },

    medName:          { fontSize: 20, fontWeight: '700', color: t.text, marginTop: 4, fontFamily: fonts.heading },
    medSub:           { fontSize: 13, color: t.primary, marginTop: 2 },
    metaLine:         { fontSize: 13, color: t.textSub, marginTop: 6 },
    notes:            { fontSize: 13, color: t.textSub, marginTop: 6, fontStyle: 'italic' },

    adherenceCard:    { backgroundColor: t.surface, borderRadius: 16, padding: 16, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    adherenceRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    adherenceLabel:   { fontSize: 13, fontWeight: '700', color: t.textSub },
    adherencePct:     { fontSize: 16, fontWeight: '800', color: t.primary },
    progressTrack:    { height: 8, backgroundColor: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
    progressFill:     { height: 8, backgroundColor: t.primary, borderRadius: 4 },
    adherenceSub:     { fontSize: 12, color: t.textMuted, marginTop: 6 },

    section:          { marginTop: 20 },
    sectionTitle:     { fontSize: 13, fontWeight: '700', color: t.textSub, marginBottom: 10 },

    slotRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
    slotTime:         { fontSize: 16, fontWeight: '700', color: t.primary, width: 48 },
    slotActions:      { flexDirection: 'row', gap: 6 },
    actionBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    takenBtn:         { backgroundColor: t.primary },
    takenBtnText:     { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    skipBtn:          { backgroundColor: t.bg, borderWidth: 1, borderColor: t.borderSub },
    skipBtnText:      { color: t.textSub, fontSize: 12, fontWeight: '600' },
    loggedBadge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    loggedBadgeText:  { fontSize: 12, fontWeight: '700' },

    scheduleRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt },
    scheduleDate:     { fontSize: 13, color: t.textSub, fontFamily: fonts.mono },
    scheduleTime:     { fontSize: 13, fontWeight: '700', color: t.text },

    historyRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt, gap: 10 },
    historyIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    historyInfo:      { flex: 1 },
    historyStatus:    { fontSize: 13, fontWeight: '700', color: t.text },
    historyDate:      { fontSize: 12, color: t.textMuted, marginTop: 1, fontFamily: fonts.mono },

    actions:          { flexDirection: 'row', gap: 8, marginTop: 24 },
    actionBtnLg:      { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
    pauseBtn:         { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderSub },
    pauseBtnText:     { color: t.textSub, fontWeight: '700', fontSize: 13 },
    completeBtn:            { backgroundColor: t.primaryLight, borderWidth: 1, borderColor: t.primaryBright },
    completeBtnText:        { color: t.primary, fontWeight: '700', fontSize: 13 },
    completeBtnDisabled:    { backgroundColor: t.surfaceAlt, borderColor: t.borderSub },
    completeBtnTextDisabled:{ color: t.textMuted },
    deleteBtn:        { backgroundColor: t.coralBg, borderWidth: 1, borderColor: t.coral },
    deleteBtnText:    { color: t.coral, fontWeight: '700', fontSize: 13 },

    centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    notFoundText:     { color: t.textMuted, fontSize: 14 },
    emptyText:        { color: t.textMuted, fontSize: 13, paddingVertical: 12 },
  });
}
