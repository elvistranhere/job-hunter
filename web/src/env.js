import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().min(1).optional(),
    WORKER_URL: z.string().url().optional(),
    WORKER_SECRET: z.string().min(1).optional(),
    GMAIL_USER: z.string().email().optional(),
    GMAIL_APP_PASSWORD: z.string().min(1).optional(),
    EMAIL_TO: z.string().optional(),
    CRON_SECRET: z.string().min(1).optional(),
  },

  client: {},

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    WORKER_URL: process.env.WORKER_URL,
    WORKER_SECRET: process.env.WORKER_SECRET,
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
    EMAIL_TO: process.env.EMAIL_TO,
    CRON_SECRET: process.env.CRON_SECRET,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
