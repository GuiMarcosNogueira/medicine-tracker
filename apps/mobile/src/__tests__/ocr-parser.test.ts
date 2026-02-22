import { describe, it, expect } from 'vitest';
import { parseOcrText } from '../lib/ocr-parser';

// ─── Expiry date extraction ───────────────────────────────────────────────────

describe('parseOcrText — expiryDate', () => {
  it('extrai VAL: MM/YYYY e retorna último dia do mês', () => {
    expect(parseOcrText('VAL: 12/2027').expiryDate).toBe('2027-12-31');
  });

  it('extrai VENC: MM/YYYY (minúsculo)', () => {
    expect(parseOcrText('venc: 06/2026').expiryDate).toBe('2026-06-30');
  });

  it('extrai EXP MM/YYYY sem dois-pontos', () => {
    expect(parseOcrText('EXP 03/2025').expiryDate).toBe('2025-03-31');
  });

  it('extrai VAL MM-YYYY com hífen', () => {
    expect(parseOcrText('VAL 02-2026').expiryDate).toBe('2026-02-28');
  });

  it('extrai VENC: MM/AA (2 dígitos ano)', () => {
    expect(parseOcrText('VENC: 11/28').expiryDate).toBe('2028-11-30');
  });

  it('extrai EXP: MM/AA com dois-pontos e espaço', () => {
    expect(parseOcrText('EXP: 07/30').expiryDate).toBe('2030-07-31');
  });

  it('retorna último dia correto para fevereiro em ano bissexto', () => {
    expect(parseOcrText('VAL: 02/2028').expiryDate).toBe('2028-02-29');
  });

  it('retorna último dia correto para fevereiro em ano não-bissexto', () => {
    expect(parseOcrText('VAL: 02/2027').expiryDate).toBe('2027-02-28');
  });

  it('extrai com texto ao redor: "Lote A123 VAL 08/2026 500mg"', () => {
    expect(parseOcrText('Lote A123 VAL 08/2026 500mg').expiryDate).toBe('2026-08-31');
  });

  it('extrai com ponto antes dos dois-pontos: "val.: 05/2025"', () => {
    expect(parseOcrText('val.: 05/2025').expiryDate).toBe('2025-05-31');
  });

  it('retorna null quando não há data de validade', () => {
    expect(parseOcrText('Dipirona Sódica 500mg Lote ABC123').expiryDate).toBeNull();
  });

  it('ignora texto sem palavra-chave VAL/VENC/EXP mesmo com MM/YYYY', () => {
    expect(parseOcrText('produção 01/2020').expiryDate).toBeNull();
  });
});

// ─── Lot number extraction ────────────────────────────────────────────────────

describe('parseOcrText — lotNumber', () => {
  it('extrai LOTE: seguido de alfanumérico', () => {
    expect(parseOcrText('LOTE: ABC123').lotNumber).toBe('ABC123');
  });

  it('extrai Lote (maiúsculo/minúsculo)', () => {
    expect(parseOcrText('Lote XY-9900').lotNumber).toBe('XY-9900');
  });

  it('extrai LOT: (inglês)', () => {
    expect(parseOcrText('LOT: Z001A').lotNumber).toBe('Z001A');
  });

  it('extrai lot. com ponto', () => {
    expect(parseOcrText('lot. A1B2C3').lotNumber).toBe('A1B2C3');
  });

  it('retorna null quando não há lote', () => {
    expect(parseOcrText('VAL: 12/2027 500mg').lotNumber).toBeNull();
  });

  it('ignora lote com menos de 3 caracteres', () => {
    expect(parseOcrText('LOTE: AB').lotNumber).toBeNull();
  });
});

// ─── Dose extraction ─────────────────────────────────────────────────────────

describe('parseOcrText — dose', () => {
  it('extrai mg', () => {
    expect(parseOcrText('Paracetamol 500mg').dose).toBe('500mg');
  });

  it('extrai ml', () => {
    expect(parseOcrText('Solução 100ml').dose).toBe('100ml');
  });

  it('extrai g', () => {
    expect(parseOcrText('Conteúdo 2g').dose).toBe('2g');
  });

  it('extrai mcg', () => {
    expect(parseOcrText('Levotiroxina 50mcg').dose).toBe('50mcg');
  });

  it('extrai UI (maiúsculo)', () => {
    expect(parseOcrText('Insulina 100 UI').dose).toBe('100 UI');
  });

  it('extrai dose com vírgula decimal', () => {
    expect(parseOcrText('Dose: 0,5mg').dose).toBe('0,5mg');
  });

  it('extrai dose com ponto decimal', () => {
    expect(parseOcrText('0.25mg por dose').dose).toBe('0.25mg');
  });

  it('retorna null quando não há dose', () => {
    expect(parseOcrText('Lote A123 VAL 08/2026').dose).toBeNull();
  });
});

// ─── EAN extraction ───────────────────────────────────────────────────────────

describe('parseOcrText — ean', () => {
  it('extrai EAN-13 isolado', () => {
    expect(parseOcrText('7891058012390').ean).toBe('7891058012390');
  });

  it('extrai EAN-13 no meio do texto', () => {
    expect(parseOcrText('Produto 7894739000154 Dipirona').ean).toBe('7894739000154');
  });

  it('extrai EAN-8', () => {
    expect(parseOcrText('Código 12345678 fim').ean).toBe('12345678');
  });

  it('ignora sequência de 14 dígitos (não EAN válido)', () => {
    expect(parseOcrText('12345678901234').ean).toBeNull();
  });

  it('ignora sequência de 7 dígitos', () => {
    expect(parseOcrText('1234567').ean).toBeNull();
  });

  it('retorna null quando não há código de barras', () => {
    expect(parseOcrText('Paracetamol 500mg Lote A123').ean).toBeNull();
  });
});

// ─── Full label simulations ───────────────────────────────────────────────────

describe('parseOcrText — rótulos completos simulados', () => {
  it('rótulo completo Tylenol', () => {
    const result = parseOcrText(
      'TYLENOL 750mg\nParacetamol\nLOTE: TY2025B\nVAL: 08/2027\n7891058012390',
    );
    expect(result.expiryDate).toBe('2027-08-31');
    expect(result.lotNumber).toBe('TY2025B');
    expect(result.dose).toBe('750mg');
    expect(result.ean).toBe('7891058012390');
  });

  it('rótulo completo Dipirona com 2 dígitos de ano', () => {
    const result = parseOcrText(
      'Dipirona Sódica 500mg/mL\nSolução Oral\nLote: DIP-0042\nVENC: 03/28\n7894739000154',
    );
    expect(result.expiryDate).toBe('2028-03-31');
    expect(result.lotNumber).toBe('DIP-0042');
    expect(result.dose).toBe('500mg');
    expect(result.ean).toBe('7894739000154');
  });

  it('rótulo sem nenhum campo reconhecível retorna todos null', () => {
    const result = parseOcrText('Descrição genérica sem campos reconhecíveis');
    expect(result.expiryDate).toBeNull();
    expect(result.lotNumber).toBeNull();
    expect(result.dose).toBeNull();
    expect(result.ean).toBeNull();
  });
});
