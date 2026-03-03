import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from '@legendapp/state/react';
import { inventoryStore, addInventoryItem } from '../../../src/stores/inventory.store';
import { supabase } from '../../../src/lib/supabase';
import { inventoryItemSchema } from '@medstock/shared';
import type { InventoryUnit } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';
import { DatePickerField } from '../../../src/components/DatePickerField';

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

export default function OcrResultScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{
    expiryDate?: string;
    lotNumber?: string;
    dose?: string;
    ean?: string;
  }>();
  const familyId = useSelector(inventoryStore.familyId);

  const [customName, setCustomName] = useState('');
  const [medicationId, setMedicationId] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState(params.expiryDate ?? '');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<InventoryUnit>('un');
  const [lotNumber, setLotNumber] = useState(params.lotNumber ?? '');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const ean = params.ean;
    if (!ean) return;
    setLoadingCatalog(true);
    void supabase
      .from('medications')
      .select('id, product_name')
      .eq('ean', ean)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMedicationId(data.id);
          setCustomName(data.product_name);
        }
        setLoadingCatalog(false);
      });
  }, [params.ean]);

  function clearError(field: string) {
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSave() {
    if (!familyId) {
      toast.show('error', 'Erro', 'Você não está em nenhuma família.');
      hapticError();
      return;
    }
    const parseResult = inventoryItemSchema.safeParse({
      ...(medicationId ? { medicationId } : {}),
      ...(customName.trim() && !medicationId ? { customName: customName.trim() } : {}),
      expiryDate: expiryDate.trim(),
      quantity: Number(quantity),
      unit,
      ...(lotNumber.trim() ? { lotNumber: lotNumber.trim() } : {}),
    });
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path[0];
        if (typeof path === 'string') fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      hapticError();
      return;
    }
    setErrors({});
    setSaving(true);
    const d = parseResult.data;
    const { data: userData } = await supabase.auth.getUser();
    const { error, queued } = await addInventoryItem({
      family_id:           familyId,
      medication_id:       d.medicationId ?? null,
      custom_name:         d.customName ?? null,
      product_name:        null,
      manufacturer:        null,
      active_ingredient:   null,
      presentation_dosage: null,
      pharma_form_friendly: null,
      pharmaceutical_form: null,
      expiry_date:         d.expiryDate,
      quantity:            d.quantity,
      unit:                d.unit,
      lot_number:          d.lotNumber ?? null,
      location:            null,
      added_by:            userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.show('error', 'Erro', error);
      hapticError();
      return;
    }
    if (queued) {
      toast.show('warning', 'Salvo offline', 'Será sincronizado quando conectar.');
    } else {
      hapticSuccess();
      toast.show('success', 'Adicionado!', 'Item salvo no estoque.');
    }
    router.push('/(app)');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AnimatedPressable onPress={() => { router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Escanear novamente</Text>
        </AnimatedPressable>
        <Text style={styles.title}>Revisar dados do rótulo</Text>

        {loadingCatalog ? (
          <ActivityIndicator color="#1A9E96" style={{ marginBottom: 16 }} />
        ) : medicationId ? (
          <>
            <Text style={styles.label}>Medicamento (catálogo)</Text>
            <View style={styles.readOnly}>
              <Text style={styles.readOnlyText}>{customName}</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Nome do medicamento *</Text>
            <TextInput
              style={[styles.input, errors['customName'] ? styles.inputError : null]}
              value={customName}
              onChangeText={v => { setCustomName(v); clearError('customName'); }}
              placeholder="Ex: Paracetamol 500mg"
              placeholderTextColor="#9CA59C"
            />
            {Boolean(errors['customName']) && <Text style={styles.fieldError}>{errors['customName']}</Text>}
          </>
        )}

        <DatePickerField
          label="Data de vencimento *"
          value={expiryDate}
          onChange={v => { setExpiryDate(v); clearError('expiryDate'); }}
          error={errors['expiryDate']}
        />

        <View style={styles.row}>
          <View style={styles.rowField}>
            <Text style={styles.label}>Quantidade *</Text>
            <TextInput
              style={[styles.input, errors['quantity'] ? styles.inputError : null]}
              value={quantity}
              onChangeText={v => { setQuantity(v); clearError('quantity'); }}
              keyboardType="decimal-pad"
            />
            {Boolean(errors['quantity']) && <Text style={styles.fieldError}>{errors['quantity']}</Text>}
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

        <Text style={styles.label}>Lote (opcional)</Text>
        <TextInput
          style={styles.inputSpaced}
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="Ex: ABC123"
          placeholderTextColor="#9CA59C"
          autoCapitalize="characters"
        />

        {params.ean ? (
          <View style={styles.ocrInfo}>
            <Text style={styles.ocrInfoLabel}>EAN detectado: </Text>
            <Text style={styles.ocrInfoValue}>{params.ean}</Text>
          </View>
        ) : null}

        <AnimatedPressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar no estoque</Text>
          }
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F6F8F5' },
  content:         { padding: 16, paddingBottom: 40 },
  backBtn:         { marginBottom: 12, alignSelf: 'flex-start' },
  backText:        { color: '#1A9E96', fontSize: 15 },
  title:           { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 20 },
  label:           { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  input:           { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 4, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputSpaced:     { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputError:      { borderColor: '#F0735A' },
  fieldError:      { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  readOnly:        { backgroundColor: '#E8ECE5', borderRadius: 16, padding: 12, marginBottom: 16 },
  readOnlyText:    { fontSize: 15, color: '#5A625A' },
  row:             { flexDirection: 'row', alignItems: 'flex-start' },
  rowField:        { flex: 1 },
  unitChip:        { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
  unitChipActive:  { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  unitText:        { fontSize: 13, color: '#5A625A' },
  unitTextActive:  { color: '#FFFFFF' },
  ocrInfo:         { flexDirection: 'row', marginBottom: 16, padding: 12, backgroundColor: '#D0F7F5', borderRadius: 16 },
  ocrInfoLabel:    { fontSize: 13, color: '#147570', fontWeight: '600' },
  ocrInfoValue:    { fontSize: 13, color: '#147570' },
  saveBtn:         { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
