import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName } from '../../../src/stores/inventory.store';
import type { InventoryRow } from '../../../src/stores/inventory.store';
import { treatmentStore, addTreatment } from '../../../src/stores/treatment.store';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';

// ─── Frequency presets ────────────────────────────────────────────────────────

const FREQ_PRESETS = [
  { label: '1x/dia', hours: 24 },
  { label: '2x/dia', hours: 12 },
  { label: '3x/dia', hours: 8 },
  { label: '4x/dia', hours: 6 },
  { label: '6x/dia', hours: 4 },
] as const;

const DOSE_UNITS = ['comprimido', 'cápsula', 'mL', 'mg', 'g'] as const;
type DoseUnit = typeof DOSE_UNITS[number];

// ─── Field chip selector ──────────────────────────────────────────────────────

function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  labelOf,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
}) {
  return (
    <View style={chipStyles.row}>
      {options.map(opt => (
        <Pressable
          key={String(opt)}
          style={[chipStyles.chip, value === opt && chipStyles.chipActive]}
          onPress={() => { onChange(opt); }}
        >
          <Text style={[chipStyles.chipText, value === opt && chipStyles.chipTextActive]}>
            {labelOf(opt)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  row:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D9CC' },
  chipActive:    { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  chipText:      { fontSize: 13, color: '#5A625A', fontWeight: '600' },
  chipTextActive:{ color: '#FFFFFF' },
});

// ─── Medication search ────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function MedicationSearch({
  value,
  onSelect,
  onCustom,
}: {
  value: string;
  onSelect: (item: InventoryRow) => void;
  onCustom: (name: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [focused, setFocused] = useState(false);
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];

  const filtered = useMemo(() => {
    if (!query.trim() || !focused) return [];
    const q = normalize(query);
    return items.filter(item => normalize(getItemDisplayName(item)).includes(q)).slice(0, 6);
  }, [items, query, focused]);

  return (
    <View>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={text => { setQuery(text); onCustom(text); }}
        onFocus={() => { setFocused(true); }}
        onBlur={() => { setTimeout(() => { setFocused(false); }, 150); }}
        placeholder="Buscar no estoque ou digitar nome..."
        placeholderTextColor="#9CA59C"
        autoCapitalize="none"
      />
      {filtered.length > 0 && (
        <View style={styles.suggestions}>
          {filtered.map(item => (
            <Pressable
              key={item.id}
              style={styles.suggestionRow}
              onPress={() => {
                setQuery(getItemDisplayName(item));
                setFocused(false);
                onSelect(item);
              }}
            >
              <Text style={styles.suggestionName}>{getItemDisplayName(item)}</Text>
              {item.presentation_dosage && (
                <Text style={styles.suggestionMeta}>{item.presentation_dosage}</Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AddTreatmentScreen() {
  const toast = useToast();
  const familyId = useSelector(treatmentStore.familyId) as string | null;

  // Form state
  const [medicationName, setMedicationName] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    activeIngredient: string | null;
    presentationDosage: string | null;
    pharmaFormFriendly: string | null;
  }>({ activeIngredient: null, presentationDosage: null, pharmaFormFriendly: null });

  const [personName, setPersonName] = useState('');
  const [doseQuantity, setDoseQuantity] = useState('1');
  const [doseUnit, setDoseUnit] = useState<DoseUnit>('comprimido');
  const [frequencyHours, setFrequencyHours] = useState<number | null>(8); // default 3x/dia
  const [customFreqHours, setCustomFreqHours] = useState('');
  const [showCustomFreq, setShowCustomFreq] = useState(false);
  const [firstDoseTime, setFirstDoseTime] = useState('08:00');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [durationDays, setDurationDays] = useState('7');
  const [indefinite, setInfinite] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function handleSelectInventoryItem(item: InventoryRow) {
    setMedicationName(getItemDisplayName(item));
    setInventoryItemId(item.id);
    setSnapshot({
      activeIngredient: item.active_ingredient,
      presentationDosage: item.presentation_dosage,
      pharmaFormFriendly: item.pharma_form_friendly,
    });
    // Auto-set dose unit from pharma form
    if (item.pharma_form_friendly?.toLowerCase().includes('cápsula') ||
        item.pharma_form_friendly?.toLowerCase().includes('capsula')) {
      setDoseUnit('cápsula');
    } else if (item.pharma_form_friendly?.toLowerCase().includes('comprimido')) {
      setDoseUnit('comprimido');
    } else if (item.unit === 'ml') {
      setDoseUnit('mL');
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!medicationName.trim()) errs['medication'] = 'Informe o medicamento.';
    if (!personName.trim()) errs['person'] = 'Informe o nome da pessoa.';
    const qty = parseFloat(doseQuantity.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) errs['quantity'] = 'Quantidade inválida.';
    const finalFreq = showCustomFreq ? parseInt(customFreqHours, 10) : frequencyHours;
    if (!finalFreq || finalFreq <= 0) errs['frequency'] = 'Selecione a frequência.';
    if (!/^\d{2}:\d{2}$/.test(firstDoseTime)) errs['time'] = 'Horário inválido (HH:MM).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errs['startDate'] = 'Data inválida (AAAA-MM-DD).';
    if (!indefinite) {
      const dur = parseInt(durationDays, 10);
      if (isNaN(dur) || dur <= 0) errs['duration'] = 'Duração inválida.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!familyId) { toast.show('error', 'Erro', 'Família não encontrada.'); return; }

    hapticMedium();
    setLoading(true);

    const qty = parseFloat(doseQuantity.replace(',', '.'));
    const finalFreq = showCustomFreq
      ? parseInt(customFreqHours, 10)
      : (frequencyHours ?? 8);

    let endDate: string | null = null;
    if (!indefinite) {
      const start = new Date(startDate + 'T00:00:00');
      start.setDate(start.getDate() + parseInt(durationDays, 10) - 1);
      endDate = start.toISOString().slice(0, 10);
    }

    const err = await addTreatment({
      family_id:           familyId,
      person_name:         personName.trim(),
      inventory_item_id:   inventoryItemId,
      medication_name:     medicationName.trim(),
      active_ingredient:   snapshot.activeIngredient,
      presentation_dosage: snapshot.presentationDosage,
      pharma_form_friendly:snapshot.pharmaFormFriendly,
      dose_quantity:       qty,
      dose_unit:           doseUnit,
      frequency_hours:     finalFreq,
      start_date:          startDate,
      end_date:            endDate,
      first_dose_time:     firstDoseTime,
      notes:               notes.trim() || null,
      status:              'active',
    });

    setLoading(false);

    if (err) {
      toast.show('error', 'Erro', err);
    } else {
      toast.show('success', 'Tratamento iniciado', 'Lembretes agendados.');
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/treatments');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/treatments');
        }}>
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={styles.title}>Novo tratamento</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Medicamento */}
        <Text style={styles.label}>Medicamento *</Text>
        <MedicationSearch
          value={medicationName}
          onSelect={handleSelectInventoryItem}
          onCustom={name => {
            setMedicationName(name);
            setInventoryItemId(null);
            setSnapshot({ activeIngredient: null, presentationDosage: null, pharmaFormFriendly: null });
          }}
        />
        {errors['medication'] && <Text style={styles.error}>{errors['medication']}</Text>}

        {/* Para quem */}
        <Text style={[styles.label, styles.labelTop]}>Para quem *</Text>
        <TextInput
          style={styles.input}
          value={personName}
          onChangeText={setPersonName}
          placeholder="Nome da pessoa"
          placeholderTextColor="#9CA59C"
          autoCapitalize="words"
        />
        {errors['person'] && <Text style={styles.error}>{errors['person']}</Text>}

        {/* Dose */}
        <Text style={[styles.label, styles.labelTop]}>Quantidade por dose *</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.qtyInput]}
            value={doseQuantity}
            onChangeText={setDoseQuantity}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor="#9CA59C"
          />
          <ChipGroup
            options={DOSE_UNITS}
            value={doseUnit}
            onChange={setDoseUnit}
            labelOf={v => v}
          />
        </View>
        {errors['quantity'] && <Text style={styles.error}>{errors['quantity']}</Text>}

        {/* Frequência */}
        <Text style={[styles.label, styles.labelTop]}>Frequência *</Text>
        <ChipGroup
          options={FREQ_PRESETS.map(p => p.hours)}
          value={showCustomFreq ? null : frequencyHours}
          onChange={h => {
            setFrequencyHours(h);
            setShowCustomFreq(false);
          }}
          labelOf={h => FREQ_PRESETS.find(p => p.hours === h)?.label ?? `${h}h`}
        />
        <Pressable
          style={[chipStyles.chip, showCustomFreq && chipStyles.chipActive, styles.otherChip]}
          onPress={() => { setShowCustomFreq(!showCustomFreq); setFrequencyHours(null); }}
        >
          <Text style={[chipStyles.chipText, showCustomFreq && chipStyles.chipTextActive]}>
            Outro
          </Text>
        </Pressable>
        {showCustomFreq && (
          <TextInput
            style={[styles.input, styles.labelTop]}
            value={customFreqHours}
            onChangeText={setCustomFreqHours}
            keyboardType="number-pad"
            placeholder="Intervalo em horas (ex: 6)"
            placeholderTextColor="#9CA59C"
          />
        )}
        {errors['frequency'] && <Text style={styles.error}>{errors['frequency']}</Text>}

        {/* Primeiro horário */}
        <Text style={[styles.label, styles.labelTop]}>Primeiro horário *</Text>
        <TextInput
          style={styles.input}
          value={firstDoseTime}
          onChangeText={setFirstDoseTime}
          placeholder="08:00"
          placeholderTextColor="#9CA59C"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        {errors['time'] && <Text style={styles.error}>{errors['time']}</Text>}

        {/* Data de início */}
        <Text style={[styles.label, styles.labelTop]}>Data de início</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="AAAA-MM-DD"
          placeholderTextColor="#9CA59C"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        {errors['startDate'] && <Text style={styles.error}>{errors['startDate']}</Text>}

        {/* Duração */}
        <Text style={[styles.label, styles.labelTop]}>Duração</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.qtyInput, indefinite && styles.inputDisabled]}
            value={durationDays}
            onChangeText={setDurationDays}
            keyboardType="number-pad"
            placeholder="7"
            placeholderTextColor="#9CA59C"
            editable={!indefinite}
          />
          <Text style={styles.unit}>dias</Text>
          <Pressable
            style={[chipStyles.chip, indefinite && chipStyles.chipActive]}
            onPress={() => { setInfinite(!indefinite); }}
          >
            <Text style={[chipStyles.chipText, indefinite && chipStyles.chipTextActive]}>
              Sem prazo
            </Text>
          </Pressable>
        </View>
        {errors['duration'] && <Text style={styles.error}>{errors['duration']}</Text>}

        {/* Observações */}
        <Text style={[styles.label, styles.labelTop]}>Observações</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Opcional"
          placeholderTextColor="#9CA59C"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Save button */}
        <AnimatedPressable
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={loading}
        >
          <Text style={styles.saveBtnText}>
            {loading ? 'Salvando...' : 'Iniciar tratamento'}
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F8F5' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText:        { fontSize: 15, color: '#1A9E96', fontWeight: '600' },
  title:           { fontSize: 18, fontWeight: '700', color: '#1A1D1A' },
  scroll:          { flex: 1 },
  scrollContent:   { padding: 16, paddingBottom: 40 },
  label:           { fontSize: 13, fontWeight: '700', color: '#5A625A', marginBottom: 6 },
  labelTop:        { marginTop: 20 },
  input:           { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputDisabled:   { opacity: 0.4 },
  qtyInput:        { width: 70, marginRight: 10 },
  notesInput:      { height: 80, paddingTop: 12 },
  row:             { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  unit:            { fontSize: 14, color: '#5A625A', marginRight: 4 },
  otherChip:       { marginTop: 8 },
  suggestions:     { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  suggestionRow:   { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2EF' },
  suggestionName:  { fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  suggestionMeta:  { fontSize: 12, color: '#1A9E96', marginTop: 1 },
  saveBtn:         { backgroundColor: '#1A9E96', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 32 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  error:           { color: '#F0735A', fontSize: 12, marginTop: 4 },
});
