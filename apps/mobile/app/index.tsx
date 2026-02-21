import { Redirect } from 'expo-router';

// Auth guard: will be replaced with Legend-State session check in Phase 2.
// For now, always redirect to sign-in.
export default function IndexGuard() {
  return <Redirect href="/(auth)/sign-in" />;
}
