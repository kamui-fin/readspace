import { z } from 'zod';

export const EmailSchema = z.object({
  email: z.string({ message: 'Please enter an email' }).min(1, 'Email is required').email('Please enter a valid email address'),
});

export const PasswordSchema = z.object({
  password: z
    .string({ message: 'Please enter a password' })
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const LoginSchema = z.object({
  email: z.string({ message: 'Please enter an email' }).min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string({ message: 'Please enter a password' })
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const SignUpSchema = LoginSchema.extend({
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type LoginFormData = z.infer<typeof LoginSchema>;
export type SignUpFormData = z.infer<typeof SignUpSchema>;
