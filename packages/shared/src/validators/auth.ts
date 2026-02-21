import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const signUpSchema = signInSchema
  .extend({
    fullName: z
      .string()
      .min(2, 'Nome muito curto')
      .max(120, 'Nome muito longo'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Senhas não coincidem',
    path: ['confirmPassword'],
  });

export const familySchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type FamilyInput = z.infer<typeof familySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
