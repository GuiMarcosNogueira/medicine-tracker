/**
 * Edge Function: get-indications
 *
 * Returns therapeutic indication tags for a medication in Portuguese
 * using Claude Haiku.
 *
 * Required env var: ANTHROPIC_API_KEY
 * Request body:     { productName: string; activeIngredient: string }
 * Response:         { indications: string[] }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  let productName = '';
  let activeIngredient = '';

  try {
    const body = await req.json() as { productName?: unknown; activeIngredient?: unknown };
    productName      = typeof body.productName      === 'string' ? body.productName.trim()      : '';
    activeIngredient = typeof body.activeIngredient === 'string' ? body.activeIngredient.trim() : '';
  } catch {
    return json({ indications: [] });
  }

  if (!productName && !activeIngredient) {
    return json({ indications: [] });
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!anthropicKey) {
    console.error('[get-indications] ANTHROPIC_API_KEY not set');
    return json({ indications: [] });
  }

  const prompt = `Liste de 3 a 6 indicações terapêuticas (sintomas ou condições tratados) em português para o medicamento "${productName || activeIngredient}" (princípio ativo: "${activeIngredient || productName}"). Responda SOMENTE com um array JSON de strings curtas. Exemplo: ["Febre","Dor","Infecção"]`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json() as {
      content?: Array<{ type: string; text: string }>;
      error?: { type: string; message: string };
    };

    if (data.error) {
      console.error('[get-indications] Claude error:', data.error.message);
      return json({ indications: [] });
    }

    const rawText = data.content?.find(b => b.type === 'text')?.text ?? '[]';
    const match = rawText.match(/\[[\s\S]*\]/);
    const jsonStr = match?.[0] ?? '[]';

    let indications: string[] = [];
    try {
      const parsed = JSON.parse(jsonStr) as unknown;
      if (Array.isArray(parsed)) {
        indications = parsed
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map(s => s.trim())
          .slice(0, 15);
      }
    } catch {
      indications = [];
    }

    console.log(`[get-indications] ${productName} → ${JSON.stringify(indications)}`);
    return json({ indications });
  } catch (e) {
    console.error('[get-indications] fetch error:', String(e));
    return json({ indications: [] });
  }
});
