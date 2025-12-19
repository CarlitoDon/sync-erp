import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  passwordHash: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
