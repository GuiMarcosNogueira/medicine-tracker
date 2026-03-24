import { useState, useEffect, useRef, useMemo } from 'react';
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
import { AnimatedPressable, useToast, useTheme, fonts, type Theme } from '@medstock/ui';
import { hapticError, hapticSuccess } from '../../../src/lib/haptics';
import { DatePickerField } from '../../../src/components/DatePickerField';
import { TagInput } from '../../../src/components/TagInput';

const UNITS: InventoryUnit[] = ['un', 'comprimidos', 'cápsulas', 'ml', 'mg', 'g'];

export default function AddInventoryScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
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

  const [customName, setCustomName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<InventoryUnit>('un');
  const [lotNumber, setLotNumber] = useState('');
  const [location, setLocation] = useState('');
  const [indications, setIndications] = useState<string[]>([]);
  const [loadingIndications, setLoadingIndications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const medicationId = params.medicationId ?? null;
  const fromCatalog = Boolean(medicationId);

  const paramInitialized = useRef(false);
  useEffect(() => {
    if (paramInitialized.current) return;
    if (!params.productName && !params.quantityCount && !params.quantityVolume) return;
    paramInitialized.current = true;
    if (params.productName) setCustomName(params.productName);
    if (params.quantityVolume) {
      const num = params.quantityVolume.match(/^(\d+(?:[.,]\d+)?)/)?.[1];
      if (num) setQuantity(num);
      const u = params.quantityVolume.replace(/^\d+(?:[.,]\d+)?\s*/, '').toLowerCase();
      setUnit(u === 'g' ? 'g' : 'ml');
    } else if (params.quantityCount) {
      setQuantity(params.quantityCount);
      const form = (params.pharmaFormFriendly ?? '').toLowerCase();
      if (form.includes('comprimido')) setUnit('comprimidos');
      else if (form.includes('cápsula') || form.includes('capsula')) setUnit('cápsulas');
    }
  }, [params.productName, params.quantityCount, params.quantityVolume, params.pharmaFormFriendly]);

  useEffect(() => {
    const ai = params.activeIngredient;
    const pn = params.productName;
    if (!ai && !pn) return;
    setLoadingIndications(true);
    setIndications([]);
    supabase.functions
      .invoke('get-indications', {
        body: { productName: pn ?? '', activeIngredient: ai ?? '' },
      })
      .then(({ data, error }) => {
        if (error) { console.warn('[get-indications] invoke error:', error); return; }
        const result = data as { indications?: unknown } | null;
        if (Array.isArray(result?.indications)) {
          setIndications(result.indications as string[]);
        }
      })
      .catch((e: unknown) => { console.error('[get-indications] catch:', e); })
      .finally(() => { setLoadingIndications(false); });
  }, [params.activeIngredient, params.productName]);

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
      void refreshInventory(familyId);
    }
    router.back();
  }

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <AnimatedPressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(app)/inventory'); }}
          style={s.backBtn}
        >
          <Text style={s.backText}>← Voltar</Text>
        </AnimatedPressable>
        <Text style={s.title}>Adicionar ao estoque</Text>

        <View style={s.scanRow}>
          <AnimatedPressable style={s.scanChip} onPress={() => { router.push('/(app)/scanner/barcode'); }}>
            <Text style={s.scanChipText}>Código de barras</Text>
          </AnimatedPressable>
          <AnimatedPressable style={s.scanChip} onPress={() => { router.push('/(app)/scanner/ocr'); }}>
            <Text style={s.scanChipText}>Ler rótulo (OCR)</Text>
          </AnimatedPressable>
          <AnimatedPressable style={s.scanChip} onPress={() => { router.push('/(app)/catalog'); }}>
            <Text style={s.scanChipText}>Buscar catálogo</Text>
          </AnimatedPressable>
        </View>

        <Text style={s.label}>
          {fromCatalog ? 'Medicamento (catálogo)' : 'Nome do medicamento *'}
        </Text>
        {fromCatalog ? (
          <View style={s.readOnly}>
            <Text style={s.readOnlyText}>{params.productName}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={[s.input, errors['customName'] ? s.inputError : null]}
              value={customName}
              onChangeText={v => { setCustomName(v); clearError('customName'); }}
              placeholder="Ex: Paracetamol 500mg"
              placeholderTextColor={theme.textMuted}
            />
            {Boolean(errors['customName']) && <Text style={s.fieldError}>{errors['customName']}</Text>}
          </>
        )}

        <DatePickerField
          label="Data de vencimento *"
          value={expiryDate}
          onChange={v => { setExpiryDate(v); clearError('expiryDate'); }}
          error={errors['expiryDate']}
        />

        <View style={s.row}>
          <View style={s.rowField}>
            <Text style={s.label}>Quantidade *</Text>
            <TextInput
              style={[s.input, errors['quantity'] ? s.inputError : null]}
              value={quantity}
              onChangeText={v => { setQuantity(v); clearError('quantity'); }}
              keyboardType="decimal-pad"
            />
            {Boolean(errors['quantity']) && <Text style={s.fieldError}>{errors['quantity']}</Text>}
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

        <Text style={s.label}>Lote (opcional)</Text>
        <TextInput
          style={s.inputSpaced}
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="Ex: ABC123"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="characters"
        />

        <Text style={s.label}>Local de armazenamento (opcional)</Text>
        <TextInput
          style={s.inputSpaced}
          value={location}
          onChangeText={setLocation}
          placeholder="Ex: Armário do banheiro"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={s.label}>Indicações (para que serve)</Text>
        <Text style={s.hint}>
          {loadingIndications ? 'Buscando indicações automaticamente...' : 'Digite e pressione vírgula ou Enter para adicionar'}
        </Text>
        {loadingIndications
          ? <ActivityIndicator color={theme.primary} style={s.indicationsLoader} />
          : <TagInput tags={indications} onChange={setIndications} placeholder="Ex: Febre, Dor de cabeça..." />
        }

        <AnimatedPressable
          style={[s.saveBtn, loading && s.saveBtnDisabled]}
          onPress={() => { void handleSave(); }}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.saveBtnText}>Salvar</Text>
          }
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:          { flex: 1, backgroundColor: t.bg },
    content:            { padding: 16, paddingBottom: 40 },
    backBtn:            { marginBottom: 12, alignSelf: 'flex-start' },
    backText:           { color: t.primary, fontSize: 15 },
    title:              { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 12, fontFamily: fonts.heading },
    scanRow:            { flexDirection: 'row', gap: 8, marginBottom: 20 },
    scanChip:           { flex: 1, borderWidth: 1, borderColor: t.primary, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
    scanChipText:       { color: t.primary, fontWeight: '600', fontSize: 13 },
    label:              { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 6 },
    hint:               { fontSize: 12, color: t.textMuted, marginBottom: 8, marginTop: -2 },
    input:              { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, marginBottom: 4, fontSize: 15, backgroundColor: t.surface, color: t.text },
    inputSpaced:        { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, padding: 12, marginBottom: 16, fontSize: 15, backgroundColor: t.surface, color: t.text },
    inputError:         { borderColor: t.coral },
    fieldError:         { color: t.coral, fontSize: 12, marginBottom: 12, marginLeft: 4 },
    readOnly:           { backgroundColor: t.surfaceAlt, borderRadius: 16, padding: 12, marginBottom: 16 },
    readOnlyText:       { fontSize: 15, color: t.textSub },
    row:                { flexDirection: 'row', alignItems: 'flex-start' },
    rowField:           { flex: 1 },
    unitChip:           { borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6, marginBottom: 16 },
    unitChipActive:     { backgroundColor: t.primary, borderColor: t.primary },
    unitText:           { fontSize: 13, color: t.textSub },
    unitTextActive:     { color: '#FFFFFF' },
    indicationsLoader:  { marginBottom: 16 },
    saveBtn:            { backgroundColor: t.primary, borderRadius: 16, padding: 15, alignItems: 'center', marginTop: 8 },
    saveBtnDisabled:    { opacity: 0.6 },
    saveBtnText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  });
}
