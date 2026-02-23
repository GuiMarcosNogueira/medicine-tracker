/**
 * Parser for the CMED/ANVISA APRESENTAÇÃO column.
 *
 * The string follows a fixed positional structure (left to right):
 *   [DOSAGEM] [FORMA FARMACÊUTICA] [EMB. SECUNDÁRIA] [EMB. PRIMÁRIA + MATERIAL] X [QTDE] [+ ACESSÓRIO]
 *
 * Example: "500 MG COM CT BL AL PLAS INC X 12"
 *   → dosage="500 MG", formFriendly="Comprimido", count=12
 *
 * Example: "250 MG/5 ML PO SUS OR CT FR VD AMB X 150 ML + CP MED"
 *   → dosage="250 MG/5 ML", formFriendly="Pó para Suspensão Oral", volume="150 ML"
 *
 * Only the 4 fields relevant for end-users are extracted. The rest
 * (packaging material, blister type, accessory) are discarded.
 */

export interface ParsedPresentation {
  dosage: string | null;       // "500 MG" | "250 MG/5 ML"
  formFriendly: string | null; // "Comprimido" | "Cápsula Dura"
  count: number | null;        // 30 (unit count)
  volume: string | null;       // "150 ML" (for liquids/solutions)
}

// Ordered longest-first so that greedy matching works correctly.
// "CAP GEL DURA" must be tried before "CAP DURA" and "CAP".
const FORM_MAP: [abbr: string, label: string][] = [
  ['PO LIOF SOL INJ', 'Pó Liofilizado Injetável'],
  ['COM LIB PROL',    'Comprimido Lib. Prolongada'],
  ['CAP GEL DURA',    'Cápsula Gelatinosa'],
  ['PO SUS OR',       'Pó para Suspensão Oral'],
  ['PO SOL INJ',      'Pó para Solução Injetável'],
  ['PO SOL OR',       'Pó para Solução Oral'],
  ['CREM DERM',       'Creme Dermatológico'],
  ['CREM VAG',        'Creme Vaginal'],
  ['POM OFT',         'Pomada Oftálmica'],
  ['SOL OFT',         'Solução Oftálmica'],
  ['SOL NAS',         'Solução Nasal'],
  ['SOL INJ',         'Solução Injetável'],
  ['SOL OR',          'Solução Oral'],
  ['SOL GOT',         'Solução em Gotas'],
  ['SUS OR',          'Suspensão Oral'],
  ['EMU OR',          'Emulsão Oral'],
  ['COM MAST',        'Comprimido Mastigável'],
  ['COM REV',         'Comprimido Revestido'],
  ['COM EF',          'Comprimido Efervescente'],
  ['CAP DURA',        'Cápsula Dura'],
  ['CAP MOL',         'Cápsula Mole'],
  ['COM',             'Comprimido'],
  ['DRG',             'Drágea'],
  ['XPE',             'Xarope'],
  ['GEL',             'Gel'],
  ['AER',             'Aerossol'],
  ['SUP',             'Supositório'],
];

export function parsePresentation(raw: string | null): ParsedPresentation {
  if (!raw) return { dosage: null, formFriendly: null, count: null, volume: null };

  // Step 1: strip accessory after " + " (e.g., "+ CP MED", "+ SER DOS")
  const main = raw.split(' + ')[0]?.trim() ?? raw;

  // Step 2: extract quantity from the last " X NN" or " X NN ML" occurrence.
  let count: number | null = null;
  let volume: string | null = null;
  let withoutQty = main;

  const upper = main.toUpperCase();
  const xIdx = upper.lastIndexOf(' X ');
  if (xIdx !== -1) {
    const afterX = main.slice(xIdx + 3).trim();
    // Matches: "30", "150 ML", "120 ML", "1,5 G", etc.
    const m = afterX.match(/^(\d+(?:[.,]\d+)?)\s*(ML|G|L|MCG)?$/i);
    if (m) {
      const num = parseFloat((m[1] ?? '0').replace(',', '.'));
      const unit = m[2]?.toUpperCase() ?? null;
      if (unit) {
        volume = `${Number.isInteger(num) ? Math.round(num) : num} ${unit}`;
      } else {
        count = Math.round(num);
      }
      withoutQty = main.slice(0, xIdx).trim();
    }
  }

  // Step 3: find the pharmaceutical form in the remaining string.
  // Try each abbreviation (already ordered longest-first) against the uppercase version.
  const upperWQ = withoutQty.toUpperCase();
  let dosage: string | null = null;
  let formFriendly: string | null = null;

  for (const [abbr, label] of FORM_MAP) {
    // Match at a word boundary: preceded by a space or start of string.
    const idx = upperWQ.indexOf(abbr);
    if (idx === -1) continue;
    // Ensure it's not a substring of a longer word (check what comes right after)
    const charAfter = upperWQ[idx + abbr.length];
    if (charAfter !== undefined && charAfter !== ' ') continue;

    formFriendly = label;
    // Everything before the form abbreviation is the dosage.
    dosage = withoutQty.slice(0, idx).trim() || null;
    break;
  }

  return { dosage, formFriendly, count, volume };
}
