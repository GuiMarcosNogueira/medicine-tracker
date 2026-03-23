import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession } from '../src/hooks/useSession';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '@medstock/ui';

export default function IndexGuard() {
  const { session, loading } = useSession();
  const [familyLoading, setFamilyLoading] = useState(true);
  const [hasFamily, setHasFamily] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      setFamilyLoading(false);
      return;
    }
    void checkFamily();
  }, [session, loading]);

  async function checkFamily() {
    setFamilyLoading(true);
    const { data } = await supabase
      .from('family_members')
      .select('family_id')
      .limit(1)
      .maybeSingle();
    setHasFamily(!!data);
    setFamilyLoading(false);
  }

  if (loading || (session && familyLoading)) {
    return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!hasFamily) return <Redirect href="/onboarding/create-family" />;
  return <Redirect href="/(app)" />;
}
