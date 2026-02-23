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

  // Step 1: extract quantity from the LAST " X NN [UNIT]" occurrence.
  //
  // Using the last occurrence as the split point achieves two goals at once:
  //   a) Accessories (" + CP MED", " +COP", " +SER") always appear AFTER the
  //      quantity, so they are automatically discarded as part of `afterX`.
  //   b) Combination dosages ("40 MG + 12,5 MG COM …") contain a "+" BEFORE
  //      the quantity and are preserved intact in `withoutQty`.
  //
  // This replaces the earlier approach of splitting on " +" first, which broke
  // combination-product strings like "40 MG + 12,5 MG COM CT BL AL X 30".
  let count: number | null = null;
  let volume: string | null = null;
  let withoutQty = raw;

  // Scan for all " X NN [UNIT]" occurrences and keep the last one.
  const xRe = / X (\d+(?:[.,]\d+)?)\s*(ML|G|L|MCG)?\b/gi;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = xRe.exec(raw)) !== null) lastMatch = m;

  if (lastMatch) {
    const num = parseFloat((lastMatch[1] ?? '0').replace(',', '.'));
    const unit = lastMatch[2]?.toUpperCase() ?? null;
    if (unit) {
      volume = `${Number.isInteger(num) ? Math.round(num) : num} ${unit}`;
    } else {
      count = Math.round(num);
    }
    // Everything before the " X …" token (excludes accessories that follow it).
    withoutQty = raw.slice(0, lastMatch.index).trim();
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

  // Fallback: no form found, but try to extract a leading dosage token.
  // Covers cases like "100 MG CT BL AL PLAS X 30" where the form abbreviation
  // is absent or not yet in FORM_MAP.
  if (!formFriendly && !dosage) {
    const dm = withoutQty.match(
      /^(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?\s*(?:ML|G))?\s*(?:MG(?:\/(?:ML|G|\d+(?:[.,]\d+)?\s*ML))?|MCG|UI|G(?!EL)\b|ML))\b/i,
    );
    if (dm?.[1]) dosage = dm[1].trim();
  }

  return { dosage, formFriendly, count, volume };
}
