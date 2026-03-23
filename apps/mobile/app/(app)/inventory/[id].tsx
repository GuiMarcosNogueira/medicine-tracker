import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import {
  inventoryStore,
  getItemDisplayName,
  softDeleteItem,
  logConsumption,
} from '../../../src/stores/inventory.store';
import type { InventoryRow } from '../../../src/stores/inventory.store';
import { supabase } from '../../../src/lib/supabase';
import { inventoryItemSchema } from '@medstock/shared';
import type { InventoryUnit } from '@medstock/shared';
import {
  getExpiryStatus,
  formatExpiryDate,
  daysUntilExpiry,
  EXPIRY_COLORS,
  EXPIRY_LABELS,
} from '../../../src/utils/expiry';
import { AnimatedPressable, ConfirmDialog, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
import { hapticSuccess, hapticError, hapticMedium } from '../../../src/lib/haptics';
import { DatePickerField } from '../../../src/components/DatePickerField';
import { TagInput } from '../../../src/components/TagInput';
import { treatmentStore } from '../../../src/stores/treatment.store';
import type { TreatmentRow } from '../../../src/stores/treatment.store';
import { formatFrequency } from '../../../src/utils/treatment';

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

type ConsumptionRow = {
  id: string;
  consumed_qty: number;
  person_name: string | null;
  consumed_at: string;
};

function formatConsumedAt(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

export default function InventoryItemDetailScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];
  const item = items.find(i => i.id === id) ?? null;

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('un');
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [indications, setIndications] = useState<string[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  // Consume mode state
  const [consuming, setConsuming] = useState(false);
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeUnit, setConsumeUnit] = useState<'item' | 'gotas'>('item');
  const [consumePerson, setConsumePerson] = useState('');
  const [consumeLoading, setConsumeLoading] = useState(false);

  // Treatments linked to this item
  const rawActive    = useSelector(treatmentStore.treatments);
  const rawPaused    = useSelector(treatmentStore.pausedTreatments);
  const rawCompleted = useSelector(treatmentStore.completedTreatments);
  const linkedTreatments = useMemo<TreatmentRow[]>(() => {
    const all = [
      ...(rawActive    as TreatmentRow[]),
      ...(rawPaused    as TreatmentRow[]),
      ...(rawCompleted as TreatmentRow[]),
    ];
    return all.filter(t => t.inventory_item_id === id);
  }, [rawActive, rawPaused, rawCompleted, id]);

  // Consumption history
  const [consumptions, setConsumptions] = useState<ConsumptionRow[]>([]);
  const [historyKey, setHistoryKey] = useState(0); // bump to reload

  const loadHistory = useCallback(() => {
    if (!id) return;
    void supabase
      .from('inventory_consumptions')
      .select('id, consumed_qty, person_name, consumed_at')
      .eq('item_id', id)
      .order('consumed_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setConsumptions(data as ConsumptionRow[]); });
  }, [id]);

  useEffect(() => { loadHistory(); }, [loadHistory, historyKey]);

  function startEdit() {
    if (!item) return;
    setExpiryDate(item.expiry_date);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setLotNumber(item.lot_number ?? '');
    setLocation(item.location ?? '');
    const existing = item.indications ?? [];
    setIndications(existing);
    setEditing(true);

    // Auto-fetch when item has no indications yet
    const nameForLookup = item.product_name ?? item.custom_name;
    if (existing.length === 0 && (item.active_ingredient ?? nameForLookup)) {
      setLoadingIndications(true);
      supabase.functions
        .invoke('get-indications', {
          body: { productName: nameForLookup ?? '', activeIngredient: item.active_ingredient ?? '' },
        })
        .then(({ data, error }) => {
          if (error) { console.warn('[get-indications] edit error:', error); return; }
          const result = data as { indications?: unknown } | null;
          if (Array.isArray(result?.indications)) {
            setIndications(result.indications as string[]);
          }
        })
        .catch((e: unknown) => { console.error('[get-indications] edit catch:', e); })
        .finally(() => { setLoadingIndications(false); });
    }
  }

  async function handleSave() {
    if (!item) return;
    const parseResult = inventoryItemSchema.safeParse({
      ...(item.medication_id ? { medicationId: item.medication_id } : {}),
      ...(item.custom_name   ? { customName:   item.custom_name   } : {}),
      expiryDate: expiryDate.trim(),
      quantity:   Number(quantity),
      unit,
      ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
      ...(location.trim()  ? { location:  location.trim()  } : {}),
    });

    if (!parseResult.success) {
      toast.show('error', 'Dados inválidos', parseResult.error.errors[0]?.message ?? 'Verifique os campos');
      hapticError();
      return;
    }

    setLoading(true);
    const d = parseResult.data;
    const { error } = await supabase
      .from('inventory_items')
      .update({
        expiry_date: d.expiryDate,
        quantity:    d.quantity,
        unit:        d.unit,
        lot_number:  d.lotNumber ?? null,
        location:    d.location ?? null,
        indications,
      })
      .eq('id', item.id);

    setLoading(false);
    if (error) {
      toast.show('error', 'Erro', error.message);
      hapticError();
      return;
    }
    hapticSuccess();

    // Optimistically update the store so re-entering edit mode sees the saved indications
    const idx = inventoryStore.items.get().findIndex(i => i.id === item.id);
    if (idx >= 0) {
      inventoryStore.items[idx]?.indications.set(indications);
    }

    // Se o usuário salvou com quantidade zero, remover item automaticamente
    if (d.quantity === 0) {
      void softDeleteItem(item.id);
      toast.show('success', 'Esgotado', `${getItemDisplayName(item)} removido — estoque zerado.`);
      router.back();
      return;
    }

    toast.show('success', 'Salvo!', 'Alterações salvas com sucesso.');
    setEditing(false);
  }

  async function confirmDelete() {
    if (!item) return;
    setDeleteVisible(false);
    const err = await softDeleteItem(item.id);
    if (err) {
      toast.show('error', 'Erro', err);
      hapticError();
    } else {
      hapticSuccess();
      toast.show('success', 'Removido', 'Item removido do estoque.');
      router.back();
    }
  }

  // 1 gota = 0,05 mL (20 gotas = 1 mL — padrão farmacêutico BR)
  const DROPS_TO_ML = 0.05;

  async function handleConsume() {
    if (!item) return;
    const rawQty = parseFloat(consumeQty.replace(',', '.'));
    if (isNaN(rawQty) || rawQty <= 0) {
      toast.show('error', 'Quantidade inválida', 'Informe um valor maior que zero.');
      hapticError();
      return;
    }

    // Convert drops → mL for inventory deduction when item is stored in ml
    const qty = consumeUnit === 'gotas' ? rawQty * DROPS_TO_ML : rawQty;

    setConsumeLoading(true);
    hapticMedium();
    const result = await logConsumption(
      item.id,
      qty,
      consumePerson.trim() || null,
      null,
    );
    setConsumeLoading(false);

    if (result.error) {
      toast.show('error', 'Erro', result.error);
      hapticError();
      return;
    }

    hapticSuccess();

    if (result.autoRemoved) {
      toast.show('success', 'Esgotado', `${getItemDisplayName(item)} removido — estoque zerado.`);
      router.back();
      return;
    }

    toast.show('success', 'Registrado!', 'Uso registrado e estoque atualizado.');
    setConsuming(false);
    setConsumeQty('1');
    setConsumeUnit('item');
    setConsumePerson('');
    setHistoryKey(k => k + 1); // recarrega histórico
  }

  if (!item) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const status = getExpiryStatus(item.expiry_date);
  const days   = daysUntilExpiry(item.expiry_date);

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <AnimatedPressable onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/inventory');
          }}>
            <Text style={s.backText}>← Voltar</Text>
          </AnimatedPressable>
          {!editing && !consuming && (
            <View style={s.topActions}>
              <AnimatedPressable
                onPress={() => { setConsuming(true); }}
                style={s.consumeBtn}
              >
                <Text style={s.consumeBtnText}>Registrar uso</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={startEdit} style={s.editBtn}>
                <Text style={s.editBtnText}>Editar</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => { setDeleteVisible(true); }} style={s.deleteBtn}>
                <Text style={s.deleteBtnText}>Remover</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {/* ── Item header ──────────────────────────────────────────────────── */}
        <Text style={s.itemName}>{getItemDisplayName(item)}</Text>
        {Boolean(item.active_ingredient) && (
          <Text style={s.itemSub}>{item.active_ingredient}</Text>
        )}
        <View style={[s.statusBadge, { backgroundColor: EXPIRY_COLORS[status] + '20' }]}>
          <Text style={[s.statusText, { color: EXPIRY_COLORS[status] }]}>
            {EXPIRY_LABELS[status]}{days >= 0 ? ` (${days} dias)` : ''}
          </Text>
        </View>

        {/* ── Consume form (inline) ────────────────────────────────────────── */}
        {consuming && (
          <Animated.View entering={FadeInDown.springify()} style={s.consumeForm}>
            <Text style={s.consumeFormTitle}>Registrar uso</Text>
            <View style={s.consumeRow}>
              <View style={s.consumeQtyField}>
                <Text style={s.label}>Quantidade</Text>
                <View style={s.consumeQtyRow}>
                  <TextInput
                    style={s.consumeQtyInput}
                    value={consumeQty}
                    onChangeText={setConsumeQty}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    autoFocus
                  />
                  {item.unit === 'ml' ? (
                    <View style={s.unitToggle}>
                      <Pressable
                        style={[s.unitToggleBtn, consumeUnit === 'item' && s.unitToggleBtnActive]}
                        onPress={() => { setConsumeUnit('item'); }}
                      >
                        <Text style={[s.unitToggleTxt, consumeUnit === 'item' && s.unitToggleTxtActive]}>mL</Text>
                      </Pressable>
                      <Pressable
                        style={[s.unitToggleBtn, consumeUnit === 'gotas' && s.unitToggleBtnActive]}
                        onPress={() => { setConsumeUnit('gotas'); }}
                      >
                        <Text style={[s.unitToggleTxt, consumeUnit === 'gotas' && s.unitToggleTxtActive]}>gotas</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={s.consumeUnitLabel}>{item.unit}</Text>
                  )}
                </View>
                {consumeUnit === 'gotas' && (
                  <Text style={s.consumeHint}>
                    {(() => {
                      const n = parseFloat(consumeQty.replace(',', '.'));
                      return isNaN(n) ? '20 gotas = 1 mL' : `≈ ${(n * 0.05).toFixed(2).replace('.', ',')} mL`;
                    })()}
                  </Text>
                )}
              </View>
              <View style={[s.consumeQtyField, { marginLeft: 12 }]}>
                <Text style={s.label}>Para quem</Text>
                <TextInput
                  style={s.input}
                  value={consumePerson}
                  onChangeText={setConsumePerson}
                  placeholder="Opcional"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
            <View style={s.editActions}>
              <AnimatedPressable
                style={s.cancelBtn}
                onPress={() => { setConsuming(false); setConsumeQty('1'); setConsumeUnit('item'); setConsumePerson(''); }}
              >
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[s.saveBtn, consumeLoading && s.saveBtnDisabled]}
                onPress={() => { void handleConsume(); }}
                disabled={consumeLoading}
              >
                {consumeLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>Confirmar</Text>
                }
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {/* ── Detail card (view) or edit form ─────────────────────────────── */}
        {editing ? (
          <View>
            <DatePickerField
              label="Data de vencimento"
              value={expiryDate}
              onChange={setExpiryDate}
            />

            <View style={s.row}>
              <View style={s.rowField}>
                <Text style={s.label}>Quantidade</Text>
                <TextInput
                  style={s.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.rowField, { marginLeft: 12 }]}>
                <Text style={s.label}>Unidade</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {UNITS.map(u => (
                    <AnimatedPressable
                      key={u}
                      style={[s.unitChip, unit === u && s.unitChipActive]}
                      onPress={() => { setUnit(u); }}
                    >
                      <Text style={[s.unitText, unit === u && s.unitTextActive]}>{u}</Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={s.label}>Lote</Text>
            <TextInput style={s.input} value={lotNumber} onChangeText={setLotNumber} autoCapitalize="characters" />

            <Text style={s.label}>Local</Text>
            <TextInput style={s.input} value={location} onChangeText={setLocation} />

            <Text style={s.label}>Indicações (para que serve)</Text>
            {loadingIndications
              ? <ActivityIndicator color={theme.primary} style={s.indicationsLoader} />
              : <TagInput tags={indications} onChange={setIndications} placeholder="Ex: Febre, Dor..." />
            }

            <View style={s.editActions}>
              <AnimatedPressable style={s.cancelBtn} onPress={() => { setEditing(false); }}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[s.saveBtn, loading && s.saveBtnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>Salvar</Text>
                }
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <>
            <View style={s.card}>
              <Row label="Vencimento"      value={formatExpiryDate(item.expiry_date)} s={s} />
              <Row label="Quantidade"      value={`${item.quantity} ${item.unit}`} s={s} />
              <Row label="Fabricante"      value={item.manufacturer} s={s} />
              <Row label="Dosagem"         value={item.presentation_dosage} s={s} />
              <Row label="Forma"           value={item.pharma_form_friendly ?? item.pharmaceutical_form} s={s} />
              <Row label="Princípio ativo" value={item.active_ingredient} s={s} />
              <Row label="Lote"            value={item.lot_number} s={s} />
              <Row label="Local"           value={item.location} s={s} />
            </View>
            {(item.indications ?? []).length > 0 && (
              <View style={s.indicationsSection}>
                <Text style={s.indicationsTitle}>PARA QUE SERVE</Text>
                <View style={s.indicationsTags}>
                  {(item.indications ?? []).map((ind, i) => (
                    <View key={`${ind}-${i}`} style={s.indicationChip}>
                      <Text style={s.indicationChipText}>{ind}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── Histórico de uso ─────────────────────────────────────────────── */}
        {consumptions.length > 0 && (
          <View style={s.historySection}>
            <Text style={s.historyTitle}>HISTÓRICO DE USO</Text>
            <View style={s.card}>
              {consumptions.map((c, index) => (
                <View key={c.id}>
                  {index > 0 && <View style={s.histSeparator} />}
                  <View style={s.histRow}>
                    <View style={s.histDot} />
                    <Text style={s.histDate}>{formatConsumedAt(c.consumed_at)}</Text>
                    <Text style={s.histQty}>
                      {c.consumed_qty % 1 === 0
                        ? String(c.consumed_qty)
                        : c.consumed_qty.toFixed(2).replace('.', ',')} {item.unit}
                    </Text>
                    {Boolean(c.person_name) && (
                      <Text style={s.histPerson}> · {c.person_name}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Tratamentos vinculados ───────────────────────────────────────── */}
        {linkedTreatments.length > 0 && (
          <View style={s.treatmentsSection}>
            <Text style={s.treatmentsSectionTitle}>TRATAMENTOS COM ESTE MEDICAMENTO</Text>
            <View style={s.card}>
              {linkedTreatments.map((t: TreatmentRow, index: number) => {
                const badgeColor = t.status === 'active' ? theme.primary : t.status === 'paused' ? theme.amber : theme.textMuted;
                const badgeBg    = t.status === 'active' ? theme.primaryLight : t.status === 'paused' ? theme.amberBg : theme.surfaceAlt;
                const badgeLabel = t.status === 'active' ? 'Ativo' : t.status === 'paused' ? 'Pausado' : 'Concluído';
                const [sy, sm, sd] = t.start_date.split('-');
                const startFmt = `${sd}/${sm}/${sy}`;
                const period   = t.end_date
                  ? (() => { const [ey, em, ed] = t.end_date.split('-'); return `${startFmt} → ${ed}/${em}/${ey}`; })()
                  : `desde ${startFmt}`;
                return (
                  <Pressable
                    key={t.id}
                    style={[s.treatmentLinkRow, index === 0 && { borderTopWidth: 0 }]}
                    onPress={() => { router.push(`/(app)/treatments/${t.id}`); }}
                  >
                    <View style={s.treatmentLinkContent}>
                      <View style={s.treatmentLinkHeader}>
                        <Text style={s.treatmentLinkName}>{t.person_name}</Text>
                        <View style={[s.treatmentLinkBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[s.treatmentLinkBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                        </View>
                      </View>
                      <Text style={s.treatmentLinkMeta}>
                        {formatFrequency(t.frequency_hours)} · {t.dose_quantity} {t.dose_unit}
                      </Text>
                      <Text style={s.treatmentLinkPeriod}>{period}</Text>
                    </View>
                    <Text style={s.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

      </ScrollView>

      <ConfirmDialog
        visible={deleteVisible}
        title="Remover item"
        message={`Deseja remover "${getItemDisplayName(item)}" do estoque?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        destructive
        onConfirm={() => { void confirmDelete(); }}
        onCancel={() => { setDeleteVisible(false); }}
      />
    </SafeAreaView>
  );
}

type RowStyles = ReturnType<typeof styles>;

function Row({ label, value, s }: { label: string; value: string | null | undefined; s: RowStyles }) {
  if (!value) return null;
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: t.bg },
    content:         { padding: 16, paddingBottom: 40 },

    // Top bar
    topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    backText:        { color: t.primary, fontSize: 15 },
    topActions:      { flexDirection: 'row', gap: 6 },
    consumeBtn:      { backgroundColor: t.coralBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
    consumeBtnText:  { color: t.coral, fontWeight: '600', fontSize: 12 },
    editBtn:         { backgroundColor: t.primaryBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
    editBtnText:     { color: t.primary, fontWeight: '600', fontSize: 12 },
    deleteBtn:       { backgroundColor: t.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: t.borderSub },
    deleteBtnText:   { color: t.textMuted, fontWeight: '600', fontSize: 12 },

    // Item header
    itemName:        { fontSize: 20, fontWeight: '700', color: t.text, marginBottom: 4, fontFamily: fonts.heading },
    itemSub:         { fontSize: 13, color: t.textSub, marginBottom: 12 },
    statusBadge:     { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 20 },
    statusText:      { fontSize: 13, fontWeight: '700' },

    // Consume form
    consumeForm:     { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.surfaceAlt, padding: 16, marginBottom: 20 },
    consumeFormTitle:{ fontSize: 15, fontWeight: '700', color: t.text, marginBottom: 12 },
    consumeRow:      { flexDirection: 'row' },
    consumeQtyField: { flex: 1 },
    consumeQtyRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    consumeQtyInput: { flex: 1, borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: t.surface, color: t.text },
    consumeUnitLabel:{ fontSize: 14, color: t.textSub, fontWeight: '500', marginBottom: 16 },
    unitToggle:      { flexDirection: 'row', marginBottom: 16, borderWidth: 1, borderColor: t.borderSub, borderRadius: 10, overflow: 'hidden' },
    unitToggleBtn:   { paddingHorizontal: 10, paddingVertical: 6 },
    unitToggleBtnActive: { backgroundColor: t.primary },
    unitToggleTxt:   { fontSize: 12, color: t.textSub, fontWeight: '600' },
    unitToggleTxtActive: { color: '#FFFFFF' },
    consumeHint:     { fontSize: 11, color: t.textMuted, marginTop: -12, marginBottom: 8 },

    // Detail card
    card:            { backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.border },
    detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.surfaceAlt },
    detailLabel:     { fontSize: 13, color: t.textSub },
    detailValue:     { fontSize: 13, color: t.text, fontWeight: '500' },

    // Edit form
    label:           { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 6 },
    input:           { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: t.surface, color: t.text },
    row:             { flexDirection: 'row', alignItems: 'flex-start' },
    rowField:        { flex: 1 },
    unitChip:        { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
    unitChipActive:  { backgroundColor: t.primary, borderColor: t.primary },
    unitText:        { fontSize: 13, color: t.textSub },
    unitTextActive:  { color: '#FFFFFF' },
    editActions:     { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn:       { flex: 1, borderRadius: 16, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: t.borderSub },
    cancelBtnText:   { color: t.textSub, fontWeight: '600' },
    saveBtn:         { flex: 1, backgroundColor: t.primary, borderRadius: 16, padding: 13, alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText:     { color: '#FFFFFF', fontWeight: '700' },
    indicationsLoader: { marginBottom: 16 },

    // Indications (view mode)
    indicationsSection:   { marginTop: 16 },
    indicationsTitle:     { fontSize: 11, fontWeight: '700', color: t.textMuted, letterSpacing: 0.5, marginBottom: 10 },
    indicationsTags:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    indicationChip:       { backgroundColor: t.primaryBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
    indicationChipText:   { fontSize: 13, color: t.primary, fontWeight: '600' },

    // Linked treatments
    treatmentsSection:       { marginTop: 24 },
    treatmentsSectionTitle:  { fontSize: 11, fontWeight: '700', color: t.textMuted, letterSpacing: 0.5, marginBottom: 8 },
    treatmentLinkRow:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: t.surfaceAlt },
    treatmentLinkContent:    { flex: 1 },
    treatmentLinkHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    treatmentLinkName:       { fontSize: 14, fontWeight: '600', color: t.text },
    treatmentLinkBadge:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    treatmentLinkBadgeText:  { fontSize: 11, fontWeight: '700' },
    treatmentLinkMeta:       { fontSize: 12, color: t.textSub, marginBottom: 1 },
    treatmentLinkPeriod:     { fontSize: 11, color: t.textMuted },
    chevron:                 { fontSize: 20, color: t.textMuted, marginLeft: 8 },

    // History
    historySection:  { marginTop: 24 },
    historyTitle:    { fontSize: 11, fontWeight: '700', color: t.textMuted, letterSpacing: 0.5, marginBottom: 8 },
    histSeparator:   { height: 1, backgroundColor: t.surfaceAlt, marginHorizontal: 14 },
    histRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
    histDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: t.primary, marginRight: 10 },
    histDate:        { fontSize: 12, color: t.textSub, marginRight: 8, width: 68, fontFamily: fonts.mono },
    histQty:         { fontSize: 13, fontWeight: '600', color: t.text },
    histPerson:      { fontSize: 12, color: t.textSub, flex: 1 },
  });
}
