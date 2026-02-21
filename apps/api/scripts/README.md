# Scripts

## import-cmed.ts

Importa a tabela de preços da CMED (ANVISA) para o banco de dados Supabase.

### Obter o arquivo CMED

Baixe o arquivo XLS/XLSX mais recente em:
https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos

### Executar

```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
pnpm --filter api import:cmed -- caminho/para/cmed.xlsx
```

### Observações

- O script usa a chave `service_role` para contornar o RLS (necessário para carga em massa)
- Upsert em batches de 500 para não sobrecarregar a API
- **Atenção:** Os nomes das colunas do arquivo CMED mudam a cada release mensal da ANVISA.
  Sempre verifique o mapeamento em `COLUMN_MAP` antes de executar.
