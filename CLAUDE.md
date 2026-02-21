# MedStock — CLAUDE.md

## Visão geral
MedStock é um app de gestão de estoque doméstico de medicamentos para famílias brasileiras.
Funciona em Android, iOS e Web com código compartilhado via Expo SDK 52.

## Estrutura do monorepo
```
apps/mobile     → Expo SDK 52 + Expo Router (app principal)
apps/api        → Supabase: migrations, Edge Functions, scripts
packages/shared → Tipos TypeScript + validators Zod compartilhados
packages/ui     → Componentes React Native/Web reutilizáveis
```

## Decisões arquiteturais
- **Tipos TypeScript** compartilhados → `packages/shared/src/types/`
- **Validators Zod** → `packages/shared/src/validators/`
- **Componentes UI** → `packages/ui/src/`
- **Dependências internas** → protocolo `workspace:*`
- **TypeScript strict** é inegociável (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Estado/sync** → Legend-State v3 com plugin `syncedSupabase`
- **Auth storage** → expo-secure-store com adapter chunked (OAuth tokens excedem 2048 bytes)
- **FTS** → FTS5 nativo (iOS/Android) / LIKE fallback (web — WASM SQLite sem FTS5)

## Comandos principais
```bash
pnpm --filter mobile start          # Expo dev server
pnpm --filter mobile android        # Build Android dev client
pnpm --filter mobile ios            # Build iOS dev client
pnpm --filter api supabase db push  # Aplicar migrations
pnpm lint                           # ESLint no monorepo inteiro
pnpm format                         # Prettier
pnpm typecheck                      # TypeScript em todos os packages
pnpm test                           # Jest/Vitest em todos os packages
```

## Convenções de commit (Conventional Commits)
```
feat(scope): descrição
fix(scope): descrição
chore(scope): descrição
refactor(scope): descrição
test(scope): descrição
docs(scope): descrição
```

## Regras de implementação
- Comitar após cada feature completa
- Rodar `pnpm typecheck` antes de cada commit
- Tratar iOS e Android explicitamente (SafeAreaView, permissões, etc.)
- Web: layout responsivo com sidebar (não tabs)
- Sem `any` no TypeScript — usar tipos precisos
- Usar `void` explicitamente em Promises não aguardadas

## Gotchas críticos
1. `.npmrc` com `node-linker=hoisted` → obrigatório para React Native + pnpm
2. `expo-sqlite` FTS5 → só funciona com dev client (não no Expo Go)
3. SecureStore limit 2048 bytes → usar adapter chunked no supabase.ts
4. VisionCamera v4 → requer `react-native-worklets-core` como dep direta
5. CMED colunas mudam mensalmente → validar COLUMN_MAP antes de importar
