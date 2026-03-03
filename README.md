# MedStock

Aplicativo de gestão de estoque doméstico de medicamentos para famílias brasileiras.
Funciona em **Android**, **iOS** e **Web** com código compartilhado via Expo SDK 52.

---

## Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Estoque** | Cadastro de medicamentos com validade, lote, localização e unidade. Alertas de vencimento. Swipe-to-delete no mobile. |
| **Receita / Tratamentos** | Cadastro de múltiplos medicamentos em um único fluxo (estilo receita médica). Doses agendadas automaticamente por frequência. |
| **Doses de Hoje** | Dashboard com todas as doses do dia, status (pendente/tomada/pulada) e progresso X/Y. |
| **Registro de Uso Avulso** | Registrar consumo de medicamentos fora de tratamento com histórico por item de estoque. |
| **Catálogo CMED** | Busca em ~50 mil medicamentos (nome, princípio ativo, dosagem, quantidade). Cache offline com FTS5. |
| **Scanner** | Leitura de código de barras EAN-13/8 e OCR de rótulo (validade, lote, dose) via VisionCamera. |
| **Família** | Estoque e tratamentos compartilhados entre membros. Convites por link. Papéis: owner / editor / viewer. |
| **Notificações** | Push de alertas de vencimento próximo (cron diário às 8h via Edge Function). |
| **Offline-first** | Fila de operações pendentes sincronizada ao reconectar via Legend-State. |

---

## Stack Técnico

| Camada | Tecnologia |
|--------|-----------|
| App | Expo SDK 52 + Expo Router 4 (file-based routing) |
| Linguagem | TypeScript 5.5 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| UI | React Native 0.76 / React Native Web 0.19 |
| Estado | Legend-State v2 com `syncedSupabase` |
| Backend | Supabase (PostgreSQL + RLS + Edge Functions) |
| Banco local | `expo-sqlite` com FTS5 (nativo) / LIKE fallback (web) |
| Auth | Supabase Auth — e-mail/senha + Google OAuth |
| Câmera | `react-native-vision-camera` v4 + ML Kit |
| Animações | `react-native-reanimated` v4 |
| Gestos | `react-native-gesture-handler` v2 |
| Validação | Zod 3 (`@medstock/shared`) |
| Build | EAS Build (Expo Application Services) |
| Monorepo | pnpm workspaces |

---

## Estrutura do Monorepo

```
medicine-tracker/
├── apps/
│   ├── mobile/                    # App principal (Android · iOS · Web)
│   │   ├── app/                   # Rotas Expo Router (file-based)
│   │   │   ├── _layout.tsx        # Root: GestureHandler → SafeArea → Toast → Stack
│   │   │   ├── (auth)/            # Sign-in, Sign-up, Forgot password, Convite
│   │   │   ├── (app)/             # Tab navigation autenticada
│   │   │   │   ├── index.tsx      # Aba "Hoje" — doses do dia + alertas de estoque
│   │   │   │   ├── inventory/     # Lista · Adicionar · Detalhe/Editar
│   │   │   │   ├── treatments/    # Lista · Nova Receita · Detalhe
│   │   │   │   ├── catalog/       # Busca CMED · Detalhe do medicamento
│   │   │   │   ├── scanner/       # OCR · Barcode · Resultado
│   │   │   │   └── settings/      # Perfil · Família · Convites
│   │   │   ├── auth/callback.tsx  # Callback OAuth (obrigatório para web)
│   │   │   └── onboarding/        # Criar família
│   │   ├── src/
│   │   │   ├── components/        # DatePickerField (nativo + web), DoseSlotRow
│   │   │   ├── lib/               # supabase.ts · local-db · notifications · haptics · ocr-parser
│   │   │   ├── stores/            # auth · inventory · treatment (Legend-State)
│   │   │   ├── hooks/             # useSession · useLocalSearch
│   │   │   └── utils/             # expiry.ts · treatment.ts
│   │   ├── app.json
│   │   ├── eas.json
│   │   └── package.json
│   │
│   └── api/                       # Supabase backend
│       ├── supabase/
│       │   ├── migrations/        # 18 migrations SQL
│       │   └── functions/
│       │       └── push-expiry/   # Edge Function: notificações de vencimento
│       └── scripts/
│           ├── import-cmed.ts     # Importa ~50k medicamentos do XLSX CMED
│           └── parse-presentation.ts
│
├── packages/
│   ├── shared/  (@medstock/shared) # Tipos TypeScript + validators Zod
│   └── ui/      (@medstock/ui)     # Toast · AnimatedPressable · ConfirmDialog · Skeleton
│
├── .npmrc                          # node-linker=hoisted (obrigatório RN + pnpm)
├── tsconfig.base.json              # TypeScript strict compartilhado
└── pnpm-workspace.yaml
```

