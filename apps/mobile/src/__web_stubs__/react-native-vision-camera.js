// Web stub for react-native-vision-camera.
// VisionCamera is native-only; on web, scanner screens show a fallback UI.
const React = require('react');

const Camera = () => null;
Camera.getCameraDevice = () => null;
Camera.getCameraPermissionStatus = () => 'denied';
Camera.requestCameraPermission = async () => 'denied';

module.exports = {
  Camera,
  useCameraDevice: () => null,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: async () => false }),
  useCodeScanner: () => ({}),
  useTextRecognition: () => ({ frame: null }),
  useCameraFormat: () => null,
};
