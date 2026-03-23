import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { logDose } from '../stores/treatment.store';
import { formatDoseTime } from '../utils/treatment';
import type { DoseSlot } from '../utils/treatment';
import { useToast, useTheme, type Theme } from '@medstock/ui';
import { hapticMedium } from '../lib/haptics';

export function DoseSlotRow({ slot }: { slot: DoseSlot }) {
  const { treatment, scheduledAt, logged } = slot;
  const isPast = scheduledAt <= new Date();
  const toast = useToast();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  async function handleLog(status: 'taken' | 'skipped') {
    hapticMedium();
    const err = await logDose(treatment.id, scheduledAt, status);
    if (err) toast.show('error', 'Erro', err);
  }

  return (
    <View style={s.slotRow}>
      <View style={s.slotLeft}>
        <Text style={s.slotTime}>{formatDoseTime(scheduledAt)}</Text>
        <View style={s.slotInfo}>
          <Text style={s.slotName} numberOfLines={1}>{treatment.medication_name}</Text>
          <Text style={s.slotDose}>
            {treatment.dose_quantity} {treatment.dose_unit}
            {treatment.presentation_dosage ? ` · ${treatment.presentation_dosage}` : ''}
            {' · '}{treatment.person_name}
          </Text>
          {Boolean(treatment.notes) && (
            <Text style={s.slotNotes} numberOfLines={1}>{treatment.notes}</Text>
          )}
        </View>
      </View>

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
            style={[s.actionBtn, s.takenBtn, !isPast && s.takenBtnDisabled]}
            onPress={() => { void handleLog('taken'); }}
            disabled={!isPast}
          >
            <Text style={[s.takenBtnText, !isPast && s.takenBtnTextDisabled]}>Tomar</Text>
          </Pressable>
          <Pressable
            style={[s.actionBtn, s.skipBtn]}
            onPress={() => { void handleLog('skipped'); }}
          >
            <Text style={s.skipBtnText}>Pular</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    slotRow:              { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.surface },
    slotLeft:             { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    slotTime:             { fontSize: 16, fontWeight: '700', color: t.primary, width: 42 },
    slotInfo:             { flex: 1 },
    slotName:             { fontSize: 14, fontWeight: '600', color: t.text },
    slotDose:             { fontSize: 12, color: t.textSub, marginTop: 1 },
    slotNotes:            { fontSize: 11, color: t.textMuted, marginTop: 2, fontStyle: 'italic' },
    slotActions:          { flexDirection: 'row', gap: 6 },
    actionBtn:            { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
    takenBtn:             { backgroundColor: t.primary },
    takenBtnDisabled:     { backgroundColor: t.borderSub },
    takenBtnText:         { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    takenBtnTextDisabled: { color: t.textMuted },
    skipBtn:              { backgroundColor: t.bg, borderWidth: 1, borderColor: t.borderSub },
    skipBtnText:          { color: t.textSub, fontSize: 12, fontWeight: '600' },
    loggedBadge:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    loggedBadgeText:      { fontSize: 12, fontWeight: '700' },
  });
}
