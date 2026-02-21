import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  runAtTargetFps,
} from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-mlkit';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import { parseOcrText } from '../../../src/lib/ocr-parser';

export default function OcrScannerScreen() {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const { textRecognition } = useTextRecognition({ language: 'LATIN' });
  const hasCaptured = useSharedValue(false);

  const handleOcrResult = useRunOnJS((rawText: string) => {
    const result = parseOcrText(rawText);
    router.push({
      pathname: '/(app)/scanner/result',
      params: {
        expiryDate: result.expiryDate ?? '',
        lotNumber:  result.lotNumber ?? '',
        dose:       result.dose ?? '',
        ean:        result.ean ?? '',
      },
    });
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (hasCaptured.value) return;
      runAtTargetFps(2, () => {
        'worklet';
        const ocr = textRecognition(frame);
        if (ocr.text.trim().length > 5) {
          hasCaptured.value = true;
          void handleOcrResult(ocr.text);
        }
      });
    },
    [textRecognition, handleOcrResult, hasCaptured],
  );

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permText}>
          MedStock precisa de acesso à câmera para ler rótulos de medicamentos.
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
        frameProcessor={frameProcessor}
      />
      <SafeAreaView style={styles.overlay}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕ Fechar</Text>
        </Pressable>
        <View style={styles.scanFrame} />
        <Text style={styles.hint}>Aponte para o rótulo do medicamento</Text>
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
  scanFrame:      { alignSelf: 'center', width: 280, height: 160, borderWidth: 2, borderColor: '#fff', borderRadius: 12 },
  hint:           { alignSelf: 'center', color: '#fff', fontSize: 14, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20 },
  permText:       { fontSize: 15, color: '#374151', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  btn:            { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginBottom: 12 },
  btnText:        { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnOutline:     { borderWidth: 1, borderColor: '#2563eb', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  btnOutlineText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
});