---

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 — `npm install -g pnpm`
- **Supabase CLI** — `npm install -g supabase` (para rodar banco localmente)
- **EAS CLI** — `npm install -g eas-cli` (para builds mobile)
- Conta no [Supabase](https://supabase.com) (projeto criado)
- Conta no [Expo](https://expo.dev) (para EAS Build)

---

## Configuração Local

### 1. Instalar dependências

```bash
git clone <repo>
cd medicine-tracker
pnpm install
```

### 2. Variáveis de ambiente

Crie `apps/mobile/.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Para scripts de importação (`apps/api`), crie `apps/api/.env`:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Aplicar migrations no banco

```bash
pnpm --filter api supabase db push
```

Para desenvolvimento local com Supabase CLI:

```bash
pnpm --filter api supabase start    # Sobe PostgreSQL local (Docker)
pnpm --filter api supabase db push  # Aplica as migrations
```

### 4. (Opcional) Importar catálogo CMED

Baixe o XLSX em [ANVISA — Tabela CMED](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos) e execute:

```bash
pnpm --filter api import:cmed -- ./cmed.xlsx
```

### 5. Iniciar o app

```bash
pnpm --filter mobile start    # Expo dev server (web + QR para Expo Go)
pnpm --filter mobile web      # Abrir direto no browser
```

> **Atenção:** módulos nativos (FTS5, VisionCamera, DatePicker) exigem **dev client**, não funcionam no Expo Go padrão. Use `eas build --profile development` para gerar o dev client.

---

## Build Mobile com EAS CLI

As builds são geradas na nuvem pelo [EAS Build](https://docs.expo.dev/build/introduction/) — sem necessidade de Android Studio ou Xcode instalados localmente.

### Login e configuração inicial (uma vez)

```bash
npm install -g eas-cli
eas login                   # Autenticar na conta Expo
cd apps/mobile
eas build:configure         # Gera eas.json com perfis padrão
```

### Perfis de build

| Perfil | Formato | Uso |
|--------|---------|-----|
| `development` | APK / .ipa | Dev client com hot reload e módulos nativos |
| `preview` | APK / .ipa | Testes internos — instalação direta no dispositivo |
| `production` | AAB / .ipa | Publicação no Google Play / App Store |

### Android

```bash
# APK para instalação direta (testes internos)
eas build --platform android --profile preview

# Dev client com módulos nativos (FTS5, VisionCamera, DatePicker)
eas build --platform android --profile development

# AAB para Google Play
eas build --platform android --profile production
```

### iOS

```bash
# IPA para testes via TestFlight
eas build --platform ios --profile preview

# Dev client com módulos nativos
eas build --platform ios --profile development

# IPA para App Store
eas build --platform ios --profile production
```

> **iOS:** requer Apple Developer Account ($99/ano). O EAS gerencia certificados e provisioning profiles automaticamente.

### Acompanhar builds

```bash
eas build:list                   # Listar builds anteriores
eas build:view <build-id>        # Status de uma build específica
```

O terminal exibe um link para a dashboard do Expo onde o APK/IPA fica disponível para download ao final.

### Build local (com Android Studio ou Xcode instalado)

```bash
cd apps/mobile
pnpm android    # expo run:android
pnpm ios        # expo run:ios
```

---

## Comandos Disponíveis

### Raiz do monorepo

```bash
pnpm lint           # ESLint em todos os packages
pnpm format         # Prettier em todos os packages
pnpm typecheck      # TypeScript em todos os packages
pnpm test           # Vitest em todos os packages
```

### apps/mobile

```bash
pnpm --filter mobile start           # Expo dev server
pnpm --filter mobile web             # Dev server + abrir no browser
pnpm --filter mobile android         # Build e run no Android (local)
pnpm --filter mobile ios             # Build e run no iOS (local)
pnpm --filter mobile typecheck       # tsc --noEmit
pnpm --filter mobile test            # Vitest
pnpm --filter mobile test:coverage   # Vitest com relatório de cobertura
```

### apps/api

```bash
pnpm --filter api supabase start     # Subir Supabase local (Docker)
pnpm --filter api supabase stop      # Parar Supabase local
pnpm --filter api supabase db push   # Aplicar migrations
pnpm --filter api supabase db reset  # Resetar banco local
pnpm --filter api supabase db diff   # Gerar migration do diff atual
pnpm --filter api import:cmed        # Importar catálogo CMED
```

---

## Banco de Dados

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Perfis de usuário (nome, avatar) |
| `families` | Famílias — cada família tem um estoque compartilhado |
| `family_members` | Relação usuário ↔ família com papel (owner/editor/viewer) |
| `family_invites` | Convites pendentes (token único com expiração) |
| `inventory_items` | Itens do estoque: medicamento, validade, quantidade, lote, localização |
| `inventory_consumptions` | Histórico de consumo avulso (pessoa, quantidade, data) |
| `medications` | Catálogo CMED (~50k medicamentos) |
| `treatments` | Tratamentos: medicamento, dose, frequência, data início/fim, pessoa |
| `treatment_doses` | Doses registradas (tomada/pulada) com horário e quantidade deduzida |

### Row-Level Security

Todo acesso é filtrado por família via funções `SECURITY DEFINER`:

- `is_family_member(family_id)` — leitura
- `is_family_editor(family_id)` — escrita

### Histórico de migrations

| # | Arquivo | Descrição |
|---|---------|-----------|
| 01 | `000001_extensions` | pgvector, pgsodium |
| 02 | `000002_tables` | Tabelas base + índices |
| 03 | `000003_fts` | Full-text search em medications |
| 04 | `000004_rls` | Row-Level Security policies |
| 05 | `000005_expiry_view` | View de vencimentos por status |
| 06 | `000006_create_family_fn` | RPC criar família |
| 07 | `000007_family_members_fn` | RPC listar membros |
| 08 | `000008_medications_parsed` | Denormalizar dosagem/quantidade |
| 09 | `000009_search_v2` | RPC busca com FTS + ordenação |
| 10 | `000010_accept_invite_fn` | RPC aceitar convite |
| 11 | `000011_push_expiry_cron` | Cron diário → Edge Function notificações |
| 12 | `000012_search_v3` | RPC busca aprimorada |
| 13 | `000013_snapshot` | Snapshot de medication no inventory |
| 14 | `000014_soft_delete_fn` | RPC soft delete com `deleted_at` |
| 15 | `000015_treatments` | Tabelas `treatments` + `treatment_doses` |
| 16 | `000016_consumptions` | Tabela `inventory_consumptions` + RPC `log_consumption` |
| 17 | `000017_search_v4` | Busca expandida por dosagem e quantidade |
| 18 | `000018_log_dose_gotas` | Suporte à unidade "gotas" (1 gota = 0,05 mL) |

### Aplicar migration manual (Supabase Dashboard)

Ao alterar `RETURNS TABLE` de uma função existente, use o SQL Editor do dashboard:

```sql
DROP FUNCTION IF EXISTS public.nome_da_funcao(arg1 type, arg2 type);
-- Em seguida cole o CREATE OR REPLACE
```

---

## Arquitetura

### Fluxo de dados

```
Telas (Expo Router)
  │
  ├── Legend-State stores (estado em memória + otimista)
  │       │
  │       ├── syncedSupabase ──────────► Supabase cloud
  │       └── offline queue ──────────► sincroniza ao reconectar
  │
  ├── expo-sqlite (FTS5/LIKE) ────────► busca catálogo offline
  │
  └── Supabase Auth ──────────────────► expo-secure-store (chunked)
```

### DatePickerField

Componente com implementação separada por plataforma via extensão Metro:

| Arquivo | Plataforma | Implementação |
|---------|-----------|---------------|
| `DatePickerField.tsx` | Android / iOS | Dialog nativo (Android) · Modal spinner (iOS) |
| `DatePickerField.web.tsx` | Web | `<input type="date">` com locale do browser |

O valor é sempre armazenado como `YYYY-MM-DD`. A exibição segue o locale do dispositivo.

### Unidade Gotas

1 gota = 0,05 mL (padrão farmacológico brasileiro). A conversão é aplicada em:
- RPC `log_dose` (dedução do estoque ao registrar dose de tratamento)
- Store `logDose` no cliente (atualização otimista)
- RPC `log_consumption` (consumo avulso)

---

## Componentes UI (`@medstock/ui`)

| Componente | Descrição |
|-----------|-----------|
| `<Toast>` / `useToast()` | Notificações em overlay — success, warning, error |
| `<AnimatedPressable>` | Pressable com feedback de escala via Reanimated |
| `<ConfirmDialog>` | Modal de confirmação (delete, sign-out) |
| `<Skeleton>` | Placeholder animado durante carregamento |

---

## Paleta de Cores

| Nome | Hex | Uso |
|------|-----|-----|
| Teal | `#1A9E96` | Ações primárias, botões, links |
| Coral | `#F0735A` | Alertas, erros, ações destrutivas |
| Amber | `#F5A623` | Avisos, status atenção |
| Sage | `#E8ECE5` | Fundos de cards, separadores |
| Ink | `#1A1D1A` | Texto principal |
| Mist | `#9CA59C` | Texto secundário, placeholders |
| Snow | `#F6F8F5` | Background das telas |

---

## Gotchas Críticos

| # | Problema | Solução |
|---|---------|---------|
| 1 | `pnpm` + React Native | `.npmrc` com `node-linker=hoisted` obrigatório |
| 2 | FTS5 no Expo Go | Requer **dev client** — não funciona no Expo Go padrão |
| 3 | OAuth tokens > 2048 bytes | `expo-secure-store` com adapter chunked em `supabase.ts` |
| 4 | VisionCamera v4 | Requer `react-native-worklets-core` como dep direta |
| 5 | Google OAuth web | Rota `app/auth/callback.tsx` (fora de route groups) com `WebBrowser.maybeCompleteAuthSession()` obrigatória |
| 6 | Tokens OAuth no hash | `url.hash.slice(1)` → `URLSearchParams` — não na query string |
| 7 | `exactOptionalPropertyTypes` | Props opcionais devem ser `prop?: string \| undefined` quando `undefined` é passado explicitamente |
| 8 | `RETURNS TABLE` em migrations | `DROP FUNCTION IF EXISTS` antes do `CREATE OR REPLACE` ao mudar assinatura |
| 9 | CMED colunas mudam mensalmente | Validar `COLUMN_MAP` em `import-cmed.ts` antes de importar novo arquivo |
| 10 | Timezone em datas | Usar `new Date(y, m-1, d)` (local) — nunca `new Date('YYYY-MM-DD')` (UTC midnight) |
