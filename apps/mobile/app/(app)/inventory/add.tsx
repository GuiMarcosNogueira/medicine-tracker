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
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore } from '../../../src/stores/inventory.store';
import { supabase } from '../../../src/lib/supabase';
import { inventoryItemSchema } from '@medstock/shared';
import type { InventoryUnit } from '@medstock/shared';

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

export default function AddInventoryScreen() {
  const params = useLocalSearchParams<{ medicationId?: string; productName?: string }>();
  const familyId = useSelector(inventoryStore.familyId);

  const [customName, setCustomName] = useState(params.productName ?? '');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<InventoryUnit>('un');
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const medicationId = params.medicationId ?? null;
  // If from catalog, productName is the catalog name (read-only); otherwise user enters customName
  const fromCatalog = Boolean(medicationId);

  async function handleSave() {
    if (!familyId) {
      Alert.alert('Erro', 'Você não está em nenhuma família. Crie ou entre em uma família primeiro.');
      return;
    }

    const parseResult = inventoryItemSchema.safeParse({
      ...(medicationId ? { medicationId } : {}),
      ...(customName.trim() && !medicationId ? { customName: customName.trim() } : {}),
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
    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('inventory_items').insert({
      family_id:    familyId,
      medication_id: d.medicationId ?? null,
      custom_name:  d.customName ?? null,
      expiry_date:  d.expiryDate,
      quantity:     d.quantity,
      unit:         d.unit,
      lot_number:   d.lotNumber ?? null,
      location:     d.location ?? null,
      added_by:     userData.user?.id ?? null,
    });

    setLoading(false);
    if (error) {
      Alert.alert('Erro', error.message);
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>
        <Text style={styles.title}>Adicionar ao estoque</Text>

        <Text style={styles.label}>
          {fromCatalog ? 'Medicamento (catálogo)' : 'Nome do medicamento *'}
        </Text>
        {fromCatalog ? (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{params.productName}</Text>
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={customName}
            onChangeText={setCustomName}
            placeholder="Ex: Paracetamol 500mg"
          />
        )}

        <Text style={styles.label}>Data de vencimento * (AAAA-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="2026-12-31"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Text style={styles.label}>Quantidade *</Text>
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

        <Text style={styles.label}>Lote (opcional)</Text>
        <TextInput
          style={styles.input}
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="Ex: ABC123"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Local de armazenamento (opcional)</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Ex: Armário do banheiro"
        />

        <Pressable
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f8fafc' },
  content:         { padding: 16, paddingBottom: 40 },
  backBtn:         { marginBottom: 12 },
  backText:        { color: '#2563eb', fontSize: 15 },
  title:           { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  label:           { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#fff' },
  readOnly:        { backgroundColor: '#f1f5f9', borderRadius: 10, padding: 12, marginBottom: 16 },
  readOnlyText:    { fontSize: 15, color: '#475569' },
  row:             { flexDirection: 'row', alignItems: 'flex-start' },
  rowField:        { flex: 1 },
  unitChip:        { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
  unitChipActive:  { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  unitText:        { fontSize: 13, color: '#475569' },
  unitTextActive:  { color: '#fff' },
  saveBtn:         { backgroundColor: '#2563eb', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#fff', fontWeight: '600', fontSize: 16 },
});
