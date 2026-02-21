import { Redirect } from 'expo-router';
import { useSession } from '../src/hooks/useSession';

export default function IndexGuard() {
  const { session, loading } = useSession();
  if (loading) return null;
  return <Redirect href={session ? '/(app)' : '/(auth)/sign-in'} />;
}
