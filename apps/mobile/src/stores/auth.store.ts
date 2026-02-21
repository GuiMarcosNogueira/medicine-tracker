import { observable } from '@legendapp/state';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

export const authStore = observable<AuthState>({
  session: null,
  loading: true,
});

/**
 * Initialize auth state from persisted session and subscribe to changes.
 * Call once at app startup (in root _layout.tsx).
 * Returns an unsubscribe function.
 */
export function initAuth(): () => void {
  void supabase.auth.getSession().then(({ data }) => {
    authStore.session.set(data.session);
    authStore.loading.set(false);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    authStore.session.set(session);
  });

  return () => subscription.unsubscribe();
}
