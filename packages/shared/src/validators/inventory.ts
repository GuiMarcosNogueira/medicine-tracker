import { z } from 'zod';

const INVENTORY_UNITS = ['un', 'ml', 'mg', 'g', 'cápsulas', 'comprimidos'] as const;

export const inventoryItemSchema = z
  .object({
    medicationId: z.string().uuid().optional(),
    customName: z.string().min(1).max(200).optional(),
    lotNumber: z.string().max(50).optional(),
    expiryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD'),
    quantity: z.number().min(0, 'Quantidade não pode ser negativa'),
    unit: z.enum(INVENTORY_UNITS).default('un'),
    location: z.string().max(100).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.medicationId !== undefined || d.customName !== undefined, {
    message: 'Informe o medicamento do catálogo ou um nome personalizado',
    path: ['medicationId'],
  });

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
