import { describe, it, expect } from 'vitest';
import { signInSchema, signUpSchema, familySchema, forgotPasswordSchema } from '../validators/auth';
import { inventoryItemSchema } from '../validators/inventory';
import { medicationSearchSchema } from '../validators/medication';

// ─── signInSchema ────────────────────────────────────────────────────────────

describe('signInSchema', () => {
  it('aceita email e senha válidos', () => {
    expect(signInSchema.safeParse({ email: 'user@example.com', password: '12345678' }).success).toBe(true);
  });

  it('rejeita email inválido', () => {
    expect(signInSchema.safeParse({ email: 'not-an-email', password: '12345678' }).success).toBe(false);
  });

  it('rejeita email vazio', () => {
    expect(signInSchema.safeParse({ email: '', password: '12345678' }).success).toBe(false);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(signInSchema.safeParse({ email: 'user@example.com', password: '1234567' }).success).toBe(false);
  });

  it('aceita senha com exatamente 8 caracteres (boundary)', () => {
    expect(signInSchema.safeParse({ email: 'user@example.com', password: '12345678' }).success).toBe(true);
  });

  it('rejeita campos ausentes', () => {
    expect(signInSchema.safeParse({}).success).toBe(false);
  });
});

// ─── signUpSchema ────────────────────────────────────────────────────────────

