import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().trim().email('Formato de correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
