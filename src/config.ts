import 'dotenv/config';
import { z } from 'zod';
import { IANAZone } from 'luxon';
import { loadProfileGroups } from './profile-config.js';

const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    SUBSCRIPTION_TIMEZONE: z
      .string()
      .default('Europe/Moscow')
      .refine((zone) => IANAZone.isValidZone(zone), 'Invalid timezone'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8081),
    APP_ORIGIN: z.url().default('http://localhost:8081'),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_ADMIN_CHAT_ID: z.string().default(''),
    TELEGRAM_ADMIN_IDS: z.string().default(''),
    CLIENT_GROUPS_FILE: z.string().default('./client-groups.json'),
    APPROVALS_FILE: z.string().default('./data/approvals.json'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    XUI_URL: z.url().optional(),
    XUI_API_TOKEN: z.string().optional(),
    XUI_SUBSCRIPTION_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
  })
  .parse(process.env);

export const config = {
  ...env,
  production: env.NODE_ENV === 'production',
  profiles: loadProfileGroups(env.CLIENT_GROUPS_FILE),
};
