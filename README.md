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
| Animações | `react-native-reanimated` v3 |
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
├── patches/                        # Patches de compatibilidade (pnpm patch)
├── .vscode/launch.json             # Configurações de debug do VSCode
├── .npmrc                          # node-linker=hoisted (obrigatório RN + pnpm)
├── tsconfig.base.json              # TypeScript strict compartilhado
└── pnpm-workspace.yaml
```

---

## Pré-requisitos

### Obrigatórios (todos os ambientes)

| Ferramenta | Versão | Instalação |
|-----------|--------|-----------|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) ou `nvm install 20` |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| EAS CLI | ≥ 18 | `npm install -g eas-cli` |
| Git | qualquer | já instalado na maioria dos sistemas |

### Para builds locais (Android)

> Necessário apenas se quiser compilar sem usar o EAS cloud.

| Ferramenta | Versão | Instalação |
|-----------|--------|-----------|
| Java (JDK) | 17 | `sudo apt install openjdk-17-jdk` (Linux/WSL2) |
| Android SDK | — | [command line tools](https://developer.android.com/studio#command-line-tools-only) |

Após instalar, adicione ao `~/.zshrc` ou `~/.bashrc`:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/android
export ANDROID_SDK_ROOT=$ANDROID_HOME
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
```

Instale os pacotes do SDK:
```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "build-tools;35.0.0" "platforms;android-35"
```

### Para debug no dispositivo físico

Instale `adb`:

```bash
# Linux / WSL2
sudo apt install adb

# macOS
brew install android-platform-tools
```

---

## Configuração Local

### 1. Clonar e instalar dependências

```bash
git clone <repo-url>
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

> As chaves estão no painel do Supabase em **Project Settings → API**.

### 3. Aplicar migrations no banco

```bash
# Banco remoto (Supabase cloud)
pnpm --filter api supabase db push

# Banco local (requer Docker)
pnpm --filter api supabase start
pnpm --filter api supabase db push
```

### 4. (Opcional) Importar catálogo CMED

Baixe o XLSX em [ANVISA — Tabela CMED](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos) e execute:

```bash
pnpm --filter api import:cmed -- ./cmed.xlsx
```

---

## Rodando Localmente

### Web (mais rápido para testar UI)

```bash
pnpm --filter mobile start --web
# ou
pnpm --filter mobile web
```

Abre em `http://localhost:8082`. Sem necessidade de dispositivo físico.

> **Limitação web:** FTS5, VisionCamera e DatePicker nativo não funcionam no browser — usam fallbacks automáticos.

### Metro dev server (para dispositivo)

```bash
pnpm --filter mobile start
```

Ou com tunnel (recomendado para WSL2 / redes restritas):

```bash
pnpm --filter mobile start --tunnel
```

O terminal exibe um QR code. Abra o **dev client** instalado no dispositivo e escaneie.

---

## Build do Dev Client

O **dev client** é um APK/IPA personalizado com todos os módulos nativos (FTS5, VisionCamera, DatePicker) embutidos. Precisa ser instalado uma vez no dispositivo antes de usar o hot reload.

> O Expo Go padrão **não funciona** com este projeto — sempre use o dev client.

### Via EAS cloud (recomendado — sem precisar de SDK local)

```bash
# Login na conta Expo (apenas uma vez)
eas login

# Android — gera APK e envia link para download
eas build --profile development --platform android

# iOS — gera IPA (requer Apple Developer Account)
eas build --profile development --platform ios
```

O terminal exibe um link para o painel do Expo onde o APK/IPA fica disponível. Instale diretamente no dispositivo.

### Via build local (requer Java + Android SDK instalados)

```bash
eas build --profile development --platform android --local
```

O APK gerado fica em `/tmp/eas-build-local-nodejs/*/build/` ao final da compilação.

---

## Conectar Dispositivo ao Metro

Após instalar o dev client, o celular precisa alcançar o servidor Metro para carregar o bundle JS.

### Opção 1 — Tunnel (mais simples, funciona em qualquer rede)

```bash
pnpm --filter mobile start --tunnel
```

Escaneie o QR code com o dev client. Não requer nenhuma configuração de rede.

### Opção 2 — Wi-Fi LAN (mais rápido, sem ngrok)

Celular e computador precisam estar na **mesma rede Wi-Fi**.

