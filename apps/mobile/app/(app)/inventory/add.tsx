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
import { inventoryStore, addInventoryItem, refreshInventory } from '../../../src/stores/inventory.store';
import { supabase } from '../../../src/lib/supabase';
import { inventoryItemSchema } from '@medstock/shared';
import type { InventoryUnit } from '@medstock/shared';
import { AnimatedPressable, useToast } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';
import { DatePickerField } from '../../../src/components/DatePickerField';
import { TagInput } from '../../../src/components/TagInput';

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

export default function AddInventoryScreen() {
  const toast = useToast();
  const params = useLocalSearchParams<{
    medicationId?: string;
    productName?: string;
    quantityCount?: string;
    quantityVolume?: string;
    pharmaFormFriendly?: string;
    pharmaceuticalForm?: string;
    activeIngredient?: string;
    manufacturer?: string;
    presentationDosage?: string;
  }>();
  const familyId = useSelector(inventoryStore.familyId);

  const [customName, setCustomName] = useState(params.productName ?? '');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState(() => {
    if (params.quantityVolume) {
      // Extract numeric part from e.g. "150 ML", "30 G"
      return params.quantityVolume.match(/^(\d+(?:[.,]\d+)?)/)?.[1] ?? '1';
    }
    return params.quantityCount ?? '1';
  });
  const [unit, setUnit] = useState<InventoryUnit>(() => {
    if (params.quantityVolume) {
      const u = params.quantityVolume.replace(/^\d+(?:[.,]\d+)?\s*/, '').toLowerCase();
      if (u === 'ml' || u === 'l') return 'ml';
      if (u === 'g') return 'g';
      return 'ml';
    }
    if (params.quantityCount) {
      const form = (params.pharmaFormFriendly ?? '').toLowerCase();
      if (form.includes('comprimido')) return 'comprimidos';
      if (form.includes('cápsula') || form.includes('capsula')) return 'cápsulas';
    }
    return 'un';
  });
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [indications, setIndications] = useState<string[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const medicationId = params.medicationId ?? null;
  const fromCatalog = Boolean(medicationId);

  // Auto-fetch indications when a catalog item is selected (has activeIngredient)
  useEffect(() => {
    const ai = params.activeIngredient;
    const pn = params.productName;
    if (!ai && !pn) return;
    setLoadingIndications(true);
    supabase.functions
      .invoke('get-indications', {
        body: { productName: pn ?? '', activeIngredient: ai ?? '' },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[get-indications] invoke error:', error);
          return;
        }
        const result = data as { indications?: unknown; _debug?: { log?: string[] } } | null;
        console.log('[get-indications] debug log:', result?._debug?.log?.join('\n'));
        if (Array.isArray(result?.indications)) {
          setIndications(result.indications as string[]);
        }
      })
      .catch((e: unknown) => { console.error('[get-indications] catch:', e); })
      .finally(() => { setLoadingIndications(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearError(field: string) {
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSave() {
    if (!familyId) {
      toast.show('error', 'Erro', 'Você não está em nenhuma família. Crie ou entre em uma família primeiro.');
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
      ...(location.trim() ? { location: location.trim() } : {}),
      indications,
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
    setLoading(true);
    const d = parseResult.data;
    const { data: userData } = await supabase.auth.getUser();

    const { error, queued } = await addInventoryItem({
      family_id:           familyId,
      medication_id:       d.medicationId ?? null,
      custom_name:         d.customName ?? null,
      product_name:        params.productName ?? null,
      manufacturer:        params.manufacturer ?? null,
      active_ingredient:   params.activeIngredient ?? null,
      presentation_dosage: params.presentationDosage ?? null,
      pharma_form_friendly: params.pharmaFormFriendly ?? null,
      pharmaceutical_form: params.pharmaceuticalForm ?? null,
      expiry_date:         d.expiryDate,
      quantity:            d.quantity,
      unit:                d.unit,
      lot_number:          d.lotNumber ?? null,
      location:            d.location ?? null,
      indications:         d.indications,
      added_by:            userData.user?.id ?? null,
    });

    setLoading(false);
    if (error) {
      toast.show('error', 'Erro', error);
      hapticError();
      return;
    }
    if (queued) {
      toast.show('warning', 'Salvo offline', 'Será sincronizado quando conectar.');
    } else {
      hapticSuccess();
      toast.show('success', 'Salvo!', 'Item adicionado ao estoque.');
      // Refresh the store immediately so the list is up-to-date on back()
      void refreshInventory(familyId);
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AnimatedPressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(app)/inventory'); }}
          style={styles.backBtn}
        >
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={styles.title}>Adicionar ao estoque</Text>

        <View style={styles.scanRow}>
          <AnimatedPressable style={styles.scanChip} onPress={() => { router.push('/(app)/scanner/barcode'); }}>
            <Text style={styles.scanChipText}>Código de barras</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.scanChip} onPress={() => { router.push('/(app)/scanner/ocr'); }}>
            <Text style={styles.scanChipText}>Ler rótulo (OCR)</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.scanChip} onPress={() => { router.push('/(app)/catalog'); }}>
            <Text style={styles.scanChipText}>Buscar catálogo</Text>
          </AnimatedPressable>
        </View>

        <Text style={styles.label}>
          {fromCatalog ? 'Medicamento (catálogo)' : 'Nome do medicamento *'}
        </Text>
        {fromCatalog ? (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{params.productName}</Text>
          </View>
        ) : (
          <>
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

        <Text style={styles.label}>Local de armazenamento (opcional)</Text>
        <TextInput
          style={styles.inputSpaced}
          value={location}
          onChangeText={setLocation}
          placeholder="Ex: Armário do banheiro"
          placeholderTextColor="#9CA59C"
        />

        <Text style={styles.label}>Indicações (para que serve)</Text>
        <Text style={styles.hint}>
          {loadingIndications ? 'Buscando indicações automaticamente...' : 'Digite e pressione vírgula ou Enter para adicionar'}
        </Text>
        {loadingIndications
          ? <ActivityIndicator color="#1A9E96" style={styles.indicationsLoader} />
          : <TagInput tags={indications} onChange={setIndications} placeholder="Ex: Febre, Dor de cabeça..." />
        }

        <AnimatedPressable
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Salvar</Text>
          }
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1, backgroundColor: '#F6F8F5' },
  content:            { padding: 16, paddingBottom: 40 },
  backBtn:            { marginBottom: 12, alignSelf: 'flex-start' },
  backText:           { color: '#1A9E96', fontSize: 15 },
  title:              { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 12 },
  scanRow:            { flexDirection: 'row', gap: 8, marginBottom: 20 },
  scanChip:           { flex: 1, borderWidth: 1, borderColor: '#1A9E96', borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  scanChipText:       { color: '#1A9E96', fontWeight: '600', fontSize: 13 },
  label:              { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  hint:               { fontSize: 12, color: '#9CA59C', marginBottom: 8, marginTop: -2 },
  input:              { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 4, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputSpaced:        { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: '#FFFFFF', color: '#1A1D1A' },
  inputError:         { borderColor: '#F0735A' },
  fieldError:         { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  readOnly:           { backgroundColor: '#E8ECE5', borderRadius: 16, padding: 12, marginBottom: 16 },
  readOnlyText:       { fontSize: 15, color: '#5A625A' },
  row:                { flexDirection: 'row', alignItems: 'flex-start' },
  rowField:           { flex: 1 },
  unitChip:           { borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
  unitChipActive:     { backgroundColor: '#1A9E96', borderColor: '#1A9E96' },
  unitText:           { fontSize: 13, color: '#5A625A' },
  unitTextActive:     { color: '#FFFFFF' },
  indicationsLoader:  { marginBottom: 16 },
  saveBtn:            { backgroundColor: '#1A9E96', borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled:    { opacity: 0.6 },
  saveBtnText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
