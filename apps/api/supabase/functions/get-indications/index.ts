/**
 * Edge Function: get-indications
 *
 * Returns therapeutic indication tags for a medication in Portuguese.
 *
 * Strategy:
 * 1. Try the ANVISA Bulário API (official Brazilian package-insert database).
 *    If it returns an "indicacoes" text, use that as context.
 * 2. Call Claude Haiku to either extract structured tags from the ANVISA text
 *    or generate them from the active ingredient name as fallback.
 *
 * Required env var: ANTHROPIC_API_KEY
 *
 * Request body: { productName: string; activeIngredient: string }
 * Response:     { indications: string[] }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let productName = '';
  let activeIngredient = '';

  try {
    const body = await req.json() as { productName?: unknown; activeIngredient?: unknown };
    productName     = typeof body.productName     === 'string' ? body.productName.trim()     : '';
    activeIngredient = typeof body.activeIngredient === 'string' ? body.activeIngredient.trim() : '';
  } catch {
    return new Response(
      JSON.stringify({ indications: [] }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!productName && !activeIngredient) {
    return new Response(
      JSON.stringify({ indications: [] }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Step 1: Try ANVISA Bulário ──────────────────────────────────────────────
  let anvisaText: string | null = null;
  try {
    const searchName = productName || activeIngredient;
    const r = await fetch(
      `https://consultas.anvisa.gov.br/api/consulta/medicamentos/medicamento/?nome=${encodeURIComponent(searchName)}&count=1`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (r.ok) {
      const data = await r.json() as { content?: Array<{ indicacoes?: string }> };
      const indicacoes = data?.content?.[0]?.indicacoes;
      if (typeof indicacoes === 'string' && indicacoes.trim().length > 0) {
        anvisaText = indicacoes.trim();
      }
    }
  } catch {
    // silently fall through to Claude
  }

  // ── Step 2: Claude Haiku ────────────────────────────────────────────────────
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ indications: [] }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const userMsg = anvisaText
    ? `Dado o texto de indicações da bula: "${anvisaText}" — extraia de 3 a 7 termos curtos em português (sintomas ou condições que o medicamento trata). Responda SOMENTE com um array JSON de strings. Exemplo: ["Febre","Dor de cabeça","Enxaqueca"]`
    : `Liste de 3 a 6 indicações terapêuticas (sintomas ou condições tratados) em português para o princípio ativo "${activeIngredient || productName}". Responda SOMENTE com um array JSON de strings. Exemplo: ["Febre","Dor","Infecção"]`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const claudeData = await claudeRes.json() as {
      content?: Array<{ type: string; text: string }>;
    };

    const rawText = claudeData.content?.find(b => b.type === 'text')?.text ?? '[]';

    // Extract JSON array from response (Claude may wrap it in markdown code fences)
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

    return new Response(
      JSON.stringify({ indications }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch {
    return new Response(
      JSON.stringify({ indications: [] }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