1. Descubra o IP da sua máquina visível pelo celular:

```bash
# Linux / WSL2 — IP do gateway (geralmente o IP do Windows)
ip route show | grep default | awk '{print $3}'

# macOS
ipconfig getifaddr en0
```

2. Inicie o Metro forçando esse IP:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<ip> pnpm --filter mobile start --lan
```

3. No dev client, toque em "Enter URL manually" e digite: `exp://<ip>:8081`

### Opção 3 — ADB Wi-Fi (para WSL2)

Ative **Depuração wireless** nas Opções do desenvolvedor do celular e conecte:

```bash
adb connect <ip-do-celular>:<porta>
adb devices   # deve listar o dispositivo

# Encaminhar portas do celular para o Metro local
adb reverse tcp:8081 tcp:8081
adb reverse tcp:19000 tcp:19000
```

Depois inicie com `pnpm --filter mobile start --lan`.

---

## Debug com VSCode

O repositório já inclui `.vscode/launch.json` com três configurações prontas.

### Extensão necessária

Instale **React Native Tools** (ID: `msjsdiag.vscode-react-native`) no VSCode.

### Como depurar

1. Inicie o Metro: `pnpm --filter mobile start`
2. Abra o dev client no celular e carregue o bundle
3. No celular, agite o dispositivo → **"Open Debugger"**
4. No VSCode, pressione `F5` e selecione a configuração desejada:

| Configuração | Quando usar |
|-------------|------------|
| **Debug Android (Hermes)** | Inicia o app e abre o debugger |
| **Attach Android (app já rodando)** | Conecta ao app que já está aberto |
| **Debug Web (Edge — attach)** | Debug da versão web no Edge |

5. Coloque breakpoints nos arquivos `.tsx` normalmente — hot reload mantém os breakpoints ativos.

> **Alternativa rápida:** no Metro pressione `j` para abrir o Hermes Inspector direto no Chrome DevTools.

---

## Habilitar Opções do Desenvolvedor no Android

Necessário para depuração USB e wireless.

**Samsung (Note 10+, Galaxy S/A):**
1. Configurações → Sobre o telefone → Informações do software
2. Toque em **Número da versão** 7 vezes (pode pedir senha)
3. Configurações → **Opções do desenvolvedor** (no menu principal)
4. Ative **Depuração USB** e/ou **Depuração wireless**

**Android padrão (Pixel, etc.):**
1. Configurações → Sobre o telefone
2. Toque em **Número da versão** 7 vezes
3. Configurações → Sistema → **Opções do desenvolvedor**

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
pnpm --filter mobile start --tunnel  # Dev server com tunnel (recomendado WSL2)
pnpm --filter mobile web             # Dev server + abrir no browser
pnpm --filter mobile android         # Build e run no Android (requer SDK local)
pnpm --filter mobile ios             # Build e run no iOS (requer Xcode)
pnpm --filter mobile typecheck       # tsc --noEmit
pnpm --filter mobile test            # Vitest
pnpm --filter mobile test:coverage   # Vitest com cobertura
```

### EAS Build

```bash
eas login                                              # Autenticar (uma vez)
eas build --profile development --platform android     # Dev client Android (cloud)
eas build --profile development --platform ios         # Dev client iOS (cloud)
eas build --profile preview --platform android         # APK de testes internos
eas build --profile production --platform android      # AAB para Google Play
eas build --profile production --platform ios          # IPA para App Store
eas build --profile development --platform android --local  # Build local
eas build:list                                         # Listar builds anteriores
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
| 11 | `react-native-vision-camera-mlkit` no RN 0.76 | Patch aplicado via `pnpm patch` em `patches/` — `ReactModuleInfo` removeu named params |
| 12 | Metro `watchFolders` no monorepo | Usar spread `[...(config.watchFolders ?? []), workspaceRoot]` — nunca substituir |
| 13 | `@expo/config-plugins` versão errada | Override forçado em `package.json` raiz: `"@expo/config-plugins": "~9.0.0"` |
| 14 | Gradle cache corrompido | Limpar com `pkill -f gradle && rm -rf ~/.gradle/` antes de novo build local |
| 15 | `expo install --fix` em pnpm monorepo | Usar `pnpm --filter mobile add pkg@version` diretamente — expo CLI usa npm internamente |
