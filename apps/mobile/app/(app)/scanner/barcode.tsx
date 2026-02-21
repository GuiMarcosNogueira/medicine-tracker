import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import { supabase } from '../../../src/lib/supabase';

export default function BarcodeScannerScreen() {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const hasNavigated = useRef(false);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      if (hasNavigated.current) return;
      const ean = codes[0]?.value;
      if (!ean) return;
      hasNavigated.current = true;

      void supabase
        .from('medications')
        .select('id, product_name')
        .eq('ean', ean)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            router.push({
              pathname: '/(app)/inventory/add',
              params: { medicationId: data.id, productName: data.product_name },
            });
          } else {
            router.push({
              pathname: '/(app)/scanner/result',
              params: { ean, expiryDate: '', lotNumber: '', dose: '' },
            });
          }
        });
    },
  });

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permText}>
          MedStock precisa de acesso à câmera para ler códigos de barras.
        </Text>
        <Pressable style={styles.btn} onPress={() => { void requestPermission(); }}>
          <Text style={styles.btnText}>Permitir câmera</Text>
        </Pressable>
        <Pressable style={styles.btnOutline} onPress={() => router.back()}>
          <Text style={styles.btnOutlineText}>Voltar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        codeScanner={codeScanner}
      />
      <SafeAreaView style={styles.overlay}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕ Fechar</Text>
        </Pressable>
        <View style={styles.scanLine} />
        <Text style={styles.hint}>Aponte para o código de barras do medicamento (EAN-13 / EAN-8)</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  center:         { flex: 1, backgroundColor: '#f8fafc', padding: 24, alignItems: 'center', justifyContent: 'center' },
  overlay:        { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 20 },
  closeBtn:       { alignSelf: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  closeBtnText:   { color: '#fff', fontSize: 14, fontWeight: '600' },
  scanLine:       { alignSelf: 'center', width: 280, height: 2, backgroundColor: '#ef4444' },
  hint:           { alignSelf: 'center', color: '#fff', fontSize: 13, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  permText:       { fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  btn:            { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 12 },
  btnText:        { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline:     { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  btnOutlineText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
});