describe('signUpSchema', () => {
  const base = {
    email: 'user@example.com',
    password: '12345678',
    confirmPassword: '12345678',
    fullName: 'João Silva',
  };

  it('aceita dados completos e válidos', () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  it('rejeita quando senhas não coincidem', () => {
    expect(signUpSchema.safeParse({ ...base, confirmPassword: '87654321' }).success).toBe(false);
  });

  it('mensagem de erro aponta para confirmPassword', () => {
    const r = signUpSchema.safeParse({ ...base, confirmPassword: 'outra' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  it('rejeita fullName com menos de 2 caracteres', () => {
    expect(signUpSchema.safeParse({ ...base, fullName: 'A' }).success).toBe(false);
  });

  it('aceita fullName com exatamente 2 caracteres (boundary)', () => {
    expect(signUpSchema.safeParse({ ...base, fullName: 'Li' }).success).toBe(true);
  });

  it('rejeita fullName com mais de 120 caracteres', () => {
    expect(signUpSchema.safeParse({ ...base, fullName: 'A'.repeat(121) }).success).toBe(false);
  });

  it('aceita fullName com exatamente 120 caracteres (boundary)', () => {
    expect(signUpSchema.safeParse({ ...base, fullName: 'A'.repeat(120) }).success).toBe(true);
  });

  it('rejeita email inválido no signUp', () => {
    expect(signUpSchema.safeParse({ ...base, email: 'invalido' }).success).toBe(false);
  });
});

// ─── familySchema ─────────────────────────────────────────────────────────────

describe('familySchema', () => {
  it('aceita nome válido', () => {
    expect(familySchema.safeParse({ name: 'Família Silva' }).success).toBe(true);
  });

  it('rejeita nome vazio', () => {
    expect(familySchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejeita nome com mais de 100 caracteres', () => {
    expect(familySchema.safeParse({ name: 'A'.repeat(101) }).success).toBe(false);
  });

  it('aceita nome com exatamente 100 caracteres (boundary)', () => {
    expect(familySchema.safeParse({ name: 'A'.repeat(100) }).success).toBe(true);
  });

  it('aceita nome com 1 caractere (boundary mínimo)', () => {
    expect(familySchema.safeParse({ name: 'X' }).success).toBe(true);
  });
});

// ─── forgotPasswordSchema ─────────────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('aceita email válido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  });

  it('rejeita email inválido', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nao-é-email' }).success).toBe(false);
  });

  it('rejeita email vazio', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false);
  });

  it('rejeita campo ausente', () => {
    expect(forgotPasswordSchema.safeParse({}).success).toBe(false);
  });
});

// ─── inventoryItemSchema ──────────────────────────────────────────────────────

describe('inventoryItemSchema', () => {
  const base = {
    customName: 'Paracetamol 500mg',
    expiryDate: '2026-12-31',
    quantity: 2,
  };

  it('aceita com customName', () => {
    expect(inventoryItemSchema.safeParse(base).success).toBe(true);
  });

  it('aceita com medicationId (UUID válido)', () => {
    expect(
      inventoryItemSchema.safeParse({
        ...base,
        customName: undefined,
        medicationId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      }).success,
    ).toBe(true);
  });

  it('rejeita quando nem medicationId nem customName são fornecidos', () => {
    expect(inventoryItemSchema.safeParse({ expiryDate: '2026-12-31', quantity: 1 }).success).toBe(false);
  });

  it('rejeita medicationId que não é UUID', () => {
    expect(inventoryItemSchema.safeParse({ ...base, medicationId: 'nao-uuid' }).success).toBe(false);
  });

  it('rejeita data com formato DD/MM/YYYY', () => {
    expect(inventoryItemSchema.safeParse({ ...base, expiryDate: '31/12/2026' }).success).toBe(false);
  });

  it('rejeita data com formato MM-DD-YYYY', () => {
    expect(inventoryItemSchema.safeParse({ ...base, expiryDate: '12-31-2026' }).success).toBe(false);
  });

  it('aceita data no formato YYYY-MM-DD', () => {
    expect(inventoryItemSchema.safeParse({ ...base, expiryDate: '2026-01-01' }).success).toBe(true);
  });

  it('rejeita quantidade negativa', () => {
    expect(inventoryItemSchema.safeParse({ ...base, quantity: -1 }).success).toBe(false);
  });

  it('aceita quantidade zero (boundary)', () => {
    expect(inventoryItemSchema.safeParse({ ...base, quantity: 0 }).success).toBe(true);
  });

  it('aplica unidade padrão "un" quando omitida', () => {
    const r = inventoryItemSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.unit).toBe('un');
  });

  it.each(['un', 'ml', 'mg', 'g', 'cápsulas', 'comprimidos'] as const)(
    'aceita unidade válida "%s"',
    (unit) => {
      expect(inventoryItemSchema.safeParse({ ...base, unit }).success).toBe(true);
    },
  );

  it('rejeita unidade inválida', () => {
    expect(inventoryItemSchema.safeParse({ ...base, unit: 'litros' }).success).toBe(false);
  });

  it('rejeita customName com mais de 200 caracteres', () => {
    expect(inventoryItemSchema.safeParse({ ...base, customName: 'A'.repeat(201) }).success).toBe(false);
  });

  it('aceita todos os campos opcionais preenchidos', () => {
    expect(
      inventoryItemSchema.safeParse({
        ...base,
        lotNumber: 'LOT-001',
        location: 'Armário',
        notes: 'Uso infantil',
      }).success,
    ).toBe(true);
  });

  it('rejeita lotNumber com mais de 50 caracteres', () => {
    expect(
      inventoryItemSchema.safeParse({ ...base, lotNumber: 'A'.repeat(51) }).success,
    ).toBe(false);
  });

  it('rejeita notes com mais de 500 caracteres', () => {
    expect(
      inventoryItemSchema.safeParse({ ...base, notes: 'A'.repeat(501) }).success,
    ).toBe(false);
  });
});

// ─── medicationSearchSchema ───────────────────────────────────────────────────

describe('medicationSearchSchema', () => {
  it('aceita query mínima (2 chars) sem limit', () => {
    const r = medicationSearchSchema.safeParse({ query: 'di' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20); // default
  });

  it('rejeita query com 1 caractere', () => {
    expect(medicationSearchSchema.safeParse({ query: 'd' }).success).toBe(false);
  });

  it('rejeita query vazia', () => {
    expect(medicationSearchSchema.safeParse({ query: '' }).success).toBe(false);
  });

  it('aceita limit personalizado válido', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 10 }).success).toBe(true);
  });

  it('rejeita limit acima de 50', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 51 }).success).toBe(false);
  });

  it('rejeita limit abaixo de 1', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 0 }).success).toBe(false);
  });

  it('rejeita limit não-inteiro', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 5.5 }).success).toBe(false);
  });

  it('aceita limit exatamente 50 (boundary)', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 50 }).success).toBe(true);
  });

  it('aceita limit exatamente 1 (boundary)', () => {
    expect(medicationSearchSchema.safeParse({ query: 'para', limit: 1 }).success).toBe(true);
  });
});
