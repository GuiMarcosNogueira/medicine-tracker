import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName } from '../../../src/stores/inventory.store';
import type { InventoryRow } from '../../../src/stores/inventory.store';
import { treatmentStore, addTreatment } from '../../../src/stores/treatment.store';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticMedium } from '../../../src/lib/haptics';
import { DatePickerField } from '../../../src/components/DatePickerField';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQ_PRESETS = [
  { label: '1x/dia', hours: 24 },
  { label: '2x/dia', hours: 12 },
  { label: '3x/dia', hours:  8 },
  { label: '4x/dia', hours:  6 },
  { label: '6x/dia', hours:  4 },
] as const;

const DOSE_UNITS = ['comprimido', 'cápsula', 'mL', 'gotas', 'mg', 'g'] as const;
type DoseUnit = typeof DOSE_UNITS[number];

// ─── Types ────────────────────────────────────────────────────────────────────

type MedDraft = {
  key: string;
  medicationName: string;
  inventoryItemId: string | null;
  activeIngredient: string | null;
  presentationDosage: string | null;
  pharmaFormFriendly: string | null;
  personName: string;
  doseQuantity: string;
  doseUnit: DoseUnit;
  frequencyHours: number | null;
  customFreqHours: string;
  showCustomFreq: boolean;
  firstDoseTime: string;
  startDate: string;
  durationDays: string;
  indefinite: boolean;
  notes: string;
};

type MedFormData = Omit<MedDraft, 'key'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatFreq(d: MedDraft): string {
  if (d.showCustomFreq) return `a cada ${d.customFreqHours}h`;
  const preset = FREQ_PRESETS.find(p => p.hours === d.frequencyHours);
  return preset?.label ?? `a cada ${String(d.frequencyHours ?? '?')}h`;
}

function formatCardDate(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parts = iso.split('-');
  return `${parts[2] ?? '??'}/${parts[1] ?? '??'}`;
}

// ─── ChipGroup ────────────────────────────────────────────────────────────────

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
  row:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D9CC' },
  chipActive:     { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  chipText:       { fontSize: 13, color: '#5A625A', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
});

