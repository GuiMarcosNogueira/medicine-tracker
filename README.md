# MedStock 💊

Gerenciador de estoque doméstico de medicamentos para famílias brasileiras.
Controle validades, quantidades e compartilhe o estoque com sua família — em Android, iOS e Web, com um único código-fonte.

---

## Funcionalidades

| # | Feature | Descrição |
|---|---------|-----------|
| 1 | **Autenticação** | Login com e-mail/senha ou Google OAuth; convite de membros por link |
| 2 | **Gestão familiar** | Perfil de família com papéis (owner / editor / viewer) e convites por token |
| 3 | **Catálogo CMED** | ~50 mil medicamentos da tabela ANVISA com busca full-text em português (FTS5) |
| 4 | **Estoque** | CRUD de itens com validade, lote, quantidade, unidade e localização |
| 5 | **Dashboard de validade** | Seções por status: Vencido · ≤7 dias · ≤15 dias · ≤30 dias · OK |
| 6 | **Scanner OCR** | Leitura de rótulos via câmera (VisionCamera + ML Kit) extraindo validade, lote, dose e EAN |
| 7 | **Scanner de código de barras** | Leitura de EAN-13/8 com preenchimento automático do catálogo |
| 8 | **Sincronização offline** | Cache SQLite local com FTS5; itens adicionados offline sincronizam ao reconectar |
| 9 | **Notificações push** | Alertas de vencimento (30 / 15 / 7 / 0 dias) via Expo Push + Edge Function Supabase |

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | pnpm workspaces + TypeScript strict |
| Mobile / Web | Expo SDK 52 + Expo Router 4 (file-based routing) |
| Backend | Supabase (PostgreSQL 15 + Auth + Realtime + Edge Functions) |
| Estado / Sync | Legend-State v2 com `syncedSupabase` |
| Cache local | expo-sqlite com FTS5 (nativo) / LIKE fallback (web) |
| OCR | react-native-vision-camera v4 + react-native-vision-camera-mlkit |
| Validação | Zod (schemas compartilhados em `packages/shared`) |
| Auth storage | expo-secure-store com adapter chunked (tokens OAuth > 2 KB) |
| Testes | Vitest + @vitest/coverage-v8 (cobertura ≥ 95%) |

---

## Estrutura do monorepo

```
medicine-tracker/
├── apps/
│   ├── mobile/                   # Expo SDK 52 — Android, iOS e Web
│   │   ├── app/
│   │   │   ├── (auth)/           # sign-in, sign-up, forgot-password, invite/[token]
│   │   │   └── (app)/
│   │   │       ├── index.tsx     # Dashboard de validades
│   │   │       ├── inventory/    # Lista · Adicionar · Detalhe
│   │   │       ├── catalog/      # Busca · Detalhe do medicamento
│   │   │       ├── scanner/      # OCR · Barcode · Resultado
│   │   │       ├── settings/     # Perfil · Família · Convites
│   │   │       └── onboarding/   # Criar família
│   │   └── src/
│   │       ├── lib/              # supabase.ts · local-db.ts · notifications.ts · ocr-parser.ts
│   │       ├── stores/           # auth.store.ts · inventory.store.ts (Legend-State)
│   │       ├── hooks/            # useSession · useLocalSearch
│   │       └── utils/            # expiry.ts
│   │
│   └── api/                      # Supabase backend
│       ├── supabase/
│       │   ├── migrations/       # 5 migrations SQL (extensões, tabelas, FTS, RLS, view)
│       │   └── functions/
│       │       └── push-expiry/  # Edge Function — alertas de vencimento
│       └── scripts/
│           └── import-cmed.ts    # Importação da tabela CMED/ANVISA (.xlsx)
│
├── packages/
│   ├── shared/                   # @medstock/shared — tipos TS + validators Zod
│   │   └── src/
│   │       ├── types/            # auth · inventory · medication
│   │       └── validators/       # auth · inventory · medication
│   └── ui/                       # @medstock/ui — componentes React Native/Web
│
├── .npmrc                        # node-linker=hoisted (obrigatório para RN + pnpm)
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

---

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Supabase CLI** (`brew install supabase/tap/supabase` ou [docs](https://supabase.com/docs/guides/cli))
- **Android Studio** (para build Android) ou **Xcode** (para build iOS)
- Conta no [Supabase](https://supabase.com) (projeto criado)
- Conta no [Expo](https://expo.dev) (para push notifications)

---

## Instalação

```bash
git clone https://github.com/GuiMarcosNogueira/medicine-tracker.git
cd medicine-tracker
pnpm install
```

### Variáveis de ambiente

Crie `apps/mobile/.env.local` com:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
```

### Banco de dados

```bash
# Aplicar todas as migrations no projeto Supabase Cloud
pnpm --filter api db:push

# (Opcional) Subir Supabase local para desenvolvimento (requer Docker)
pnpm --filter api start
```

### Importar catálogo CMED/ANVISA

Baixe a tabela CMED mais recente em [anvisa.gov.br](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos).

Exporte as variáveis de ambiente antes de rodar (o script usa a service role key para ignorar RLS):

```bash
export SUPABASE_URL=https://<seu-projeto>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key>
```

