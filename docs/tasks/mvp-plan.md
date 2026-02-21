# MedStock — MVP Implementation Plan

> App de gestão de estoque doméstico de medicamentos para famílias brasileiras.
> Funciona em Android, iOS e Web com código compartilhado via Expo SDK 52.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | pnpm workspaces + TypeScript strict |
| Mobile/Web | Expo SDK 52 + Expo Router 4 (file-based routing) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Estado/Sync | Legend-State v3 com plugin syncedSupabase |
| Cache local | expo-sqlite com FTS5 (nativo) / LIKE fallback (web) |
| OCR | react-native-vision-camera v4 + react-native-vision-camera-mlkit |
| Validação | Zod (schemas compartilhados em packages/shared) |
| Auth storage | expo-secure-store (adapter chunked para token OAuth) |

---

## Fases de Implementação

### Fase 0 — Bootstrap do Monorepo ✅
**Commit:** `feat(monorepo): bootstrap pnpm workspace with Expo SDK 52, shared packages, TypeScript strict`

Estrutura raiz criada com pnpm workspaces, tsconfig strict, ESLint, Prettier e CLAUDE.md.

**Arquivos críticos:**
- `.npmrc` — `node-linker=hoisted` (obrigatório: Metro não resolve módulos nativos com isolated mode)
- `apps/mobile/metro.config.js` — `watchFolders` + `nodeModulesPaths` para o workspace root
- `packages/shared` (`@medstock/shared`) — tipos e validators Zod compartilhados
- `packages/ui` (`@medstock/ui`) — componentes UI reutilizáveis

**Verificação:**
1. `pnpm install` — sem erros
2. `pnpm typecheck` — limpo
3. `pnpm lint` — limpo
4. `pnpm --filter mobile start` — Expo server inicia

---

### Fase 1 — Schema do Banco de Dados
**Commit:** `feat(db): define full Supabase schema — tables, Portuguese FTS, RLS policies`

**Migrations em `apps/api/supabase/migrations/`:**

| Arquivo | Conteúdo |
|---------|---------|
| `000001_extensions.sql` | uuid-ossp, unaccent, pg_trgm; TEXT SEARCH CONFIGURATION `portuguese_unaccent` |
| `000002_tables.sql` | profiles, families, family_members, family_invites, medications, inventory_items, device_tokens, notification_log |
| `000003_fts.sql` | TSVECTOR trigger em medications; RPC `search_medications()` com ranking |
| `000004_rls.sql` | RLS em todas as tabelas; helpers `is_family_member()` / `is_family_editor()` |

**Configuração FTS em Português:**
```sql
CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = pg_catalog.portuguese);
ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
```

**Pesos FTS em medications:** A=product_name, B=generic_name+active_ingredient, C=atc_description, D=manufacturer

**RLS:** medications é público para `authenticated`; inventory_items é isolado por família via `is_family_member(family_id)`.

**Verificação:**
1. `supabase db reset` — todas as migrations aplicam
2. `SELECT to_tsvector('portuguese_unaccent', 'Paracetamol comprimido')` — tokeniza
3. Insert medicamento → `search_vector` auto-populado pelo trigger
4. Usuário A não consegue ler inventory_items do usuário B (RLS isolado)

---

### Fase 2 — Autenticação
**Commit:** `feat(auth): implement Supabase Auth email+password, Google OAuth, family creation, invite flow`

**Novas dependências (apps/mobile):**
`@supabase/supabase-js`, `expo-auth-session`, `expo-secure-store`, `expo-web-browser`

**Telas Expo Router:**
```
app/(auth)/sign-in.tsx, sign-up.tsx, forgot-password.tsx
app/(auth)/invite/[token].tsx     → deep link: medstock://auth/invite/<token>
app/(app)/onboarding/create-family.tsx
app/index.tsx                     → guard: redireciona para (auth) ou (app)
```

**Arquivos críticos:**
- `src/lib/supabase.ts` — cliente com **SecureStore adapter chunked** (tokens Google OAuth excedem 2048 bytes; divididos em chunks de 2000 bytes)
- `src/stores/auth.store.ts` — Legend-State observable com `session` + `loading`
- `packages/shared/src/validators/auth.ts` — `signInSchema`, `signUpSchema`, `familySchema`

