import { useEffect, useState } from 'react';
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
import { AnimatedPressable, useToast } from '@medstock/ui';

export default function MedicationDetailScreen() {
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
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#1A9E96" style={{ marginTop: 40 }} />
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <AnimatedPressable onPress={() => { router.back(); }} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </AnimatedPressable>

        <Text style={styles.productName}>{med.product_name}</Text>
        {Boolean(med.active_ingredient) && (
          <Text style={styles.activeIngredient}>{med.active_ingredient}</Text>
        )}

        <View style={styles.card}>
          <Row label="Fabricante"           value={med.manufacturer} />
          <Row label="Dosagem"              value={med.presentation_dosage ?? med.concentration} />
          <Row label="Forma"                value={med.pharma_form_friendly ?? med.pharmaceutical_form} />
          {med.quantity_count !== null && (
            <Row label="Quantidade"         value={`${med.quantity_count} unidades`} />
          )}
          <Row label="Volume"               value={med.quantity_volume} />
          <Row label="Via de administração" value={med.route_of_admin} />
          <Row label="Classe terapêutica"   value={med.atc_description} />
          <Row label="Código ATC"           value={med.atc_code} />
          <Row label="EAN"                  value={med.ean} />
          <Row label="Registro ANVISA"      value={med.anvisa_code} />
          {med.reference_price !== null && (
            <Row
              label="Preço ref. CMED"
              value={`R$ ${med.reference_price.toFixed(2).replace('.', ',')}`}
            />
          )}
          <Row label="Tarja" value={tarjaLabel} />
        </View>

        <AnimatedPressable
          style={styles.addBtn}
          onPress={() =>
            router.push({
              pathname: '/(app)/inventory/add',
              params: { medicationId: med.id, productName: med.product_name },
            })
          }
        >
          <Text style={styles.addBtnText}>Adicionar ao estoque</Text>
        </AnimatedPressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#F6F8F5' },
  content:          { padding: 16, paddingBottom: 40 },
  backBtn:          { marginBottom: 12, alignSelf: 'flex-start' },
  backText:         { color: '#1A9E96', fontSize: 15 },
  productName:      { fontSize: 22, fontWeight: '700', color: '#1A1D1A', marginBottom: 4 },
  activeIngredient: { fontSize: 14, color: '#5A625A', marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E0E4E0', marginBottom: 20,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#E8ECE5',
  },
  rowLabel:  { fontSize: 13, color: '#5A625A', flex: 1 },
  rowValue:  { fontSize: 13, color: '#1A1D1A', fontWeight: '500', flex: 2, textAlign: 'right' },
  addBtn: {
    backgroundColor: '#1A9E96', borderRadius: 16,
    padding: 15, alignItems: 'center',
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
