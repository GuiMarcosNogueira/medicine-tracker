import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_ANON_KEY = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

// SecureStore has a 2048-byte limit per key.
// Google OAuth session tokens frequently exceed this limit.
// We split them into 2000-byte chunks stored under indexed keys.
// On web, SecureStore is unavailable (native-only) — fall back to localStorage.
const CHUNK_SIZE = 2000;

// Guard against SSR / Node.js environments where localStorage is not defined.
const webStorageAdapter = {
  getItem: (key: string): string | null =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null,
  setItem: (key: string, value: string): void => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

const nativeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
    if (!chunksStr) return SecureStore.getItemAsync(key); // legacy single-key fallback
    const numChunks = parseInt(chunksStr, 10);
    const parts: string[] = [];
    for (let i = 0; i < numChunks; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null;
      parts.push(chunk);
    }
    return parts.join('');
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const numChunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_chunks`, String(numChunks));
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.setItemAsync(
        `${key}_chunk_${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
  },

  removeItem: async (key: string): Promise<void> => {
    const chunksStr = await SecureStore.getItemAsync(`${key}_chunks`);
    const numChunks = chunksStr ? parseInt(chunksStr, 10) : 0;
    await SecureStore.deleteItemAsync(`${key}_chunks`);
    for (let i = 0; i < numChunks; i++) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
    }
    // Also try deleting legacy single-key
    await SecureStore.deleteItemAsync(key);
  },
};

const ExpoSecureStoreAdapter = Platform.OS === 'web' ? webStorageAdapter : nativeStorageAdapter;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // handled manually via Expo Linking
  },
});
