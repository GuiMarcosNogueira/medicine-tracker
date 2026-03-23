import { observable } from '@legendapp/state';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { ThemePreference } from '@medstock/ui';

const KEY = 'medstock_theme';

const storage = {
  get: async (): Promise<ThemePreference> => {
    const v =
      Platform.OS === 'web'
        ? (typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null)
        : await SecureStore.getItemAsync(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  },
  set: async (v: ThemePreference): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, v);
    } else {
      await SecureStore.setItemAsync(KEY, v);
    }
  },
};

export const preferencesStore = observable({
  theme:  'system' as ThemePreference,
  loaded: false,
});

export async function initPreferences(): Promise<void> {
  preferencesStore.theme.set(await storage.get());
  preferencesStore.loaded.set(true);
}

export async function setThemePreference(v: ThemePreference): Promise<void> {
  preferencesStore.theme.set(v);
  await storage.set(v);
}
