import { z } from 'zod';

export const CreateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(100),
});

export const JoinCompanySchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export type CreateCompanyInput = z.infer<typeof CreateCompanySchema>;
export type JoinCompanyInput = z.infer<typeof JoinCompanySchema>;

export const InviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name is required'),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
