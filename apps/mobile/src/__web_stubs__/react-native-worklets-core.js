// Web stub for react-native-worklets-core.
// Worklets run on native UI thread; no-op on web.
module.exports = {
  useRunOnJS: (fn) => fn,
  useSharedValue: (initial) => ({ value: initial }),
  useWorklet: (fn) => fn,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
};
