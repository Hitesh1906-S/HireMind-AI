import dotenv from 'dotenv';
import { z } from 'zod';

// Environment variables configuration and Zod validation
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_RESET_PASSWORD_SECRET: z.string().min(16, 'JWT_RESET_PASSWORD_SECRET must be at least 16 characters'),
  JWT_RESET_PASSWORD_EXPIRES_IN: z.string().default('1h'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),
  GEMINI_API_KEY: z.string().optional().default(''),
  AI_PROVIDER: z.enum(['gemini', 'mock']).default('gemini'),
  AI_MODEL: z.string().default('gemini-1.5-flash'),
  CODE_EXECUTION_PROVIDER: z.string().default('mock'),
  STT_PROVIDER: z.enum(['mock', 'gemini', 'whisper']).default('mock'),
  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'sendgrid', 'resend', 'mock']).default('console'),
  EMAIL_FROM: z.string().default('HireMind AI <no-reply@hiremind.ai>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform((val) => (val ? Number(val) : 587)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.string().optional().transform((val) => val === 'true'),
  SENDGRID_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
