export interface OcrResult {
  expiryDate: string | null; // YYYY-MM-DD (last day of month from MM/YYYY)
  lotNumber:  string | null;
  dose:       string | null;
  ean:        string | null;
}

/**
 * Parses raw OCR text from a medication label.
 *
 * Extracts:
 * - Expiry date: "VAL/VENC/EXP MM/YYYY" or "MM/AA" → normalized to YYYY-MM-DD (last day of month)
 * - Lot number: "LOTE/LOT <alphanum>"
 * - Dose: number + unit (mg/ml/g/mcg/UI)
 * - EAN: 13- or 8-digit barcode
 */
export function parseOcrText(text: string): OcrResult {
  return {
    expiryDate: extractExpiry(text),
    lotNumber:  extractLot(text),
    dose:       extractDose(text),
    ean:        extractEan(text),
  };
}

function extractExpiry(text: string): string | null {
  // Match: VAL/VENC/EXP (optional colon/dot) MM/YYYY or MM/YY or MM-YYYY
  const re = /(?:val|venc|exp)\.?\s*:?\s*(\d{2})[\/\-](\d{4}|\d{2})/i;
  const m = text.match(re);
  if (!m) return null;
  /* v8 ignore next 2 -- groups always defined when regex matches (non-optional capture groups) */
  const month = m[1] ?? '';
  const yearRaw = m[2] ?? '';
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const mm = month.padStart(2, '0');
  // Last calendar day of the month (day 0 of next month)
  const lastDay = new Date(Number(year), Number(mm), 0).getDate();
  return `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

function extractLot(text: string): string | null {
  const re = /(?:lote|lot)\.?\s*:?\s*([A-Z0-9\-]{3,20})/i;
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractDose(text: string): string | null {
  const re = /(\d+(?:[.,]\d+)?)\s*(?:mg|ml|g|mcg|ui)\b/i;
  const m = text.match(re);
  return m?.[0]?.trim() ?? null;
}

function extractEan(text: string): string | null {
  // Only capture standalone 13- or 8-digit sequences (not part of longer numbers)
  const re = /(?<!\d)(\d{13}|\d{8})(?!\d)/;
  const m = text.match(re);
  return m?.[1] ?? null;
}