Em seguida execute o script passando o **caminho absoluto** para o arquivo `.xlsx`:

```bash
pnpm --filter api import:cmed -- /caminho/absoluto/para/cmed.xlsx
```

> **Atenção:** os nomes das colunas da tabela CMED mudam a cada publicação mensal da ANVISA. Verifique o `COLUMN_MAP` no script antes de importar.

---

## Desenvolvimento

```bash
# Iniciar servidor Expo (QR code para Expo Go ou dev client)
pnpm --filter mobile start

# Build dev client — Android (requer Android Studio)
pnpm --filter mobile android

# Build dev client — iOS (requer macOS + Xcode)
pnpm --filter mobile ios

# Web
pnpm --filter mobile web
```

> **Importante:** funcionalidades que usam câmera (OCR, barcode) e SQLite FTS5 **não funcionam no Expo Go** — é necessário o dev client (`expo run:android` / `expo run:ios`).

---

## Testes

```bash
# Rodar todos os testes
pnpm --filter @medstock/shared test
pnpm --filter mobile test

# Com relatório de cobertura
pnpm --filter @medstock/shared exec vitest run --coverage
pnpm --filter mobile exec vitest run --coverage
```

### Cobertura atual

| Pacote | Testes | Statements | Branches | Functions | Lines |
|--------|--------|-----------|----------|-----------|-------|
| `@medstock/shared` | 53 | 100% | 100% | 100% | 100% |
| `apps/mobile` (OCR + expiry) | 55 | 100% | 100% | 100% | 100% |

---

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm lint` | ESLint em todo o monorepo |
| `pnpm format` | Prettier em todo o monorepo |
| `pnpm typecheck` | TypeScript strict em todos os packages |
| `pnpm test` | Vitest em todos os packages |
| `pnpm --filter mobile start` | Servidor Expo dev |
| `pnpm --filter mobile android` | Build dev client Android |
| `pnpm --filter mobile ios` | Build dev client iOS |
| `pnpm --filter api db:push` | Aplicar migrations |
| `pnpm --filter api start` | Subir Supabase local |
| `pnpm --filter api import:cmed -- /path/to/cmed.xlsx` | Importar catálogo CMED/ANVISA |

---

## Arquitetura — decisões relevantes

### pnpm + React Native → modo hoisted obrigatório

O `.npmrc` contém `node-linker=hoisted`. Sem isso, o Metro Bundler não resolve módulos nativos no monorepo.

### SecureStore — adapter chunked

Tokens OAuth do Google excedem o limite de 2 048 bytes do `expo-secure-store`. O cliente Supabase em `src/lib/supabase.ts` usa um adapter que divide tokens em chunks de 2 000 bytes distribuídos em múltiplas chaves.

### FTS5 — apenas no dev client

`expo-sqlite` com FTS5 só funciona com o dev client (`expo run:android/ios`). Na web, o WASM SQLite não inclui FTS5 e a busca cai para `LIKE` fallback.

### Timezone brasileiro — parseLocalDate

`new Date('YYYY-MM-DD')` interpreta meia-noite UTC, que no fuso UTC-3 (Brasília) corresponde ao dia anterior. A função `parseLocalDate` usa `new Date(year, month-1, day)` para garantir que a data de validade exibida seja a data local correta.

### Legend-State + noUncheckedIndexedAccess

Legend-State v2 com `noUncheckedIndexedAccess` retorna `(T | undefined)[]` ao iterar observables. O cast `rawItems as InventoryRow[]` é necessário após verificação de tipo.

### CMED — colunas mudam mensalmente

A ANVISA publica a tabela CMED mensalmente e os nomes das colunas variam entre versões. Sempre valide o `COLUMN_MAP` em `apps/api/scripts/import-cmed.ts` antes de importar uma nova versão.

---

## Banco de dados

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `profiles` | Espelho de `auth.users`; criado automaticamente via trigger |
| `families` | Grupos familiares |
| `family_members` | Relação usuário–família com role (`owner` / `editor` / `viewer`) |
| `family_invites` | Tokens de convite com validade de 7 dias |
| `medications` | Catálogo CMED com FTS em português (weighted: nome > genérico > ATC) |
| `inventory_items` | Itens do estoque familiar com soft delete via `deleted_at` |
| `device_tokens` | Tokens Expo Push para notificações |

### RLS (Row-Level Security)

Todas as tabelas têm RLS ativo:
- `medications`: leitura pública para usuários autenticados (catálogo global)
- `inventory_items`: leitura por membros, escrita por editores/owners — sempre escopado por `family_id`

---

## Edge Function — push-expiry

Função Deno hospedada no Supabase que:
1. Consulta itens vencendo em 0 / 7 / 15 / 30 dias
2. Agrupa por família e busca tokens de dispositivo
3. Envia notificações via [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)

Acionada por webhook do banco (mudança em `inventory_items`) ou por cron diário às 08h00.

---

## Contribuindo

1. Crie um branch a partir de `main`: `git checkout -b feat/minha-feature`
2. Implemente as mudanças seguindo as convenções em `CLAUDE.md`
3. Rode `pnpm typecheck && pnpm test` antes do commit
4. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): descrição`
5. Abra um Pull Request

---

## Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.
