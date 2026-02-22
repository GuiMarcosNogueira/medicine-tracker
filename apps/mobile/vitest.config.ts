import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Stub out React Native / Expo modules that have no node equivalent
      'react-native': path.resolve(__dirname, 'src/__tests__/__mocks__/react-native.ts'),
      'expo-router': path.resolve(__dirname, 'src/__tests__/__mocks__/expo-router.ts'),
      'date-fns': 'date-fns',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts', 'src/lib/ocr-parser.ts'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
});
