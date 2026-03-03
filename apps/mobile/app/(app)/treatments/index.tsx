import { useState, useMemo, useCallback, useRef } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import {
  treatmentStore,
  softDeleteTreatment,
  refreshTreatments,
} from '../../../src/stores/treatment.store';
import type { TreatmentRow, TreatmentDoseRow } from '../../../src/stores/treatment.store';
import {
  formatFrequency,
  formatDoseTime,
  daysRemaining,
  getTodaySlots,
} from '../../../src/utils/treatment';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

// suppress unused import warning — formatDoseTime is used in DoseSlotRow (shared component)
void formatDoseTime;

// ─── Treatment list row ───────────────────────────────────────────────────────

function TreatmentRow({
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

  // Today's progress for this treatment
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

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TreatmentsScreen() {
  const toast         = useToast();
  const rawTreatments = useSelector(treatmentStore.treatments);
  const rawTodayDoses = useSelector(treatmentStore.todayDoses);
  const loading       = useSelector(treatmentStore.loading);
  const familyId      = useSelector(treatmentStore.familyId);
  const treatments    = rawTreatments as TreatmentRow[];
  const todayDoses    = rawTodayDoses as TreatmentDoseRow[];
  const [refreshing, setRefreshing] = useState(false);

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
              todayDoses={todayDoses}
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

  // Treatment list rows
  treatmentItem:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF' },
  treatmentContent: { flex: 1 },
  treatmentName:    { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  treatmentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  treatmentMeta:    { fontSize: 12, color: '#5A625A' },
  chevron:          { fontSize: 20, color: '#9CA59C', marginLeft: 8 },

  progressPill:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  progressPillText: { fontSize: 11, fontWeight: '700' },

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
