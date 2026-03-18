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
 * Optional env var: CLAUDE_FALLBACK_ENABLED=false  → desabilita o fallback para
 *                   Claude quando a ANVISA não retornar resultado. Útil para
 *                   controlar custos ou em ambientes sem ANTHROPIC_API_KEY.
 *                   Defaults to "true" when not set.
 *
 * Request body: { productName: string; activeIngredient: string }
 * Response:     { indications: string[], _debug?: object }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const log: string[] = [];
  const t0 = Date.now();

  let productName = '';
  let activeIngredient = '';

  try {
    const body = await req.json() as { productName?: unknown; activeIngredient?: unknown };
    productName      = typeof body.productName      === 'string' ? body.productName.trim()      : '';
    activeIngredient = typeof body.activeIngredient === 'string' ? body.activeIngredient.trim() : '';
  } catch (e) {
    log.push(`[body] parse error: ${String(e)}`);
    console.error('[get-indications]', log.join(' | '));
    return new Response(
      JSON.stringify({ indications: [], _debug: { log } }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  log.push(`[input] productName="${productName}" activeIngredient="${activeIngredient}"`);

  if (!productName && !activeIngredient) {
    log.push('[input] empty — returning []');
    console.warn('[get-indications]', log.join(' | '));
    return new Response(
      JSON.stringify({ indications: [], _debug: { log } }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Step 1: ANVISA Bulário (fonte primária) ──────────────────────────────────
  let anvisaText: string | null = null;
  {
    const searchName = productName || activeIngredient;
    const url = `https://consultas.anvisa.gov.br/api/consulta/medicamentos/medicamento/?nome=${encodeURIComponent(searchName)}&count=1`;
    log.push(`[anvisa] GET ${url}`);
    try {
      const t = Date.now();
      const r = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      log.push(`[anvisa] status=${r.status} (${Date.now() - t}ms)`);
      if (r.ok) {
        const data = await r.json() as { content?: Array<{ indicacoes?: string }> };
        const indicacoes = data?.content?.[0]?.indicacoes;
        log.push(`[anvisa] indicacoes=${JSON.stringify(indicacoes ?? null)}`);
        if (typeof indicacoes === 'string' && indicacoes.trim().length > 0) {
          anvisaText = indicacoes.trim();
          log.push('[anvisa] ✓ found text');
        } else {
          log.push('[anvisa] no indicacoes field in response');
        }
      } else {
        const body = await r.text();
        log.push(`[anvisa] error body: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      log.push(`[anvisa] exception: ${String(e)}`);
    }
  }

  // ── Step 2: Claude Haiku (fallback — skipped when CLAUDE_FALLBACK_ENABLED=false) ──
  const claudeFallbackEnabled = Deno.env.get('CLAUDE_FALLBACK_ENABLED') !== 'false';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  log.push(`[claude] fallbackEnabled=${claudeFallbackEnabled} hasKey=${Boolean(anthropicKey)}`);

  if (!claudeFallbackEnabled || !anthropicKey) {
    log.push('[claude] skipped');
    console.log('[get-indications]', log.join(' | '), `total=${Date.now() - t0}ms`);
    return new Response(
      JSON.stringify({ indications: [], _debug: { log } }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  const userMsg = anvisaText
    ? `Dado o texto de indicações da bula: "${anvisaText}" — extraia de 3 a 7 termos curtos em português (sintomas ou condições que o medicamento trata). Responda SOMENTE com um array JSON de strings. Exemplo: ["Febre","Dor de cabeça","Enxaqueca"]`
    : `Liste de 3 a 6 indicações terapêuticas (sintomas ou condições tratados) em português para o princípio ativo "${activeIngredient || productName}". Responda SOMENTE com um array JSON de strings. Exemplo: ["Febre","Dor","Infecção"]`;

  log.push(`[claude] mode=${anvisaText ? 'extract-from-anvisa' : 'generate-from-ingredient'}`);

  try {
    const t = Date.now();
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

    log.push(`[claude] status=${claudeRes.status} (${Date.now() - t}ms)`);

    const claudeData = await claudeRes.json() as {
      content?: Array<{ type: string; text: string }>;
      error?: { type: string; message: string };
    };

    if (claudeData.error) {
      log.push(`[claude] API error: ${claudeData.error.type} — ${claudeData.error.message}`);
      console.error('[get-indications]', log.join(' | '));
      return new Response(
        JSON.stringify({ indications: [], _debug: { log } }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const rawText = claudeData.content?.find(b => b.type === 'text')?.text ?? '[]';
    log.push(`[claude] rawText=${JSON.stringify(rawText)}`);

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
    } catch (e) {
      log.push(`[claude] JSON parse error: ${String(e)}`);
      indications = [];
    }

    log.push(`[result] indications=${JSON.stringify(indications)} total=${Date.now() - t0}ms`);
    console.log('[get-indications]', log.join(' | '));

    return new Response(
      JSON.stringify({ indications, _debug: { log } }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    log.push(`[claude] fetch exception: ${String(e)}`);
    console.error('[get-indications]', log.join(' | '));
    return new Response(
      JSON.stringify({ indications: [], _debug: { log } }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