**Verificação:**
1. Signup por email → profile criado em `public.profiles`
2. Sessão persiste após reiniciar o app
3. OAuth Google completa em device físico
4. Família criada → rows em `families` + `family_members` (role=owner)
5. Deep link de convite → membro entra na família

---

### Fase 3 — Catálogo de Medicamentos
**Commit:** `feat(catalog): CMED import script, medication table, Portuguese FTS search RPC and UI`

**Novas dependências (apps/api):** `xlsx`, `tsx`

**Script de importação:** `apps/api/scripts/import-cmed.ts`
- Lê XLS da CMED via `xlsx`
- Mapeamento de colunas: `PRODUTO→product_name`, `SUBSTANCIA→active_ingredient`, `EAN_1→ean`, `PF_0%→reference_price`, etc.
- Upsert em batches de 500 com service-role key (bypassa RLS)
- Execução: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm tsx scripts/import-cmed.ts cmed.xlsx`

> ⚠️ Os nomes das colunas do CMED mudam a cada release mensal da ANVISA. Validar o `COLUMN_MAP` antes de cada importação.

**Telas:**
```
app/(app)/catalog/index.tsx   → busca com debounce 300ms → supabase.rpc('search_medications')
app/(app)/catalog/[id].tsx    → detalhe do medicamento
```

**Verificação:**
1. Script importa ~50k rows sem erros
2. `SELECT count(*) FROM medications` — contagem esperada
3. `SELECT * FROM search_medications('paracetamol')` — resultados ranqueados
4. UI: digitar "dipirona" → resultados em <300ms

---

### Fase 4 — Gestão do Inventário
**Commit:** `feat(inventory): CRUD inventory items, expiry dashboard, Legend-State Supabase sync`

**Novas dependências:** `@legendapp/state`, `date-fns`

**Telas:**
```
app/(app)/index.tsx              → Dashboard: alertas de validade (30/15/7 dias / vencidos)
app/(app)/inventory/index.tsx    → Lista + busca por nome ou sintoma
app/(app)/inventory/add.tsx      → Formulário de adição (manual ou via scan)
app/(app)/inventory/[id].tsx     → Detalhe + editar + excluir
```

**Arquivos críticos:**
- `src/stores/inventory.store.ts` — `syncedSupabase` com `fieldDeleted: 'deleted_at'`, `changesSince: 'last-sync'`, `as: 'Map'`, `retry: { infinite: true }`
- `src/utils/expiry.ts` — `getExpiryStatus()` → `'expired'|'critical'|'warning'|'ok'` (thresholds: 0/7/15/30 dias)
- `app/(app)/_layout.tsx` — detecta `Platform.OS === 'web'` → sidebar; mobile → Tabs
- `packages/shared/src/validators/inventory.ts` — `inventoryItemSchema` (validade em `AAAA-MM-DD`, `medicationId OR customName`)

**Verificação:**
1. Adicionar item → aparece no Supabase em <1 segundo
2. Editar/excluir propaga; soft delete define `deleted_at`
3. Dashboard agrupa corretamente por threshold de vencimento
4. Dois membros da família veem o mesmo inventário; outras famílias não conseguem (RLS)

---

### Fase 5 — Scanner OCR
**Commit:** `feat(ocr): VisionCamera v4 ML Kit text recognition, regex extraction, OCR result review screen`

**Novas dependências:** `react-native-vision-camera` (v4), `react-native-vision-camera-mlkit`, `react-native-worklets-core`

> ⚠️ Requer dev client customizado (`expo run:ios` / `expo run:android`). Expo Go não suporta frame processors. Instalar `react-native-worklets-core` como dependência direta.

**`app.json` — plugins necessários:**
```json
["react-native-vision-camera", { "enableCodeScanner": true, "cameraPermissionText": "..." }],
["expo-sqlite", { "enableFTS": true }]
```

**Telas:**
```
app/(app)/scanner/ocr.tsx       → Câmera + useTextRecognition a 2fps
app/(app)/scanner/result.tsx    → Formulário pré-preenchido pelo OCR; usuário corrige e salva
```

**Parser de regex (`src/lib/ocr-parser.ts`):**
| Campo | Regex |
|-------|-------|
| Validade | `/(?:val\|venc\|exp)\s*:?\s*(\d{2})[\/\-](\d{4})/i` → normaliza `MM/YYYY` para `YYYY-MM-DD` (último dia do mês) |
| Lote | `/(?:lote\|lot)\s*:?\s*([A-Z0-9-]{3,20})/i` |
| Dose | `/(\d+(?:[.,]\d+)?)\s*(?:mg\|ml\|g\|mcg\|ui)\b/i` |
| EAN | `/\b(\d{13})\b/` |

**Verificação:**
1. Câmera abre com dialog de permissão no device físico
2. OCR dispara a 2fps; validade `MM/YYYY` parseada corretamente
3. Tela de resultado pré-preenche campos; usuário salva no inventário

---

### Fase 6 — Scanner de Código de Barras
**Commit:** `feat(barcode): EAN-13/8 barcode scanner with catalog auto-fill via VisionCamera CodeScanner`

**Tela:** `app/(app)/scanner/barcode.tsx`
- Usa `useCodeScanner` nativo do VisionCamera (sem pacote adicional; `enableCodeScanner: true` já configurado)
- Lê EAN-13/8 → `supabase.from('medications').eq('ean', ean).maybeSingle()`
- Match → navega para `inventory/add` com `medicationId` + `productName` pré-preenchidos
- Sem match → navega para `scanner/result` para entrada manual

**Verificação:**
1. Scan EAN-13 de caixa de Tylenol → match no catálogo → formulário pré-preenchido
2. EAN desconhecido → tela de resultado com nome em branco

---

### Fase 7 — Sincronização Offline
**Commit:** `feat(offline): expo-sqlite FTS5 local cache, bidirectional sync, LIKE fallback for web`

**Arquivos críticos:**

`src/lib/local-db.ts` — `openDatabaseSync('medstock.db')` com:
- Tabela `medications_cache`
- Virtual table FTS5 `medications_fts` com `content='medications_cache'` e `tokenize='unicode61 remove_diacritics 2'` (nativo apenas)
- Triggers de sync FTS (INSERT/UPDATE/DELETE)
- Tabela `inventory_cache` com coluna `_pending INTEGER` para mudanças locais não sincronizadas
- Web: pula criação do FTS5 (WASM SQLite não suporta FTS5)

`src/hooks/useLocalSearch.ts` — branching por plataforma:
- Nativo: `SELECT FROM medications_fts WHERE medications_fts MATCH ?` (prefix `query + '*'`)
- Web: `SELECT FROM medications_cache WHERE product_name LIKE ? OR active_ingredient LIKE ?`

**Verificação:**
1. Primeiro carregamento → catálogo cacheado em `medications_cache`
2. Modo avião → busca funciona via FTS5
3. Adicionar item offline → `_pending=1` → reconectar → sincroniza com Supabase
4. Segundo device (mesma família) recebe item via Realtime
5. Web → fallback LIKE funciona sem erros de FTS5

---

### Fase 8 — Notificações
**Commit:** `feat(notifications): expo-notifications push token registration, Edge Function expiry alerts, local scheduling fallback`

**Novas dependências:** `expo-notifications`, `expo-device`

**Arquivos críticos:**

`src/lib/notifications.ts`:
- `registerPushToken()` — solicita permissão, obtém token Expo, upsert em `device_tokens`; Android cria canal `expiry-alerts`
- `scheduleExpiryNotifications(items)` — cancela tudo e reagenda notificações locais para 30/15/7 dias antes de cada `expiry_date`

`apps/api/supabase/functions/push-expiry/index.ts` — Edge Function Deno:
- Acionada por database webhook em `inventory_items`
- Busca device tokens de todos os membros da família
- Envia via Expo Push API

`migrations/000006_expiry_cron.sql` — `CREATE VIEW expiring_today` (itens com 30/15/7/0 dias). Cron via Supabase Pro (pg_cron) ou Scheduled Functions pelo dashboard.

**Verificação:**
1. Device físico: permissão concedida; token em `device_tokens`
2. Alterar validade para hoje+7 → Edge Function dispara → notificação recebida
3. Notificação local agendada dispara com app fechado
4. Android: notificação no canal `expiry-alerts` com vibração

---

## Mapa de Telas (Expo Router)

```
app/
├── index.tsx                           # Guard: → (auth)/sign-in ou (app)
├── +not-found.tsx
├── (auth)/
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   ├── sign-up.tsx
│   ├── forgot-password.tsx
│   └── invite/[token].tsx              # medstock://auth/invite/<token>
└── (app)/
    ├── _layout.tsx                     # Tabs (mobile) / Sidebar (web)
    ├── index.tsx                       # Dashboard de vencimentos
    ├── inventory/
    │   ├── index.tsx                   # Lista + busca
    │   ├── add.tsx                     # Adicionar item
    │   └── [id].tsx                    # Detalhe + editar
    ├── catalog/
    │   ├── index.tsx                   # Busca no catálogo
    │   └── [id].tsx                    # Detalhe do medicamento
    ├── scanner/
    │   ├── ocr.tsx                     # Scanner OCR
    │   ├── barcode.tsx                 # Scanner EAN
    │   └── result.tsx                  # Revisão do resultado
    ├── settings/
    │   ├── index.tsx
    │   ├── family.tsx
    │   ├── invite.tsx
    │   └── profile.tsx
    └── onboarding/
        └── create-family.tsx
