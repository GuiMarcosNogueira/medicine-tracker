import { describe, it, expect } from 'vitest';
import { signInSchema, signUpSchema, familySchema } from '../validators/auth';
import { inventoryItemSchema } from '../validators/inventory';

describe('signInSchema', () => {
  it('aceita email e senha válidos', () => {
    const result = signInSchema.safeParse({ email: 'user@example.com', password: '12345678' });
    expect(result.success).toBe(true);
  });

  it('rejeita email inválido', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: '12345678' });
    expect(result.success).toBe(false);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    const result = signInSchema.safeParse({ email: 'user@example.com', password: '123' });
    expect(result.success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('rejeita quando senhas não coincidem', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      password: '12345678',
      confirmPassword: '87654321',
      fullName: 'João Silva',
    });
    expect(result.success).toBe(false);
  });

  it('aceita dados completos e válidos', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      password: '12345678',
      confirmPassword: '12345678',
      fullName: 'João Silva',
    });
    expect(result.success).toBe(true);
  });
});

describe('familySchema', () => {
  it('rejeita nome vazio', () => {
    const result = familySchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('inventoryItemSchema', () => {
  it('rejeita quando nem medicationId nem customName são fornecidos', () => {
    const result = inventoryItemSchema.safeParse({
      expiryDate: '2025-12-31',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it('aceita com customName', () => {
    const result = inventoryItemSchema.safeParse({
      customName: 'Paracetamol 500mg',
      expiryDate: '2025-12-31',
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejeita data com formato errado', () => {
    const result = inventoryItemSchema.safeParse({
      customName: 'Paracetamol',
      expiryDate: '31/12/2025',
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quantidade negativa', () => {
    const result = inventoryItemSchema.safeParse({
      customName: 'Paracetamol',
      expiryDate: '2025-12-31',
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });
});
