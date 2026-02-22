/**
 * CMED (ANVISA) price list importer.
 *
 * ⚠️  ATENÇÃO: Os nomes das colunas do arquivo CMED mudam a cada release
 *    mensal da ANVISA. Sempre verifique COLUMN_MAP antes de executar.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   pnpm --filter api import:cmed /caminho/absoluto/para/cmed.xlsx
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';

// ── Column candidates ─────────────────────────────────────────────────────────
// Each entry lists candidate column names from the CMED spreadsheet (case-insensitive).
// Update when ANVISA renames columns (happens monthly).
const COLUMN_MAP = {
  product_name:        ['PRODUTO', 'NOME DO PRODUTO', 'NOME_PRODUTO'],
  active_ingredient:   ['SUBSTÂNCIA', 'SUBSTANCIA', 'PRINCIPIO ATIVO', 'PRINCÍPIO ATIVO'],
  manufacturer:        ['LABORATORIO', 'LABORATÓRIO', 'FABRICANTE'],
  ean:                 ['EAN 1', 'EAN_1', 'EAN1', 'CÓDIGO EAN', 'CODIGO EAN'],
  presentation:        ['APRESENTACAO', 'APRESENTAÇÃO'],
  atc_description:     ['CLASS.TERAPEUTICA', 'CLASSE TERAPEUTICA', 'CLASSE TERAPÊUTICA'],
  reference_price:     ['PF 0%', 'PF_0%', 'PF0%', 'PF SEM IMPOSTOS'],
  anvisa_code:         ['REGISTRO', 'REGISTRO ANVISA', 'REG. MS'],
  pharmaceutical_form: ['FORMA FARMACEUTICA', 'FORMA FARMACÊUTICA', 'FORMA FARMACEUTICA'],
  concentration:       ['CONCENTRACAO', 'CONCENTRAÇÃO'],
  tarja:               ['TARJA', 'TIPO DE PRODUTO', 'TIPO PRODUTO'],
} satisfies Record<string, string[]>;

type ColKey = keyof typeof COLUMN_MAP;
type ColResolved = Record<ColKey, string | null>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function findColumn(headers: string[], candidates: string[]): string | null {
  const upper = headers.map(h => String(h).trim().toUpperCase());
  for (const c of candidates) {
    const i = upper.indexOf(c.toUpperCase());
    if (i !== -1) {
      const found = headers[i];
      return found ?? null;
    }
  }
  return null;
}

function resolveColumns(headers: string[]): ColResolved {
  return Object.fromEntries(
    (Object.keys(COLUMN_MAP) as ColKey[]).map(k => [
      k,
      findColumn(headers, COLUMN_MAP[k]),
    ]),
  ) as ColResolved;
}

function getCellStr(row: Record<string, unknown>, col: string | null): string | null {
  if (!col) return null;
  const v = row[col];
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parsePrice(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(String(raw).replace(/\./g, '').replace(',', '.').trim());
  return isNaN(n) ? null : n;
}

function isTarjaVerm(raw: unknown): boolean {
  const s = String(raw ?? '').toUpperCase();
  return s.includes('VERMELHA') || s.includes('PRETA');
}

function isTarjaPreta(raw: unknown): boolean {
  return String(raw ?? '').toUpperCase().includes('PRETA');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceKey  = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const filePath    = process.argv[2];

  if (!supabaseUrl || !serviceKey) {
    console.error('❌  Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
    return;
  }

  if (!filePath) {
    console.error('❌  Uso: pnpm --filter api import:cmed -- <cmed.xlsx>');
    process.exit(1);
    return;
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`❌  Arquivo não encontrado: ${resolved}`);
    process.exit(1);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`📂  Lendo: ${resolved}`);
  const workbook = XLSX.readFile(resolved, { cellText: true, cellDates: false });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error('❌  Planilha vazia');
    process.exit(1);
    return;
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error('❌  Sheet não encontrada');
    process.exit(1);
    return;
  }

  // The CMED spreadsheet has title rows at the top before the real column headers.
  // Scan the first 10 rows to find the one that contains recognizable column names.
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const allCandidates = Object.values(COLUMN_MAP).flat().map(c => c.toUpperCase());

  let headerRowIndex = -1;
  for (let r = 0; r < Math.min(50, allRows.length); r++) {
    const row = allRows[r];
    if (!Array.isArray(row)) continue;
    const upperCells = row.map(c => String(c ?? '').trim().toUpperCase());
    if (allCandidates.some(c => upperCells.includes(c))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error('❌  Linha de cabeçalho não encontrada nas primeiras 10 linhas. Verifique COLUMN_MAP.');
    console.error('    Primeiras linhas:');
    allRows.slice(0, 5).forEach((r, i) => {
      console.error(`    Linha ${i + 1}: ${(r as unknown[]).slice(0, 5).join(' | ')}`);
    });
    process.exit(1);
    return;
  }

  console.log(`ℹ️   Cabeçalhos encontrados na linha ${headerRowIndex + 1}`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: null,
    raw: false,
  });

  if (rows.length === 0) {
    console.error('❌  Nenhum dado encontrado na planilha');
    process.exit(1);
    return;
  }

  const firstRow = rows[0];
  if (!firstRow) {
    console.error('❌  Primeira linha inválida');
    process.exit(1);
    return;
  }

  const headers = Object.keys(firstRow);
  console.log(`📋  Colunas (${headers.length}): ${headers.slice(0, 8).join(', ')}...`);

  const cols = resolveColumns(headers);
  console.log('\n🗺️   Mapeamento de colunas:');
  for (const k of Object.keys(cols) as ColKey[]) {
    console.log(`     ${k.padEnd(22)}: ${cols[k] ?? '⚠️ NÃO ENCONTRADA'}`);
  }

  if (!cols.product_name) {
    console.error('\n❌  Coluna obrigatória "product_name" não encontrada. Atualize COLUMN_MAP.');
    process.exit(1);
    return;
  }

  const BATCH = 500;
  let total     = 0;
  let errBatches = 0;

  console.log(`\n🚀  ${rows.length.toLocaleString('pt-BR')} linhas → batches de ${BATCH}...\n`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);

    const records = slice
      .map(row => {
        const product_name = getCellStr(row, cols.product_name);
        if (!product_name) return null;

        const tarjaRaw = cols.tarja ? row[cols.tarja] : null;
        const eanRaw   = getCellStr(row, cols.ean)?.replace(/\D/g, '') ?? null;

        return {
          product_name,
          active_ingredient:     getCellStr(row, cols.active_ingredient),
          manufacturer:          getCellStr(row, cols.manufacturer),
          ean:                   eanRaw && eanRaw.length >= 8 ? eanRaw : null,
          presentation:          getCellStr(row, cols.presentation),
          atc_description:       getCellStr(row, cols.atc_description),
          reference_price:       parsePrice(cols.reference_price ? row[cols.reference_price] : null),
          anvisa_code:           getCellStr(row, cols.anvisa_code),
          pharmaceutical_form:   getCellStr(row, cols.pharmaceutical_form),
          concentration:         getCellStr(row, cols.concentration),
          requires_prescription: isTarjaVerm(tarjaRaw),
          is_controlled:         isTarjaPreta(tarjaRaw),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (records.length === 0) continue;

    // Rows with EAN → upsert (idempotent on re-import).
    // Rows without EAN → insert (may duplicate on re-import; acceptable for catalog).
    const withEan    = records.filter(r => r.ean !== null);
    const withoutEan = records.filter(r => r.ean === null);

    let batchErr = false;

    if (withEan.length > 0) {
      const { error } = await supabase
        .from('medications')
        .upsert(withEan, { onConflict: 'ean' });
      if (error) {
        console.error(`\n❌  Upsert batch: ${error.message}`);
        batchErr = true;
      } else {
        total += withEan.length;
      }
    }

    if (withoutEan.length > 0) {
      const { error } = await supabase
        .from('medications')
        .insert(withoutEan);
      if (error) {
        console.error(`\n❌  Insert batch (sem EAN): ${error.message}`);
        batchErr = true;
      } else {
        total += withoutEan.length;
      }
    }

    if (batchErr) {
      errBatches++;
    } else {
      process.stdout.write(`\r   ${total.toLocaleString('pt-BR')} registros importados...`);
    }
  }

  console.log(
    `\n\n🎉  Concluído: ${total.toLocaleString('pt-BR')} registros | ${errBatches} batches com erro`,
  );
}

void main();