```

---

## Dependências Completas

### `apps/mobile`
```
expo ~52.0.0, expo-router ~4.0.0, react 18.3.1, react-native 0.76.x
@supabase/supabase-js ^2.x, expo-secure-store ~14.0.x, expo-auth-session ~6.0.x, expo-web-browser ~14.0.x
@legendapp/state ^3.x, date-fns ^3.x
expo-sqlite ~15.x
react-native-vision-camera ^4.x, react-native-vision-camera-mlkit ^1.x, react-native-worklets-core ^1.x
expo-notifications ~0.29.x, expo-device ~7.0.x
react-native-safe-area-context 4.12.x, react-native-screens ~4.0.x
@medstock/shared workspace:*, @medstock/ui workspace:*
```

### `packages/shared`
```
zod ^3.23.x
```

### `apps/api` (scripts)
```
xlsx ^0.18.x, tsx ^4.x, @supabase/supabase-js ^2.x
```

---

## Estratégia de Testes

| Tipo | Ferramenta | Cobertura |
|------|-----------|----------|
| Unitário | Vitest | Validators Zod, OCR parser (15+ formatos), thresholds de vencimento |
| Integração | Jest | Auth store, Legend-State optimistic update/sync retry |
| E2E | Maestro | Onboarding, adição manual, scan EAN, round-trip offline |
| SQL | pgTAP/manual | RLS isolamento, FTS com acentos, trigger de profile |

---

## Gotchas Críticos

1. **pnpm + React Native → hoisted obrigatório** — `.npmrc` deve ter `node-linker=hoisted`; isolated mode quebra o Metro
2. **FTS5 requer dev client** — `expo run:ios/android`; não funciona no Expo Go
3. **SecureStore limite de 2048 bytes** — tokens OAuth Google excedem o limite; adapter chunked em `supabase.ts` é obrigatório
4. **VisionCamera v4 + Worklets** — `react-native-worklets-core` deve ser dependência direta; `frameProcessorFps={2}` economiza bateria
5. **Legend-State requer `updated_at`** — `changesSince` depende dessa coluna + trigger em todas as tabelas sincronizadas
6. **Colunas CMED mudam** — re-validar `COLUMN_MAP` no script de importação a cada release mensal da ANVISA
7. **Web sidebar** — `(app)/_layout.tsx` deve ramificar em `Platform.OS === 'web'` para sidebar vs tabs

---

## Referências

- [Expo Monorepo Guide](https://docs.expo.dev/guides/monorepos/)
- [Legend-State Supabase Plugin](https://legendapp.com/open-source/state/v3/sync/supabase/)
- [Local-first com Expo e Legend-State — Supabase Blog](https://supabase.com/blog/local-first-expo-legend-state)
- [react-native-vision-camera-mlkit](https://github.com/pedrol2b/react-native-vision-camera-mlkit)
- [ANVISA CMED Preços](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos)
- [expo-sqlite Modern SQLite — Expo Blog](https://expo.dev/blog/modern-sqlite-for-react-native-apps)
- [Expo Push Notifications via Supabase Edge Functions](https://supabase.com/docs/guides/functions/examples/push-notifications)
