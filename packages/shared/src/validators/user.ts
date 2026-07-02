import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
}).strict();

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
