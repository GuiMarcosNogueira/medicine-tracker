import { useState, useEffect, useCallback } from 'react';
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
import { AnimatedPressable, ConfirmDialog, useToast } from '@medstock/ui';
import { hapticSuccess, hapticError, hapticMedium } from '../../../src/lib/haptics';

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
  const [loading, setLoading] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  // Consume mode state
  const [consuming, setConsuming] = useState(false);
  const [consumeQty, setConsumeQty] = useState('1');
  const [consumeUnit, setConsumeUnit] = useState<'item' | 'gotas'>('item');
  const [consumePerson, setConsumePerson] = useState('');
  const [consumeLoading, setConsumeLoading] = useState(false);

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
    setEditing(true);
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
      })
      .eq('id', item.id);

    setLoading(false);
    if (error) {
      toast.show('error', 'Erro', error.message);
      hapticError();
      return;
    }
    hapticSuccess();

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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1A9E96" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const status = getExpiryStatus(item.expiry_date);
  const days   = daysUntilExpiry(item.expiry_date);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <AnimatedPressable onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(app)/inventory');
          }}>
            <Text style={styles.backText}>← Voltar</Text>
          </AnimatedPressable>
          {!editing && !consuming && (
            <View style={styles.topActions}>
              <AnimatedPressable
                onPress={() => { setConsuming(true); }}
                style={styles.consumeBtn}
              >
                <Text style={styles.consumeBtnText}>Registrar uso</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={startEdit} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Editar</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => { setDeleteVisible(true); }} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Remover</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {/* ── Item header ──────────────────────────────────────────────────── */}
        <Text style={styles.itemName}>{getItemDisplayName(item)}</Text>
        {Boolean(item.active_ingredient) && (
          <Text style={styles.itemSub}>{item.active_ingredient}</Text>
        )}
        <View style={[styles.statusBadge, { backgroundColor: EXPIRY_COLORS[status] + '20' }]}>
          <Text style={[styles.statusText, { color: EXPIRY_COLORS[status] }]}>
            {EXPIRY_LABELS[status]}{days >= 0 ? ` (${days} dias)` : ''}
          </Text>
        </View>

        {/* ── Consume form (inline) ────────────────────────────────────────── */}
        {consuming && (
          <Animated.View entering={FadeInDown.springify()} style={styles.consumeForm}>
            <Text style={styles.consumeFormTitle}>Registrar uso</Text>
            <View style={styles.consumeRow}>
              <View style={styles.consumeQtyField}>
                <Text style={styles.label}>Quantidade</Text>
                <View style={styles.consumeQtyRow}>
                  <TextInput
                    style={styles.consumeQtyInput}
                    value={consumeQty}
                    onChangeText={setConsumeQty}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    autoFocus
                  />
                  {item.unit === 'ml' ? (
                    <View style={styles.unitToggle}>
                      <Pressable
                        style={[styles.unitToggleBtn, consumeUnit === 'item' && styles.unitToggleBtnActive]}
                        onPress={() => { setConsumeUnit('item'); }}
                      >
                        <Text style={[styles.unitToggleTxt, consumeUnit === 'item' && styles.unitToggleTxtActive]}>mL</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.unitToggleBtn, consumeUnit === 'gotas' && styles.unitToggleBtnActive]}
                        onPress={() => { setConsumeUnit('gotas'); }}
                      >
                        <Text style={[styles.unitToggleTxt, consumeUnit === 'gotas' && styles.unitToggleTxtActive]}>gotas</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.consumeUnitLabel}>{item.unit}</Text>
                  )}
                </View>
                {consumeUnit === 'gotas' && (
                  <Text style={styles.consumeHint}>
                    {(() => {
                      const n = parseFloat(consumeQty.replace(',', '.'));
                      return isNaN(n) ? '20 gotas = 1 mL' : `≈ ${(n * 0.05).toFixed(2).replace('.', ',')} mL`;
                    })()}
                  </Text>
                )}
              </View>
              <View style={[styles.consumeQtyField, { marginLeft: 12 }]}>
                <Text style={styles.label}>Para quem</Text>
                <TextInput
                  style={styles.input}
                  value={consumePerson}
                  onChangeText={setConsumePerson}
                  placeholder="Opcional"
                  placeholderTextColor="#9CA59C"
                />
              </View>
            </View>
            <View style={styles.editActions}>
              <AnimatedPressable
                style={styles.cancelBtn}
                onPress={() => { setConsuming(false); setConsumeQty('1'); setConsumeUnit('item'); setConsumePerson(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.saveBtn, consumeLoading && styles.saveBtnDisabled]}
                onPress={() => { void handleConsume(); }}
                disabled={consumeLoading}
              >
                {consumeLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Confirmar</Text>
                }
              </AnimatedPressable>
            </View>
          </Animated.View>
        )}

        {/* ── Detail card (view) or edit form ─────────────────────────────── */}
        {editing ? (
          <View>
            <Text style={styles.label}>Data de vencimento (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={expiryDate}
              onChangeText={setExpiryDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />

            <View style={styles.row}>
              <View style={styles.rowField}>
                <Text style={styles.label}>Quantidade</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.rowField, { marginLeft: 12 }]}>
                <Text style={styles.label}>Unidade</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {UNITS.map(u => (
                    <AnimatedPressable
                      key={u}
                      style={[styles.unitChip, unit === u && styles.unitChipActive]}
                      onPress={() => { setUnit(u); }}
                    >
                      <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={styles.label}>Lote</Text>
            <TextInput style={styles.input} value={lotNumber} onChangeText={setLotNumber} autoCapitalize="characters" />

            <Text style={styles.label}>Local</Text>
            <TextInput style={styles.input} value={location} onChangeText={setLocation} />

            <View style={styles.editActions}>
              <AnimatedPressable style={styles.cancelBtn} onPress={() => { setEditing(false); }}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Salvar</Text>
                }
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Row label="Vencimento"      value={formatExpiryDate(item.expiry_date)} />
            <Row label="Quantidade"      value={`${item.quantity} ${item.unit}`} />
            <Row label="Fabricante"      value={item.manufacturer} />
            <Row label="Dosagem"         value={item.presentation_dosage} />
            <Row label="Forma"           value={item.pharma_form_friendly ?? item.pharmaceutical_form} />
            <Row label="Princípio ativo" value={item.active_ingredient} />
            <Row label="Lote"            value={item.lot_number} />
            <Row label="Local"           value={item.location} />
          </View>
        )}

        {/* ── Histórico de uso ─────────────────────────────────────────────── */}
        {consumptions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>HISTÓRICO DE USO</Text>
            <View style={styles.card}>
              {consumptions.map((c, index) => (
                <View key={c.id}>
                  {index > 0 && <View style={styles.histSeparator} />}
                  <View style={styles.histRow}>
                    <View style={styles.histDot} />
                    <Text style={styles.histDate}>{formatConsumedAt(c.consumed_at)}</Text>
                    <Text style={styles.histQty}>
                      {c.consumed_qty % 1 === 0
                        ? String(c.consumed_qty)
                        : c.consumed_qty.toFixed(2).replace('.', ',')} {item.unit}
                    </Text>
                    {Boolean(c.person_name) && (
                      <Text style={styles.histPerson}> · {c.person_name}</Text>
                    )}
                  </View>
                </View>
              ))}
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

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F8F5' },
  content:         { padding: 16, paddingBottom: 40 },

  // Top bar
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText:        { color: '#1A9E96', fontSize: 15 },
  topActions:      { flexDirection: 'row', gap: 6 },
  consumeBtn:      { backgroundColor: '#FEE9E4', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  consumeBtnText:  { color: '#F0735A', fontWeight: '600', fontSize: 12 },
  editBtn:         { backgroundColor: '#D0F7F5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText:     { color: '#147570', fontWeight: '600', fontSize: 12 },
  deleteBtn:       { backgroundColor: '#F6F8F5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D9CC' },
  deleteBtnText:   { color: '#9CA59C', fontWeight: '600', fontSize: 12 },

  // Item header
  itemName:        { fontSize: 20, fontWeight: '700', color: '#1A1D1A', marginBottom: 4 },
  itemSub:         { fontSize: 13, color: '#5A625A', marginBottom: 12 },
  statusBadge:     { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 20 },
  statusText:      { fontSize: 13, fontWeight: '700' },

  // Consume form
  consumeForm:     { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8ECE5', padding: 16, marginBottom: 20 },
  consumeFormTitle:{ fontSize: 15, fontWeight: '700', color: '#1A1D1A', marginBottom: 12 },
  consumeRow:      { flexDirection: 'row' },
  consumeQtyField: { flex: 1 },
  consumeQtyRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  consumeQtyInput: { flex: 1, borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  consumeUnitLabel:{ fontSize: 14, color: '#5A625A', fontWeight: '500', marginBottom: 16 },
  unitToggle:      { flexDirection: 'row', marginBottom: 16, borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 10, overflow: 'hidden' },
  unitToggleBtn:   { paddingHorizontal: 10, paddingVertical: 6 },
  unitToggleBtnActive: { backgroundColor: '#1A9E96' },
  unitToggleTxt:   { fontSize: 12, color: '#5A625A', fontWeight: '600' },
  unitToggleTxtActive: { color: '#FFFFFF' },
  consumeHint:     { fontSize: 11, color: '#9CA59C', marginTop: -12, marginBottom: 8 },

  // Detail card
  card:            { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E4E0' },
  detailRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8ECE5' },
  detailLabel:     { fontSize: 13, color: '#5A625A' },
  detailValue:     { fontSize: 13, color: '#1A1D1A', fontWeight: '500' },

  // Edit form
  label:           { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  row:             { flexDirection: 'row', alignItems: 'flex-start' },
  rowField:        { flex: 1 },
  unitChip:        { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
  unitChipActive:  { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  unitText:        { fontSize: 13, color: '#5A625A' },
  unitTextActive:  { color: '#FFFFFF' },
  editActions:     { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn:       { flex: 1, borderRadius: 16, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC' },
  cancelBtnText:   { color: '#5A625A', fontWeight: '600' },
  saveBtn:         { flex: 1, backgroundColor: '#1A9E96', borderRadius: 16, padding: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#FFFFFF', fontWeight: '700' },

  // History
  historySection:  { marginTop: 24 },
  historyTitle:    { fontSize: 11, fontWeight: '700', color: '#9CA59C', letterSpacing: 0.5, marginBottom: 8 },
  histSeparator:   { height: 1, backgroundColor: '#E8ECE5', marginHorizontal: 14 },
  histRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  histDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1A9E96', marginRight: 10 },
  histDate:        { fontSize: 12, color: '#5A625A', marginRight: 8, width: 68 },
  histQty:         { fontSize: 13, fontWeight: '600', color: '#1A1D1A' },
  histPerson:      { fontSize: 12, color: '#5A625A', flex: 1 },
});
