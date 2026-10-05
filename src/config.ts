import 'dotenv/config';
import { z } from 'zod';

const inboundId = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().positive().optional(),
);
const env = z
  .object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8081),
    APP_ORIGIN: z.url().default('http://localhost:8081'),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_ADMIN_CHAT_ID: z.string().default(''),
    TELEGRAM_ADMIN_IDS: z.string().default(''),
    APPROVALS_FILE: z.string().default('./data/approvals.json'),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    XUI_URL: z.url().optional(),
    XUI_API_TOKEN: z.string().optional(),
    XUI_SUBSCRIPTION_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),
    XUI_VLESS_INBOUND_ID: inboundId,
    XUI_TROJAN_INBOUND_ID: inboundId,
    XUI_HYSTERIA_INBOUND_ID: inboundId,
    XUI_MTPROTO_INBOUND_ID: inboundId,
    XUI_WIREGUARD_INBOUND_ID: inboundId,
    XUI_AMNEZIAWG_INBOUND_ID: inboundId,
  })
  .parse(process.env);

export const config = {
  ...env,
  production: env.NODE_ENV === 'production',
  profiles: {
    tls: {
      vless: env.XUI_VLESS_INBOUND_ID,
      trojan: env.XUI_TROJAN_INBOUND_ID,
      hysteria: env.XUI_HYSTERIA_INBOUND_ID,
    },
    mtproto: { mtproto: env.XUI_MTPROTO_INBOUND_ID },
    wireguard: { wireguard: env.XUI_WIREGUARD_INBOUND_ID },
    amneziawg: { amneziawg: env.XUI_AMNEZIAWG_INBOUND_ID },
  },
};
