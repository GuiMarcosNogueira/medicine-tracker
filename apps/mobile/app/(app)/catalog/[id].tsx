import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import type { Medication } from '@medstock/shared';
import { AnimatedPressable, useToast, useTheme, type Theme } from '@medstock/ui';

export default function MedicationDetailScreen() {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [med, setMed] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void loadMedication(id);
  }, [id]);

  async function loadMedication(medId: string) {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .eq('id', medId)
      .single();
    setLoading(false);
    if (error || !data) {
      toast.show('error', 'Erro', 'Medicamento não encontrado.');
      router.back();
      return;
    }
    setMed(data as unknown as Medication);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!med) return null;

  const tarjaLabel = med.is_controlled
    ? 'Tarja Preta'
    : med.requires_prescription
    ? 'Tarja Vermelha'
    : 'Sem tarja';

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.content}>
        <AnimatedPressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(app)/catalog'); }}
          style={s.backBtn}
        >
          <Text style={s.backText}>← Voltar</Text>
        </AnimatedPressable>

        <Text style={s.productName}>{med.product_name}</Text>
        {Boolean(med.active_ingredient) && (
          <Text style={s.activeIngredient}>{med.active_ingredient}</Text>
        )}

        <View style={s.card}>
          <Row label="Fabricante"           value={med.manufacturer} s={s} />
          <Row label="Dosagem"              value={med.presentation_dosage ?? med.concentration} s={s} />
          <Row label="Forma"                value={med.pharma_form_friendly ?? med.pharmaceutical_form} s={s} />
          {med.quantity_count !== null && (
            <Row label="Quantidade"         value={`${med.quantity_count} unidades`} s={s} />
          )}
          <Row label="Volume"               value={med.quantity_volume} s={s} />
          <Row label="Via de administração" value={med.route_of_admin} s={s} />
          <Row label="Classe terapêutica"   value={med.atc_description} s={s} />
          <Row label="Código ATC"           value={med.atc_code} s={s} />
          <Row label="EAN"                  value={med.ean} s={s} />
          <Row label="Registro ANVISA"      value={med.anvisa_code} s={s} />
          {med.reference_price !== null && (
            <Row
              label="Preço ref. CMED"
              value={`R$ ${med.reference_price.toFixed(2).replace('.', ',')}`}
              s={s}
            />
          )}
          <Row label="Tarja" value={tarjaLabel} s={s} />
        </View>

        <AnimatedPressable
          style={s.addBtn}
          onPress={() =>
            router.push({
              pathname: '/(app)/inventory/add',
              params: {
                medicationId: med.id,
                productName: med.product_name,
                ...(med.quantity_count != null ? { quantityCount: String(med.quantity_count) } : {}),
                ...(med.quantity_volume != null ? { quantityVolume: med.quantity_volume } : {}),
                ...(med.pharma_form_friendly != null ? { pharmaFormFriendly: med.pharma_form_friendly } : {}),
                ...(med.pharmaceutical_form != null ? { pharmaceuticalForm: med.pharmaceutical_form } : {}),
                ...(med.active_ingredient != null ? { activeIngredient: med.active_ingredient } : {}),
                ...(med.manufacturer != null ? { manufacturer: med.manufacturer } : {}),
                ...(med.presentation_dosage != null ? { presentationDosage: med.presentation_dosage } : {}),
              },
            })
          }
        >
          <Text style={s.addBtnText}>Adicionar ao estoque</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type RowStyles = ReturnType<typeof styles>;

function Row({ label, value, s }: { label: string; value: string | null | undefined; s: RowStyles }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container:        { flex: 1, backgroundColor: t.bg },
    content:          { padding: 16, paddingBottom: 40 },
    backBtn:          { marginBottom: 12, alignSelf: 'flex-start' },
    backText:         { color: t.primary, fontSize: 15 },
    productName:      { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 4 },
    activeIngredient: { fontSize: 14, color: t.textSub, marginBottom: 20 },
    card: {
      backgroundColor: t.surface, borderRadius: 16,
      borderWidth: 1, borderColor: t.border, marginBottom: 20,
    },
    row: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 11,
      borderBottomWidth: 1, borderBottomColor: t.surfaceAlt,
    },
    rowLabel:  { fontSize: 13, color: t.textSub, flex: 1 },
    rowValue:  { fontSize: 13, color: t.text, fontWeight: '500', flex: 2, textAlign: 'right' },
    addBtn: {
      backgroundColor: t.primary, borderRadius: 16,
      padding: 15, alignItems: 'center',
    },
    addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  });
}
