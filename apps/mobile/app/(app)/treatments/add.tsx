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
import { AnimatedPressable, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
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
  const theme = useTheme();
  const cs = useMemo(() => chipStyles(theme), [theme]);
  return (
    <View style={cs.row}>
      {options.map(opt => (
        <Pressable
          key={String(opt)}
          style={[cs.chip, value === opt && cs.chipActive]}
          onPress={() => { onChange(opt); }}
        >
          <Text style={[cs.chipText, value === opt && cs.chipTextActive]}>
            {labelOf(opt)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

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
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

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
        style={s.input}
        value={query}
        onChangeText={text => { setQuery(text); onCustom(text); }}
        onFocus={() => { setFocused(true); }}
        onBlur={() => { setTimeout(() => { setFocused(false); }, 150); }}
        placeholder="Buscar no estoque ou digitar nome..."
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
      />
      {filtered.length > 0 && (
        <View style={s.suggestions}>
          {filtered.map(item => (
            <Pressable
              key={item.id}
              style={s.suggestionRow}
              onPress={() => {
                setQuery(getItemDisplayName(item));
                setFocused(false);
                onSelect(item);
              }}
            >
              <Text style={s.suggestionName}>{getItemDisplayName(item)}</Text>
              {item.presentation_dosage ? (
                <Text style={s.suggestionMeta}>{item.presentation_dosage}</Text>
              ) : null}
              {!normalize(getItemDisplayName(item)).includes(normalize(query)) &&
                (item.indications ?? []).some(ind => normalize(ind).includes(normalize(query))) ? (
                <Text style={s.suggestionIndication}>
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
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const ms = useMemo(() => modalStyles(theme), [theme]);
  const cs = useMemo(() => chipStyles(theme), [theme]);

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
      <SafeAreaView style={ms.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={ms.header}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={ms.cancelText}>Cancelar</Text>
            </Pressable>
            <Text style={ms.headerTitle}>Medicamento</Text>
            <Pressable onPress={handleConfirm} hitSlop={8}>
              <Text style={ms.confirmText}>{isEditing ? 'Salvar' : 'Adicionar'}</Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={ms.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={s.label}>Medicamento *</Text>
            <MedicationSearch
              value={medicationName}
              onSelect={handleSelectItem}
              onCustom={name => {
                setMedicationName(name);
                setInventoryItemId(null);
                setSnapshot({ activeIngredient: null, presentationDosage: null, pharmaFormFriendly: null });
              }}
            />
            {errors['medication'] ? <Text style={s.error}>{errors['medication']}</Text> : null}

            <Text style={[s.label, s.labelTop]}>Para quem *</Text>
            <TextInput
              style={s.input}
              value={personName}
              onChangeText={setPersonName}
              placeholder="Nome da pessoa"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="words"
            />
            {errors['person'] ? <Text style={s.error}>{errors['person']}</Text> : null}

            <Text style={[s.label, s.labelTop]}>Quantidade por dose *</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, s.qtyInput]}
                value={doseQuantity}
                onChangeText={setDoseQuantity}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={theme.textMuted}
              />
              <ChipGroup
                options={DOSE_UNITS}
                value={doseUnit}
                onChange={setDoseUnit}
                labelOf={v => v}
              />
            </View>
            {errors['quantity'] ? <Text style={s.error}>{errors['quantity']}</Text> : null}

            <Text style={[s.label, s.labelTop]}>Frequência *</Text>
            <ChipGroup
              options={FREQ_PRESETS.map(p => p.hours)}
              value={showCustomFreq ? null : frequencyHours}
              onChange={h => { setFrequencyHours(h); setShowCustomFreq(false); }}
              labelOf={h => FREQ_PRESETS.find(p => p.hours === h)?.label ?? `${h}h`}
            />
            <Pressable
              style={[cs.chip, showCustomFreq && cs.chipActive, s.otherChip]}
              onPress={() => { setShowCustomFreq(!showCustomFreq); setFrequencyHours(null); }}
            >
              <Text style={[cs.chipText, showCustomFreq && cs.chipTextActive]}>Outro</Text>
            </Pressable>
            {showCustomFreq && (
              <TextInput
                style={[s.input, s.labelTop]}
                value={customFreqHours}
                onChangeText={setCustomFreqHours}
                keyboardType="number-pad"
                placeholder="Intervalo em horas (ex: 6)"
                placeholderTextColor={theme.textMuted}
              />
            )}
            {errors['frequency'] ? <Text style={s.error}>{errors['frequency']}</Text> : null}

            <Text style={[s.label, s.labelTop]}>Primeiro horário *</Text>
            <TextInput
              style={s.input}
              value={firstDoseTime}
              onChangeText={setFirstDoseTime}
              placeholder="08:00"
              placeholderTextColor={theme.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            {errors['time'] ? <Text style={s.error}>{errors['time']}</Text> : null}

            <DatePickerField
              label="Data de início"
              value={startDate}
              onChange={setStartDate}
              error={errors['startDate']}
            />

            <Text style={[s.label, s.labelTop]}>Duração</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, s.qtyInput, indefinite && s.inputDisabled]}
                value={durationDays}
                onChangeText={setDurationDays}
                keyboardType="number-pad"
                placeholder="7"
                placeholderTextColor={theme.textMuted}
                editable={!indefinite}
              />
              <Text style={s.unit}>dias</Text>
              <Pressable
                style={[cs.chip, indefinite && cs.chipActive]}
                onPress={() => { setInfinite(!indefinite); }}
              >
                <Text style={[cs.chipText, indefinite && cs.chipTextActive]}>Indefinido</Text>
              </Pressable>
            </View>
            {errors['duration'] ? <Text style={s.error}>{errors['duration']}</Text> : null}

            <Text style={[s.label, s.labelTop]}>Observações</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Opcional"
              placeholderTextColor={theme.textMuted}
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
  const theme = useTheme();
  const cs = useMemo(() => cardStyles(theme), [theme]);
  return (
    <View style={cs.card}>
      <View style={cs.topRow}>
        <Text style={cs.name} numberOfLines={1}>{draft.medicationName}</Text>
        <View style={cs.actions}>
          <Pressable onPress={onEdit} hitSlop={10} style={cs.actionBtn}>
            <Text style={cs.editIcon}>✏️</Text>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={10} style={cs.actionBtn}>
            <Text style={cs.removeIcon}>✕</Text>
          </Pressable>
        </View>
      </View>
      <Text style={cs.meta}>Para: {draft.personName}</Text>
      <Text style={cs.meta}>{draft.doseQuantity} {draft.doseUnit} · {formatFreq(draft)}</Text>
      <Text style={cs.meta}>
        {formatCardDate(draft.startDate)} · {draft.indefinite ? 'Indefinido' : `${draft.durationDays} dias`}
      </Text>
    </View>
  );
}

// ─── PrescriptionScreen ───────────────────────────────────────────────────────

export default function PrescriptionScreen() {
  const toast = useToast();
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
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
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <AnimatedPressable onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(app)/treatments');
        }}>
          <Text style={s.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={s.title}>Nova Receita</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.label}>Para quem é esta receita?</Text>
        <TextInput
          style={[s.input, { marginBottom: 20 }]}
          value={defaultPerson}
          onChangeText={setDefaultPerson}
          placeholder="Nome da pessoa (pré-preenche cada medicamento)"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="words"
        />

        {drafts.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>Nenhum medicamento</Text>
            <Text style={s.emptySubtitle}>
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

        <AnimatedPressable style={s.addBtn} onPress={openNew}>
          <Text style={s.addBtnText}>+ Adicionar medicamento</Text>
        </AnimatedPressable>

        {drafts.length > 0 && (
          <AnimatedPressable
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={() => { void handleSave(); }}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>
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

function chipStyles(t: Theme) {
  return StyleSheet.create({
    row:            { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip:           { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderSub },
    chipActive:     { backgroundColor: t.primary, borderColor: t.primary },
    chipText:       { fontSize: 13, color: t.textSub, fontWeight: '600' },
    chipTextActive: { color: '#FFFFFF' },
  });
}

function cardStyles(t: Theme) {
  return StyleSheet.create({
    card:      { backgroundColor: t.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.surfaceAlt },
    topRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    name:      { flex: 1, fontSize: 15, fontWeight: '700', color: t.text },
    actions:   { flexDirection: 'row', gap: 8 },
    actionBtn: { padding: 4 },
    editIcon:  { fontSize: 15 },
    removeIcon:{ fontSize: 14, color: t.coral, fontWeight: '700' },
    meta:      { fontSize: 13, color: t.textSub, marginTop: 2 },
  });
}

function styles(t: Theme) {
  return StyleSheet.create({
    // Layout
    container:    { flex: 1, backgroundColor: t.bg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
    backText:     { fontSize: 15, color: t.primary, fontWeight: '600' },
    title:        { fontSize: 18, fontWeight: '700', color: t.text, fontFamily: fonts.heading },
    scroll:       { flex: 1 },
    scrollContent:{ padding: 16, paddingBottom: 48 },
    // Empty state
    emptyState:   { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
    emptyTitle:   { fontSize: 16, fontWeight: '700', color: t.textSub, marginBottom: 8 },
    emptySubtitle:{ fontSize: 13, color: t.textMuted, textAlign: 'center', lineHeight: 20 },
    // Buttons
    addBtn:       { borderWidth: 1.5, borderColor: t.primary, borderStyle: 'dashed', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 4, marginBottom: 12 },
    addBtnText:   { color: t.primary, fontWeight: '700', fontSize: 15 },
    saveBtn:      { backgroundColor: t.primary, borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 4 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText:  { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
    // Form elements (shared with MedFormModal)
    label:        { fontSize: 13, fontWeight: '700', color: t.textSub, marginBottom: 6 },
    labelTop:     { marginTop: 20 },
    input:        { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, fontSize: 15, backgroundColor: t.surface, color: t.text },
    inputDisabled:{ opacity: 0.4 },
    qtyInput:     { width: 70, marginRight: 10 },
    notesInput:   { height: 80, paddingTop: 12 },
    row:          { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    unit:         { fontSize: 14, color: t.textSub, marginRight: 4 },
    otherChip:    { marginTop: 8 },
    suggestions:  { backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderSub, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
    suggestionRow:{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt },
    suggestionName:{ fontSize: 14, fontWeight: '600', color: t.text },
    suggestionMeta:       { fontSize: 12, color: t.primary, marginTop: 1 },
    suggestionIndication: { fontSize: 11, color: t.textMuted, marginTop: 1 },
    error:        { color: t.coral, fontSize: 12, marginTop: 4 },
  });
}

function modalStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt, backgroundColor: t.surface },
    headerTitle:{ fontSize: 16, fontWeight: '700', color: t.text },
    cancelText: { fontSize: 15, color: t.textMuted, fontWeight: '600' },
    confirmText:{ fontSize: 15, color: t.primary, fontWeight: '700' },
    content:   { padding: 16, paddingBottom: 48 },
  });
}
