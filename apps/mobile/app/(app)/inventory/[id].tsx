import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, getItemDisplayName, softDeleteItem } from '../../../src/stores/inventory.store';
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

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

export default function InventoryItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rawItems = useSelector(inventoryStore.items);
  const items = rawItems as InventoryRow[];
  const item = items.find(i => i.id === id) ?? null;

  const [editing, setEditing] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('un');
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

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
      ...(item.custom_name ? { customName: item.custom_name } : {}),
      expiryDate: expiryDate.trim(),
      quantity: Number(quantity),
      unit,
      ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    });

    if (!parseResult.success) {
      Alert.alert('Dados inválidos', parseResult.error.errors[0]?.message ?? 'Verifique os campos');
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
      Alert.alert('Erro', error.message);
      return;
    }
    setEditing(false);
  }

  function handleDelete() {
    if (!item) return;
    Alert.alert(
      'Remover item',
      `Deseja remover "${getItemDisplayName(item)}" do estoque?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const err = await softDeleteItem(item.id);
            if (err) {
              Alert.alert('Erro', err);
            } else {
              router.back();
            }
          },
        },
      ],
    );
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
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backText}>← Voltar</Text>
          </Pressable>
          {!editing && (
            <View style={styles.topActions}>
              <Pressable onPress={startEdit} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Editar</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Remover</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.itemName}>{getItemDisplayName(item)}</Text>
        {Boolean(item.medications?.active_ingredient) && (
          <Text style={styles.itemSub}>{item.medications?.active_ingredient}</Text>
        )}

        <View style={[styles.statusBadge, { backgroundColor: EXPIRY_COLORS[status] + '20' }]}>
          <Text style={[styles.statusText, { color: EXPIRY_COLORS[status] }]}>
            {EXPIRY_LABELS[status]}
            {days >= 0 ? ` (${days} dias)` : ''}
          </Text>
        </View>

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
                    <Pressable
                      key={u}
                      style={[styles.unitChip, unit === u && styles.unitChipActive]}
                      onPress={() => setUnit(u)}
                    >
                      <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Text style={styles.label}>Lote</Text>
            <TextInput
              style={styles.input}
              value={lotNumber}
              onChangeText={setLotNumber}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Local</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
            />

            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
                onPress={() => { void handleSave(); }}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Salvar</Text>
                }
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Row label="Vencimento"  value={formatExpiryDate(item.expiry_date)} />
            <Row label="Quantidade"  value={`${item.quantity} ${item.unit}`} />
            <Row label="Lote"        value={item.lot_number} />
            <Row label="Local"       value={item.location} />
            {Boolean(item.medications?.pharmaceutical_form) && (
              <Row label="Forma"     value={item.medications?.pharmaceutical_form} />
            )}
          </View>
        )}
      </ScrollView>
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
  container:      { flex: 1, backgroundColor: '#F6F8F5' },
  content:        { padding: 16, paddingBottom: 40 },
  topBar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText:       { color: '#1A9E96', fontSize: 15 },
  topActions:     { flexDirection: 'row', gap: 8 },
  editBtn:        { backgroundColor: '#D0F7F5', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText:    { color: '#147570', fontWeight: '600', fontSize: 13 },
  deleteBtn:      { backgroundColor: '#FEE9E4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  deleteBtnText:  { color: '#F0735A', fontWeight: '600', fontSize: 13 },
  itemName:       { fontSize: 20, fontWeight: '700', color: '#1A1D1A', marginBottom: 4 },
  itemSub:        { fontSize: 13, color: '#5A625A', marginBottom: 12 },
  statusBadge:    { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 20 },
  statusText:     { fontSize: 13, fontWeight: '700' },
  card:           { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E0E4E0' },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8ECE5' },
  detailLabel:    { fontSize: 13, color: '#5A625A' },
  detailValue:    { fontSize: 13, color: '#1A1D1A', fontWeight: '500' },
  label:          { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  input:          { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  row:            { flexDirection: 'row', alignItems: 'flex-start' },
  rowField:       { flex: 1 },
  unitChip:       { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
  unitChipActive: { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  unitText:       { fontSize: 13, color: '#5A625A' },
  unitTextActive: { color: '#FFFFFF' },
  editActions:    { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn:      { flex: 1, borderRadius: 16, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC' },
  cancelBtnText:  { color: '#5A625A', fontWeight: '600' },
  saveBtn:        { flex: 1, backgroundColor: '#1A9E96', borderRadius: 16, padding: 13, alignItems: 'center' },
  saveBtnDisabled:{ opacity: 0.6 },
  saveBtnText:    { color: '#FFFFFF', fontWeight: '700' },
});
