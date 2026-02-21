import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import type { Medication } from '@medstock/shared';

export default function MedicationDetailScreen() {
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
      Alert.alert('Erro', 'Medicamento não encontrado.');
      router.back();
      return;
    }
    setMed(data as unknown as Medication);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </Pressable>

        <Text style={styles.productName}>{med.product_name}</Text>
        {Boolean(med.active_ingredient) && (
          <Text style={styles.activeIngredient}>{med.active_ingredient}</Text>
        )}

        <View style={styles.card}>
          <Row label="Fabricante"            value={med.manufacturer} />
          <Row label="Concentração"          value={med.concentration} />
          <Row label="Apresentação"          value={med.presentation} />
          <Row label="Forma farmacêutica"    value={med.pharmaceutical_form} />
          <Row label="Via de administração"  value={med.route_of_admin} />
          <Row label="Classe terapêutica"    value={med.atc_description} />
          <Row label="Código ATC"            value={med.atc_code} />
          <Row label="EAN"                   value={med.ean} />
          <Row label="Registro ANVISA"       value={med.anvisa_code} />
          {med.reference_price !== null && (
            <Row
              label="Preço ref. CMED"
              value={`R$ ${med.reference_price.toFixed(2).replace('.', ',')}`}
            />
          )}
          <Row label="Tarja" value={tarjaLabel} />
        </View>

        <Pressable
          style={styles.addBtn}
          onPress={() =>
            router.push({
              pathname: '/(app)/inventory/add',
              params: { medicationId: med.id, productName: med.product_name },
            })
          }
        >
          <Text style={styles.addBtnText}>Adicionar ao estoque</Text>
        </Pressable>
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
  container:       { flex: 1, backgroundColor: '#f8fafc' },
  content:         { padding: 16, paddingBottom: 40 },
  backBtn:         { marginBottom: 12 },
  backText:        { color: '#2563eb', fontSize: 15 },
  productName:     { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  activeIngredient:{ fontSize: 14, color: '#475569', marginBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  rowLabel:  { fontSize: 13, color: '#64748b', flex: 1 },
  rowValue:  { fontSize: 13, color: '#1e293b', fontWeight: '500', flex: 2, textAlign: 'right' },
  addBtn: {
    backgroundColor: '#2563eb', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