// ─── MedicationSearch ─────────────────────────────────────────────────────────

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

  // Sync when parent resets the value (modal reopen)
  useEffect(() => { setQuery(value); }, [value]);

  const filtered = useMemo(() => {
    if (!query.trim() || !focused) return [];
    const q = normalize(query);
    return items.filter(item =>
      normalize(getItemDisplayName(item)).includes(q) ||
      (item.indications ?? []).some(ind => normalize(ind).includes(q))
    ).slice(0, 6);
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
              {item.presentation_dosage ? (
                <Text style={styles.suggestionMeta}>{item.presentation_dosage}</Text>
              ) : null}
              {!normalize(getItemDisplayName(item)).includes(normalize(query)) &&
                (item.indications ?? []).some(ind => normalize(ind).includes(normalize(query))) ? (
                <Text style={styles.suggestionIndication}>
                  {'↳ ' + (item.indications ?? []).filter(ind => normalize(ind).includes(normalize(query))).join(', ')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── MedFormModal ─────────────────────────────────────────────────────────────

function MedFormModal({
  visible,
  initial,
  defaultPersonName,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: MedDraft | null;
  defaultPersonName: string;
  onCancel: () => void;
  onConfirm: (data: MedFormData) => void;
}) {
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
  const [frequencyHours, setFrequencyHours] = useState<number | null>(8);
  const [customFreqHours, setCustomFreqHours] = useState('');
  const [showCustomFreq, setShowCustomFreq] = useState(false);
  const [firstDoseTime, setFirstDoseTime] = useState('08:00');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [durationDays, setDurationDays] = useState('7');
  const [indefinite, setInfinite] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset / pre-fill when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setMedicationName(initial.medicationName);
      setInventoryItemId(initial.inventoryItemId);
      setSnapshot({
        activeIngredient: initial.activeIngredient,
        presentationDosage: initial.presentationDosage,
        pharmaFormFriendly: initial.pharmaFormFriendly,
      });
      setPersonName(initial.personName);
      setDoseQuantity(initial.doseQuantity);
      setDoseUnit(initial.doseUnit);
      setFrequencyHours(initial.frequencyHours);
      setCustomFreqHours(initial.customFreqHours);
      setShowCustomFreq(initial.showCustomFreq);
      setFirstDoseTime(initial.firstDoseTime);
      setStartDate(initial.startDate);
      setDurationDays(initial.durationDays);
      setInfinite(initial.indefinite);
      setNotes(initial.notes);
    } else {
      setMedicationName('');
      setInventoryItemId(null);
      setSnapshot({ activeIngredient: null, presentationDosage: null, pharmaFormFriendly: null });
      setPersonName(defaultPersonName);
      setDoseQuantity('1');
      setDoseUnit('comprimido');
      setFrequencyHours(8);
      setCustomFreqHours('');
      setShowCustomFreq(false);
      setFirstDoseTime('08:00');
      setStartDate(getTodayDate());
      setDurationDays('7');
      setInfinite(false);
      setNotes('');
    }
    setErrors({});
  }, [visible]); // intentionally omits `initial` — parent sets it before opening

  function handleSelectItem(item: InventoryRow) {
    setMedicationName(getItemDisplayName(item));
    setInventoryItemId(item.id);
    setSnapshot({
      activeIngredient: item.active_ingredient,
      presentationDosage: item.presentation_dosage,
      pharmaFormFriendly: item.pharma_form_friendly,
    });
    const form = item.pharma_form_friendly?.toLowerCase() ?? '';
    if (form.includes('cápsula') || form.includes('capsula')) setDoseUnit('cápsula');
    else if (form.includes('comprimido')) setDoseUnit('comprimido');
    else if (form.includes('gota') || form.includes('solução oral') || form.includes('solucao oral')) setDoseUnit('gotas');
    else if (item.unit === 'ml') setDoseUnit('mL');
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errs['startDate'] = 'Data inválida.';
    if (!indefinite) {
      const dur = parseInt(durationDays, 10);
      if (isNaN(dur) || dur <= 0) errs['duration'] = 'Duração inválida.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleConfirm() {
    if (!validate()) return;
    onConfirm({
      medicationName: medicationName.trim(),
      inventoryItemId,
      activeIngredient: snapshot.activeIngredient,
      presentationDosage: snapshot.presentationDosage,
      pharmaFormFriendly: snapshot.pharmaFormFriendly,
      personName: personName.trim(),
      doseQuantity,
      doseUnit,
      frequencyHours: showCustomFreq ? null : frequencyHours,
      customFreqHours,
      showCustomFreq,
      firstDoseTime,
      startDate,
      durationDays,
      indefinite,
      notes,
    });
  }

  const isEditing = initial !== null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={modalStyles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={modalStyles.header}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={modalStyles.cancelText}>Cancelar</Text>
            </Pressable>
            <Text style={modalStyles.headerTitle}>Medicamento</Text>
            <Pressable onPress={handleConfirm} hitSlop={8}>
              <Text style={modalStyles.confirmText}>{isEditing ? 'Salvar' : 'Adicionar'}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={modalStyles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Medicamento *</Text>
            <MedicationSearch
              value={medicationName}
              onSelect={handleSelectItem}
              onCustom={name => {
                setMedicationName(name);
                setInventoryItemId(null);
                setSnapshot({ activeIngredient: null, presentationDosage: null, pharmaFormFriendly: null });
              }}
            />
            {errors['medication'] ? <Text style={styles.error}>{errors['medication']}</Text> : null}

            <Text style={[styles.label, styles.labelTop]}>Para quem *</Text>
            <TextInput
              style={styles.input}
              value={personName}
              onChangeText={setPersonName}
              placeholder="Nome da pessoa"
              placeholderTextColor="#9CA59C"
              autoCapitalize="words"
            />
            {errors['person'] ? <Text style={styles.error}>{errors['person']}</Text> : null}

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
            {errors['quantity'] ? <Text style={styles.error}>{errors['quantity']}</Text> : null}

            <Text style={[styles.label, styles.labelTop]}>Frequência *</Text>
            <ChipGroup
              options={FREQ_PRESETS.map(p => p.hours)}
              value={showCustomFreq ? null : frequencyHours}
              onChange={h => { setFrequencyHours(h); setShowCustomFreq(false); }}
              labelOf={h => FREQ_PRESETS.find(p => p.hours === h)?.label ?? `${h}h`}
            />
            <Pressable
              style={[chipStyles.chip, showCustomFreq && chipStyles.chipActive, styles.otherChip]}
              onPress={() => { setShowCustomFreq(!showCustomFreq); setFrequencyHours(null); }}
            >
              <Text style={[chipStyles.chipText, showCustomFreq && chipStyles.chipTextActive]}>Outro</Text>
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
            {errors['frequency'] ? <Text style={styles.error}>{errors['frequency']}</Text> : null}

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
            {errors['time'] ? <Text style={styles.error}>{errors['time']}</Text> : null}

            <DatePickerField
              label="Data de início"
              value={startDate}
              onChange={setStartDate}
              error={errors['startDate']}
            />

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
                <Text style={[chipStyles.chipText, indefinite && chipStyles.chipTextActive]}>Indefinido</Text>
              </Pressable>
            </View>
            {errors['duration'] ? <Text style={styles.error}>{errors['duration']}</Text> : null}

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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── MedDraftCard ─────────────────────────────────────────────────────────────

function MedDraftCard({
  draft,
  onEdit,
  onRemove,
}: {
  draft: MedDraft;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <Text style={cardStyles.name} numberOfLines={1}>{draft.medicationName}</Text>
        <View style={cardStyles.actions}>
          <Pressable onPress={onEdit} hitSlop={10} style={cardStyles.actionBtn}>
            <Text style={cardStyles.editIcon}>✏️</Text>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={10} style={cardStyles.actionBtn}>
            <Text style={cardStyles.removeIcon}>✕</Text>
          </Pressable>
        </View>
      </View>
      <Text style={cardStyles.meta}>Para: {draft.personName}</Text>
      <Text style={cardStyles.meta}>{draft.doseQuantity} {draft.doseUnit} · {formatFreq(draft)}</Text>
      <Text style={cardStyles.meta}>
        {formatCardDate(draft.startDate)} · {draft.indefinite ? 'Indefinido' : `${draft.durationDays} dias`}
      </Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card:      { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E8ECE5' },
  topRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  name:      { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1D1A' },
  actions:   { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 4 },
  editIcon:  { fontSize: 15 },
  removeIcon:{ fontSize: 14, color: '#F0735A', fontWeight: '700' },
  meta:      { fontSize: 13, color: '#5A625A', marginTop: 2 },
});

// ─── PrescriptionScreen ───────────────────────────────────────────────────────

export default function PrescriptionScreen() {
  const toast = useToast();
  const familyId = useSelector(treatmentStore.familyId) as string | null;

  const [defaultPerson, setDefaultPerson] = useState('');
  const [drafts, setDrafts]               = useState<MedDraft[]>([]);
  const [modalVisible, setModalVisible]   = useState(false);
  const [editingDraft, setEditingDraft]   = useState<MedDraft | null>(null);
  const [saving, setSaving]               = useState(false);

  function openNew() {
    setEditingDraft(null);
    setModalVisible(true);
  }

  function openEdit(draft: MedDraft) {
    setEditingDraft(draft);
    setModalVisible(true);
  }

  function removeDraft(key: string) {
    setDrafts(prev => prev.filter(d => d.key !== key));
  }

  function onModalConfirm(data: MedFormData) {
    const editing = editingDraft;
    if (editing !== null) {
      setDrafts(prev => prev.map(d =>
        d.key === editing.key ? { ...data, key: editing.key } : d
      ));
    } else {
      setDrafts(prev => [...prev, { ...data, key: Math.random().toString(36).slice(2) }]);
    }
    setModalVisible(false);
    setEditingDraft(null);
  }

  function onModalCancel() {
    setModalVisible(false);
    setEditingDraft(null);
  }

  async function handleSave() {
    if (drafts.length === 0) return;
    if (!familyId) { toast.show('error', 'Erro', 'Família não encontrada.'); return; }

    setSaving(true);
    const errs: string[] = [];

    for (const d of drafts) {
      const qty  = parseFloat(d.doseQuantity.replace(',', '.'));
      const freq = d.showCustomFreq ? parseInt(d.customFreqHours, 10) : (d.frequencyHours ?? 8);
      let endDate: string | null = null;
      if (!d.indefinite) {
        const start = new Date(d.startDate + 'T00:00:00');
        start.setDate(start.getDate() + parseInt(d.durationDays, 10) - 1);
        endDate = start.toISOString().slice(0, 10);
      }
      const err = await addTreatment({
        family_id:            familyId,
        person_name:          d.personName,
        inventory_item_id:    d.inventoryItemId,
        medication_name:      d.medicationName,
        active_ingredient:    d.activeIngredient,
        presentation_dosage:  d.presentationDosage,
        pharma_form_friendly: d.pharmaFormFriendly,
        dose_quantity:        qty,
        dose_unit:            d.doseUnit,
        frequency_hours:      freq,
        start_date:           d.startDate,
        end_date:             endDate,
        first_dose_time:      d.firstDoseTime,
        notes:                d.notes || null,
        status:               'active',
      });
      if (err) errs.push(`${d.medicationName}: ${err}`);
    }

    setSaving(false);

    if (errs.length === 0) {
      hapticMedium();
      toast.show('success', 'Receita salva', `${drafts.length} tratamento(s) iniciado(s).`);
      if (router.canGoBack()) router.back();
      else router.replace('/(app)/treatments');
    } else {
      toast.show('error', 'Erro ao salvar', errs.join('\n'));
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
        <Text style={styles.title}>Nova Receita</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Para quem é esta receita?</Text>
        <TextInput
          style={[styles.input, { marginBottom: 20 }]}
          value={defaultPerson}
          onChangeText={setDefaultPerson}
          placeholder="Nome da pessoa (pré-preenche cada medicamento)"
          placeholderTextColor="#9CA59C"
          autoCapitalize="words"
        />

        {drafts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhum medicamento</Text>
            <Text style={styles.emptySubtitle}>
              Adicione os medicamentos da receita um a um e salve tudo de uma vez.
            </Text>
          </View>
        ) : (
          drafts.map(d => (
            <MedDraftCard
              key={d.key}
              draft={d}
              onEdit={() => { openEdit(d); }}
              onRemove={() => { removeDraft(d.key); }}
            />
          ))
        )}

        <AnimatedPressable style={styles.addBtn} onPress={openNew}>
          <Text style={styles.addBtnText}>+ Adicionar medicamento</Text>
        </AnimatedPressable>

        {drafts.length > 0 && (
          <AnimatedPressable
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => { void handleSave(); }}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? 'Salvando...' : `Salvar receita (${drafts.length})`}
            </Text>
          </AnimatedPressable>
        )}
      </ScrollView>

      <MedFormModal
        visible={modalVisible}
        initial={editingDraft}
        defaultPersonName={defaultPerson}
        onCancel={onModalCancel}
        onConfirm={onModalConfirm}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container:    { flex: 1, backgroundColor: '#F6F8F5' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText:     { fontSize: 15, color: '#1A9E96', fontWeight: '600' },
  title:        { fontSize: 18, fontWeight: '700', color: '#1A1D1A' },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 16, paddingBottom: 48 },
  // Empty state
  emptyState:   { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: '#5A625A', marginBottom: 8 },
  emptySubtitle:{ fontSize: 13, color: '#9CA59C', textAlign: 'center', lineHeight: 20 },
  // Buttons
  addBtn:       { borderWidth: 1.5, borderColor: '#1A9E96', borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 12 },
  addBtnText:   { color: '#1A9E96', fontWeight: '700', fontSize: 15 },
  saveBtn:      { backgroundColor: '#1A9E96', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  // Form elements (shared with MedFormModal)
  label:        { fontSize: 13, fontWeight: '700', color: '#5A625A', marginBottom: 6 },
  labelTop:     { marginTop: 20 },
  input:        { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputDisabled:{ opacity: 0.4 },
  qtyInput:     { width: 70, marginRight: 10 },
  notesInput:   { height: 80, paddingTop: 12 },
  row:          { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  unit:         { fontSize: 14, color: '#5A625A', marginRight: 4 },
  otherChip:    { marginTop: 8 },
  suggestions:  { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  suggestionRow:{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F2EF' },
  suggestionName:{ fontSize: 14, fontWeight: '600', color: '#1A1D1A' },
  suggestionMeta:       { fontSize: 12, color: '#1A9E96', marginTop: 1 },
  suggestionIndication: { fontSize: 11, color: '#9CA59C', marginTop: 1 },
  error:        { color: '#F0735A', fontSize: 12, marginTop: 4 },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F5' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8ECE5', backgroundColor: '#FFFFFF' },
  headerTitle:{ fontSize: 16, fontWeight: '700', color: '#1A1D1A' },
  cancelText: { fontSize: 15, color: '#9CA59C', fontWeight: '600' },
  confirmText:{ fontSize: 15, color: '#1A9E96', fontWeight: '700' },
  content:   { padding: 16, paddingBottom: 48 },
});
