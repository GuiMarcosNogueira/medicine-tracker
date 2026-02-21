import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface InventoryItem {
  id: string;
  family_id: string;
  expiry_date: string;
  custom_name: string | null;
  medications: { product_name: string } | null;
}

interface DeviceToken {
  token: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendExpoPush(tokens: string[], title: string, body: string, data: Record<string, string>): Promise<void> {
  const messages = tokens.map(to => ({ to, title, body, data, sound: 'default' }));
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);

  // Find items expiring in exactly 30, 15, 7, or 0 days from today
  const thresholds = [30, 15, 7, 0];
  const today = new Date();

  for (const days of thresholds) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().slice(0, 10); // YYYY-MM-DD

    const { data: items } = await supabase
      .from('inventory_items')
      .select('id, family_id, expiry_date, custom_name, medications(product_name)')
      .eq('expiry_date', dateStr)
      .is('deleted_at', null);

    if (!items || items.length === 0) continue;

    // Group by family to batch-fetch tokens once per family
    const familyMap = new Map<string, InventoryItem[]>();
    for (const item of items as InventoryItem[]) {
      const list = familyMap.get(item.family_id) ?? [];
      list.push(item);
      familyMap.set(item.family_id, list);
    }

    for (const [familyId, familyItems] of familyMap) {
      // Get push tokens for all family members
      const { data: members } = await supabase
        .from('family_members')
        .select('profile_id')
        .eq('family_id', familyId);

      if (!members || members.length === 0) continue;

      const userIds = members.map((m: { profile_id: string }) => m.profile_id);
      const { data: tokens } = await supabase
        .from('device_tokens')
        .select('token')
        .in('user_id', userIds);

      if (!tokens || tokens.length === 0) continue;
      const pushTokens = (tokens as DeviceToken[]).map(t => t.token);

      for (const item of familyItems) {
        const name = item.medications?.product_name ?? item.custom_name ?? 'Medicamento';
        const title = days === 0
          ? `${name} vence hoje!`
          : `${name} vence em ${days} dia${days > 1 ? 's' : ''}`;

        await sendExpoPush(
          pushTokens,
          title,
          'Verifique seu estoque e renove se necessário.',
          { itemId: item.id },
        );
      }
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
