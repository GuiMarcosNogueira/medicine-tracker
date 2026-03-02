import { View, Text, Pressable, StyleSheet } from 'react-native';
import { logDose } from '../stores/treatment.store';
import { formatDoseTime } from '../utils/treatment';
import type { DoseSlot } from '../utils/treatment';
import { useToast } from '@medstock/ui';
import { hapticMedium } from '../lib/haptics';

export function DoseSlotRow({ slot }: { slot: DoseSlot }) {
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
            {' · '}{treatment.person_name}
          </Text>
          {Boolean(treatment.notes) && (
            <Text style={styles.slotNotes} numberOfLines={1}>{treatment.notes}</Text>
          )}
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
            style={[styles.actionBtn, styles.takenBtn, !isPast && styles.takenBtnDisabled]}
            onPress={() => { void handleLog('taken'); }}
            disabled={!isPast}
          >
            <Text style={[styles.takenBtnText, !isPast && styles.takenBtnTextDisabled]}>Tomar</Text>
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

const styles = StyleSheet.create({
  slotRow:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  slotLeft:             { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  slotTime:             { fontSize: 16, fontWeight: '700', color: '#1A9E96', width: 42 },
  slotInfo:             { flex: 1 },
  slotName:             { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  slotDose:             { fontSize: 12, color: '#5A625A', marginTop: 1 },
  slotNotes:            { fontSize: 11, color: '#9CA59C', marginTop: 2, fontStyle: 'italic' },
  slotActions:          { flexDirection: 'row', gap: 6 },
  actionBtn:            { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  takenBtn:             { backgroundColor: '#1A9E96' },
  takenBtnDisabled:     { backgroundColor: '#D1D9CC' },
  takenBtnText:         { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  takenBtnTextDisabled: { color: '#9CA59C' },
  skipBtn:              { backgroundColor: '#F6F8F5', borderWidth: 1, borderColor: '#D1D9CC' },
  skipBtnText:          { color: '#5A625A', fontSize: 12, fontWeight: '600' },
  loggedBadge:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  loggedBadgeText:      { fontSize: 12, fontWeight: '700' },
});
