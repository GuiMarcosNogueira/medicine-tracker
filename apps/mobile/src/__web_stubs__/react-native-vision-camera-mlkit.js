// Web stub for react-native-vision-camera-mlkit.
// ML Kit frame processors are native-only; no-op on web.
module.exports = {
  useTextRecognition: () => ({ recognizeText: async () => null }),
  useBarcodeScanner: () => ({ scanBarcodes: async () => [] }),
};
