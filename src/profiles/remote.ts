import { config } from '../config.js';
import { AppError } from '../errors.js';
import { clientEmailPattern, standardEmail, subscriptionEmail } from './naming.js';
import { panel } from '../panel/client.js';
import { matchProfileGroup } from './types.js';
export type PanelClient = Awaited<ReturnType<typeof panel.clients>>[number];
export type Inbound = Awaited<ReturnType<typeof panel.inbounds>>[number];

export function ownsClient(userId: string, client: PanelClient) {
  return (
    client.group === standardEmail(userId) &&
    clientEmailPattern.test(client.email) &&
    (client.email === standardEmail(userId) ||
      /^[0-9a-f]{12}@3x\.local$/.test(client.email) ||
      client.email.includes('-'))
  );
}

export async function userClients(userId: string) {
  return (await panel.clients()).filter((client) => ownsClient(userId, client));
}

export async function getClient(userId: string, email: string) {
  const client = await panel.find(email);
  if (!client || !ownsClient(userId, client)) throw new AppError(404, 'Клиент не найден. Обновите список.');
  return client;
}

function clientName(client: PanelClient) {
  const comment = client.comment.trim();
  return comment || client.email;
}

export function subscriptionUrl(client: PanelClient): string | null {
  if (!config.XUI_SUBSCRIPTION_URL || !client.subId) return null;
  const base = new URL(config.XUI_SUBSCRIPTION_URL);
  if (!['https:', 'http:'].includes(base.protocol)) return null;
  base.pathname = `${base.pathname.replace(/\/$/, '')}/${encodeURIComponent(client.subId)}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

export function publicProfile(
  client: PanelClient,
  inbounds: Inbound[],
  onlineEmails: Set<string> | null = null,
): {
  id: string;
  email: string;
  expiryTime: number;
  name: string;
  kind: string;
  label: string;
  protocols: string[];
  status: 'ready' | 'error';
  online: boolean | null;
  traffic: { limitBytes: number; remainingBytes: number | null } | null;
  subscriptionUrl: string | null;
} {
  const ids = client.inboundIds ?? [];
  const protocols = inbounds.filter((item) => ids.includes(item.id)).map((item) => item.protocol);
  const type = matchProfileGroup(ids);
  const kind = type?.id ?? 'unknown';
  const complete = Boolean(type && type.inboundIds.every((id) => ids.includes(id)));
  const limitBytes = client.totalGB ?? client.traffic?.total;
  const remainingBytes =
    client.traffic && limitBytes !== undefined
      ? Math.max(0, limitBytes - client.traffic.up - client.traffic.down)
      : null;
  return {
    online: onlineEmails?.has(client.email) ?? null,
    traffic: limitBytes == null ? null : { limitBytes, remainingBytes },
    id: client.email,
    expiryTime: client.expiryTime,
    email: client.subId ? subscriptionEmail(client.subId) : client.email,
    name: clientName(client),
    protocols,
    kind,
    label: type?.name ?? 'Другой протокол',
    status: complete ? 'ready' : 'error',
    subscriptionUrl: subscriptionUrl(client),
  };
}
