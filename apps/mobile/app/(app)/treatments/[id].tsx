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
import { AnimatedPressable, ConfirmDialog, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

// ─── Today dose slot row (same logic as index.tsx) ───────────────────────────

function DoseSlotRow({
  slot,
  onLog,
}: {
  slot: DoseSlot;
  onLog: (scheduledAt: Date, status: 'taken' | 'skipped') => Promise<void>;
}) {
  const { scheduledAt, logged } = slot;
  const isPast = scheduledAt <= new Date();

  return (
    <View style={styles.slotRow}>
      <Text style={styles.slotTime}>{formatDoseTime(scheduledAt)}</Text>
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
            onPress={() => { void onLog(scheduledAt, 'taken'); }}
            disabled={!isPast}
          >
            <Text style={styles.takenBtnText}>Tomar</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.skipBtn]}
            onPress={() => { void onLog(scheduledAt, 'skipped'); }}
          >
            <Text style={styles.skipBtnText}>Pular</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Adherence progress bar ───────────────────────────────────────────────────

function AdherenceCard({ pct, taken, total }: { pct: number; taken: number; total: number }) {
  return (
    <View style={styles.adherenceCard}>
      <View style={styles.adherenceRow}>
        <Text style={styles.adherenceLabel}>Adesão ao tratamento</Text>
        <Text style={styles.adherencePct}>{pct}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as `${number}%` }]} />
      </View>
      <Text style={styles.adherenceSub}>{taken} de {total} doses tomadas</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TreatmentDetailScreen() {
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

  // Load all historical doses for this treatment
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
      // Refresh allDoses to update history
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <AnimatedPressable onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/treatments');
          }}>
            <Text style={styles.backText}>← Voltar</Text>
          </AnimatedPressable>
        </View>
        <View style={styles.centered}>
          <Text style={styles.notFoundText}>Tratamento não encontrado.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rem = daysRemaining(treatment);

  // Upcoming doses from today (for the schedule preview)
  const now = new Date();
  const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDoses = computeScheduledDoses(treatment, now, endOfWeek).slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <AnimatedPressable onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/treatments');
        }}>
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>
        <View style={[styles.statusBadge, { backgroundColor: treatment.status === 'active' ? '#EEFCFB' : '#FFF3DC' }]}>
          <Text style={[styles.statusText, { color: treatment.status === 'active' ? '#1A9E96' : '#F5A623' }]}>
            {treatment.status === 'active' ? 'Ativo' : treatment.status === 'paused' ? 'Pausado' : 'Concluído'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Summary */}
        <Text style={styles.medName}>{treatment.medication_name}</Text>
        {treatment.presentation_dosage && (
          <Text style={styles.medSub}>{treatment.presentation_dosage}</Text>
        )}
        <Text style={styles.metaLine}>
          {treatment.person_name} · {treatment.dose_quantity} {treatment.dose_unit}
          {' '}· {formatFrequency(treatment.frequency_hours)}
          {rem !== null ? ` · ${rem >= 0 ? `${rem}d restantes` : 'Prazo encerrado'}` : ''}
        </Text>
        {treatment.notes && (
          <Text style={styles.notes}>{treatment.notes}</Text>
        )}

        {/* Adherence card */}
        {stats && stats.total > 0 && (
          <AdherenceCard pct={stats.pct} taken={stats.taken} total={stats.total} />
        )}

        {/* Today's doses */}
        {todaySlots.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Doses de hoje</Text>
            {todaySlots.map(slot => (
              <DoseSlotRow
                key={slot.scheduledAt.toISOString()}
                slot={slot}
                onLog={handleLog}
              />
            ))}
          </View>
        )}

        {/* Next 7 days preview */}
        {upcomingDoses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximas doses</Text>
            {upcomingDoses.map(d => (
              <View key={d.toISOString()} style={styles.scheduleRow}>
                <Text style={styles.scheduleDate}>
                  {d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </Text>
                <Text style={styles.scheduleTime}>{formatDoseTime(d)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          {loadingDoses ? (
            <ActivityIndicator color="#1A9E96" style={{ marginTop: 16 }} />
          ) : allDoses.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma dose registrada ainda.</Text>
          ) : (
            allDoses.map(dose => (
              <View key={dose.id} style={styles.historyRow}>
                <View style={[
                  styles.historyIcon,
                  { backgroundColor: dose.status === 'taken' ? '#EEFCFB' : '#FEE9E4' },
                ]}>
                  <Text style={{ color: dose.status === 'taken' ? '#1A9E96' : '#F0735A', fontWeight: '700' }}>
                    {dose.status === 'taken' ? '✓' : '✕'}
                  </Text>
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyStatus}>
                    {dose.status === 'taken' ? 'Tomado' : 'Pulado'}
                  </Text>
                  <Text style={styles.historyDate}>
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

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtnLg, styles.pauseBtn]}
            onPress={() => { void handleStatusToggle(); }}
          >
            <Text style={styles.pauseBtnText}>
              {treatment.status === 'active' ? 'Pausar' : 'Retomar'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtnLg, styles.completeBtn, treatment.status === 'completed' && styles.completeBtnDisabled]}
            onPress={() => { void handleComplete(); }}
            disabled={treatment.status === 'completed'}
          >
            <Text style={[styles.completeBtnText, treatment.status === 'completed' && styles.completeBtnTextDisabled]}>
              {treatment.status === 'completed' ? 'Concluído' : 'Concluir'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtnLg, styles.deleteBtn]}
            onPress={() => { setShowDeleteDialog(true); }}
          >
            <Text style={styles.deleteBtnText}>Excluir</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F6F8F5' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backText:         { fontSize: 15, color: '#1A9E96', fontWeight: '600' },
  statusBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText:       { fontSize: 12, fontWeight: '700' },

  scroll:           { flex: 1 },
  scrollContent:    { paddingHorizontal: 16, paddingBottom: 40 },

  medName:          { fontSize: 20, fontWeight: '700', color: '#1A1D1A', marginTop: 4 },
  medSub:           { fontSize: 13, color: '#1A9E96', marginTop: 2 },
  metaLine:         { fontSize: 13, color: '#5A625A', marginTop: 6 },
  notes:            { fontSize: 13, color: '#5A625A', marginTop: 6, fontStyle: 'italic' },

  adherenceCard:    { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  adherenceRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  adherenceLabel:   { fontSize: 13, fontWeight: '700', color: '#5A625A' },
  adherencePct:     { fontSize: 16, fontWeight: '800', color: '#1A9E96' },
  progressTrack:    { height: 8, backgroundColor: '#E8ECE5', borderRadius: 4, overflow: 'hidden' },
  progressFill:     { height: 8, backgroundColor: '#1A9E96', borderRadius: 4 },
  adherenceSub:     { fontSize: 12, color: '#9CA59C', marginTop: 6 },

  section:          { marginTop: 20 },
  sectionTitle:     { fontSize: 13, fontWeight: '700', color: '#5A625A', marginBottom: 10 },

  slotRow:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  slotTime:         { fontSize: 16, fontWeight: '700', color: '#1A9E96', width: 48 },
  slotActions:      { flexDirection: 'row', gap: 6 },
  actionBtn:        { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  takenBtn:         { backgroundColor: '#1A9E96' },
  takenBtnText:     { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  skipBtn:          { backgroundColor: '#F6F8F5', borderWidth: 1, borderColor: '#D1D9CC' },
  skipBtnText:      { color: '#5A625A', fontSize: 12, fontWeight: '600' },
  loggedBadge:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  loggedBadgeText:  { fontSize: 12, fontWeight: '700' },

  scheduleRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E8ECE5' },
  scheduleDate:     { fontSize: 13, color: '#5A625A' },
  scheduleTime:     { fontSize: 13, fontWeight: '700', color: '#1A1D1A' },

  historyRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E8ECE5', gap: 10 },
  historyIcon:      { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  historyInfo:      { flex: 1 },
  historyStatus:    { fontSize: 13, fontWeight: '700', color: '#1A1D1A' },
  historyDate:      { fontSize: 12, color: '#9CA59C', marginTop: 1 },

  actions:          { flexDirection: 'row', gap: 8, marginTop: 24 },
  actionBtnLg:      { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  pauseBtn:         { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D9CC' },
  pauseBtnText:     { color: '#5A625A', fontWeight: '700', fontSize: 13 },
  completeBtn:            { backgroundColor: '#EEFCFB', borderWidth: 1, borderColor: '#22C9BF' },
  completeBtnText:        { color: '#1A9E96', fontWeight: '700', fontSize: 13 },
  completeBtnDisabled:    { backgroundColor: '#F0F0EE', borderColor: '#D1D9CC' },
  completeBtnTextDisabled:{ color: '#9CA59C' },
  deleteBtn:        { backgroundColor: '#FEE9E4', borderWidth: 1, borderColor: '#F0735A' },
  deleteBtnText:    { color: '#F0735A', fontWeight: '700', fontSize: 13 },

  centered:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText:     { color: '#9CA59C', fontSize: 14 },
  emptyText:        { color: '#9CA59C', fontSize: 13, paddingVertical: 12 },
});
