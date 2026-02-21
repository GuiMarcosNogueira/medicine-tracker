import { z } from 'zod';

export const medicationSearchSchema = z.object({
  query: z.string().min(2, 'Mínimo 2 caracteres para buscar'),
  limit: z.number().int().min(1).max(50).default(20),
});

export type MedicationSearchInput = z.infer<typeof medicationSearchSchema>;
