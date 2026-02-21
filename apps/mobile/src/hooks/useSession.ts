import { useSelector } from '@legendapp/state/react';
import { authStore } from '../stores/auth.store';

export function useSession() {
  const session = useSelector(authStore.session);
  const loading = useSelector(authStore.loading);
  return { session, loading, isAuthenticated: session !== null };
}
